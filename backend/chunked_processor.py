"""
Pipeline-parallel chunked processor for audio alignment.
Overlaps I/O (audio cutting) and CPU work (vocal separation)
with GPU compute (SOFA alignment) via an asyncio prefetch queue.

Architecture:
  prefetcher (async) → queue(maxsize=1) → main loop (async)

  Prefetcher cuts audio & runs vocal separation for chunk N+1
  while the main loop runs SOFA alignment on chunk N.
"""
import os
import re
import asyncio
import tempfile
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncGenerator, Dict, List

import librosa
import soundfile as sf
import numpy as np

from sofa_aligner import SofaAligner
from vocal_separator import separate_vocals
from beats import detect_beats

log = logging.getLogger(__name__)


class ChunkedProcessor:
    def __init__(self, aligner: SofaAligner, max_prefetch: int = 1):
        self.aligner = aligner
        self.max_prefetch = max_prefetch
        self._executor = ThreadPoolExecutor(max_workers=2)

    # ── LRC parsing ──

    @staticmethod
    def parse_lrc_timestamps(lrc_text: str) -> List[Dict]:
        lines = lrc_text.strip().split("\n")
        result = []
        time_regex = re.compile(r"\[(\d{2}):(\d{2})[.:](\d{2,3})\]")
        for line in lines:
            matches = list(time_regex.finditer(line))
            if not matches:
                continue
            text = time_regex.sub("", line).strip()
            text = re.sub(r"[（(][^）)]*[）)]", "", text).strip()
            if not text:
                continue
            m = matches[-1]
            minutes = int(m.group(1))
            seconds = int(m.group(2))
            millis = int(m.group(3))
            if len(m.group(3)) == 2:
                millis *= 10
            time_val = minutes * 60 + seconds + millis / 1000
            result.append({"time": time_val, "text": text})
        result.sort(key=lambda x: x["time"])
        return result

    # ── Chunk computation ──

    @staticmethod
    def compute_chunks(
        lrc_lines: List[Dict],
        audio_duration: float,
        min_chunk: float = 40.0,
        min_remaining: float = 15.0,
    ) -> List[Dict]:
        if not lrc_lines:
            chunks = []
            pos = 0.0
            while pos < audio_duration:
                end = min(pos + min_chunk, audio_duration)
                remaining = audio_duration - end
                if remaining <= min_remaining and chunks:
                    chunks[-1]["end"] = audio_duration
                    break
                chunks.append({
                    "index": len(chunks),
                    "start": pos,
                    "end": end,
                    "lyrics_text": "",
                    "lrc_lines": [],
                })
                pos = end
            return chunks if chunks else [{
                "index": 0, "start": 0.0, "end": audio_duration,
                "lyrics_text": "", "lrc_lines": [],
            }]

        chunks = []
        chunk_start = 0.0
        chunk_start_idx = 0

        for i, line in enumerate(lrc_lines):
            t = line["time"]
            dur = t - chunk_start
            remaining = audio_duration - t

            if dur >= min_chunk and remaining > min_remaining:
                slice_lines = lrc_lines[chunk_start_idx:i]
                lyrics_text = " ".join(ln["text"] for ln in slice_lines)
                chunks.append({
                    "index": len(chunks),
                    "start": chunk_start,
                    "end": t,
                    "lyrics_text": lyrics_text,
                    "lrc_lines": slice_lines,
                })
                chunk_start = t
                chunk_start_idx = i

        if chunk_start_idx < len(lrc_lines):
            slice_lines = lrc_lines[chunk_start_idx:]
            lyrics_text = " ".join(ln["text"] for ln in slice_lines)
            tail_dur = audio_duration - chunk_start
            if chunks and tail_dur <= min_remaining:
                last = chunks[-1]
                last["end"] = audio_duration
                last["lyrics_text"] = last["lyrics_text"] + " " + lyrics_text
                last["lrc_lines"].extend(slice_lines)
            else:
                chunks.append({
                    "index": len(chunks),
                    "start": chunk_start,
                    "end": audio_duration,
                    "lyrics_text": lyrics_text,
                    "lrc_lines": slice_lines,
                })

        return chunks

    # ── Audio I/O ──

    @staticmethod
    def cut_audio_segment(audio_path: str, start: float, end: float, output_path: str):
        try:
            y, sr = librosa.load(audio_path, sr=None, mono=True,
                                 offset=start, duration=end - start)
            sf.write(output_path, y, sr)
            log.info(
                f"Cut [{start:.2f}s-{end:.2f}s] -> {output_path} "
                f"(sr={sr}, {len(y)} samples)"
            )
        except Exception:
            log.exception(f"cut_audio_segment failed [{start:.2f}s-{end:.2f}s]")
            raise

    @staticmethod
    def get_audio_duration(audio_path: str) -> float:
        try:
            return librosa.get_duration(path=audio_path)
        except Exception:
            y, sr = librosa.load(audio_path, sr=None, mono=True)
            return len(y) / sr

    # ── Processing stages ──

    @staticmethod
    def _run_separation_safe(chunk_wav: str) -> str:
        try:
            return separate_vocals(chunk_wav)
        except Exception:
            log.exception(f"Vocal separation failed for {chunk_wav}, "
                          "falling back to raw audio")
            return chunk_wav

    def _run_alignment(self, chunk: Dict, vocal_path: str) -> Dict:
        lyrics = chunk["lyrics_text"]
        result = self.aligner.align(vocal_path, lyrics)
        if result.get("success"):
            offset = chunk["start"]
            for ph in result.get("phonemes", []):
                ph["start"] += offset
                ph["end"] += offset
            for w in result.get("words", []):
                w["start"] += offset
                w["end"] += offset
        return result

    # ── Pipeline orchestration ──

    async def process_all(
        self, audio_path: str, lrc_text: str
    ) -> AsyncGenerator[Dict, None]:
        lrc_lines = self.parse_lrc_timestamps(lrc_text)
        audio_duration = await asyncio.get_event_loop().run_in_executor(
            self._executor, self.get_audio_duration, audio_path,
        )
        log.info(f"Audio duration: {audio_duration:.2f}s, LRC lines: {len(lrc_lines)}")
        chunks = self.compute_chunks(lrc_lines, audio_duration)
        log.info(
            f"Computed {len(chunks)} chunks: "
            + ", ".join(
                f"#{c['index']}[{c['start']:.1f}s-{c['end']:.1f}s]"
                for c in chunks
            )
        )

        if not chunks:
            yield {"type": "error", "message": "No chunks to process"}
            return

        queue: asyncio.Queue = asyncio.Queue(maxsize=self.max_prefetch)

        async def prefetcher():
            try:
                loop = asyncio.get_event_loop()
                for chunk in chunks:
                    temp_wav = None
                    try:
                        fd, temp_wav = tempfile.mkstemp(
                            suffix=f"_chunk{chunk['index']}.wav"
                        )
                        os.close(fd)

                        await loop.run_in_executor(
                            self._executor,
                            self.cut_audio_segment,
                            audio_path, chunk["start"], chunk["end"], temp_wav,
                        )

                        vocal_path = await loop.run_in_executor(
                            self._executor,
                            self._run_separation_safe,
                            temp_wav,
                        )

                        await queue.put((chunk, temp_wav, vocal_path))
                    except Exception:
                        log.exception(
                            f"Chunk {chunk['index']} preparation failed, skipping"
                        )
                        if temp_wav and os.path.exists(temp_wav):
                            try:
                                os.unlink(temp_wav)
                            except Exception:
                                pass

                await queue.put(None)
            except Exception:
                log.exception("Prefetcher fatal error")
                await queue.put(None)

        prefetch_task = asyncio.create_task(prefetcher())

        try:
            loop = asyncio.get_event_loop()
            while True:
                item = await queue.get()
                if item is None:
                    break

                chunk, temp_wav, vocal_path = item

                yield {
                    "type": "chunk_start",
                    "index": chunk["index"],
                    "start": chunk["start"],
                    "end": chunk["end"],
                }

                try:
                    result = await loop.run_in_executor(
                        self._executor,
                        self._run_alignment,
                        chunk, vocal_path,
                    )
                    yield {
                        "type": "chunk_complete",
                        "index": chunk["index"],
                        "start": chunk["start"],
                        "end": chunk["end"],
                        "success": result.get("success", False),
                        "phonemes": result.get("phonemes", []),
                        "words": result.get("words", []),
                        "confidence": result.get("confidence", 0.0),
                    }

                    phoneme_str = " ".join(p["ph"] for p in result.get("phonemes", []))
                    romaji = result.get("processed_text", "")
                    log.info(
                        f"chunk{chunk['index']} {chunk['lyrics_text']} - {romaji} - {phoneme_str}"
                    )
                except Exception:
                    log.exception(f"Chunk {chunk['index']} alignment failed")
                    yield {
                        "type": "chunk_complete",
                        "index": chunk["index"],
                        "start": chunk["start"],
                        "end": chunk["end"],
                        "success": False,
                        "phonemes": [],
                        "words": [],
                        "confidence": 0.0,
                    }

                for p in [vocal_path, temp_wav]:
                    try:
                        if os.path.exists(p):
                            os.unlink(p)
                    except Exception:
                        pass

        finally:
            prefetch_task.cancel()
            try:
                await prefetch_task
            except asyncio.CancelledError:
                pass

        y, sr = librosa.load(audio_path, sr=None, mono=True)
        bpm, beats = detect_beats(y, sr)
        yield {"type": "bpm", "bpm": bpm, "beats": beats}
        yield {"type": "complete"}
