import os
import re
import sys
import logging

import numpy as np
import torch
import librosa

log = logging.getLogger(__name__)

SOFA_SOURCE_DIR = os.path.join(os.path.dirname(__file__), "sofa_source")
if SOFA_SOURCE_DIR not in sys.path:
    sys.path.insert(0, SOFA_SOURCE_DIR)

from modules.g2p.dictionary_g2p import DictionaryG2P
from modules.task.forced_alignment import LitForcedAlignmentTask


class SofaAligner:
    def __init__(self, ckpt_path: str, dict_path: str):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        log.info(f"Loading SOFA model from {ckpt_path} on {self.device}...")

        self.model = LitForcedAlignmentTask.load_from_checkpoint(ckpt_path)
        self.model.set_inference_mode("force")
        self.model.to(self.device)
        self.model.eval()

        self.g2p = DictionaryG2P(dictionary=dict_path)
        self.melspec_config = self.model.melspec_config
        self.model.get_melspec = None

        log.info(f"SOFA model loaded (vocab_size={self.model.vocab['<vocab_size>']})")

    def _extract_lyrics_text(self, lrc_text: str) -> str:
        lines = lrc_text.strip().split("\n")
        text_parts = []
        for line in lines:
            clean = re.sub(r'\[\d{2}:\d{2}(?:\.\d+)?\]', '', line).strip()
            clean = re.sub(r'\[[a-z]+:.*?\]', '', clean).strip()
            for sep in [' // ', ' / ', '//', '/']:
                idx = clean.find(sep)
                if idx > 0:
                    clean = clean[:idx].strip()
                    break
            if clean:
                text_parts.append(clean)
        return " ".join(text_parts)

    def _chinese_to_pinyin(self, text: str) -> str:
        try:
            import pypinyin
            pinyin_list = pypinyin.lazy_pinyin(text, style=pypinyin.Style.NORMAL)
            return " ".join(pinyin_list)
        except ImportError:
            log.warning("pypinyin not installed, assuming text is already pinyin")
            return text

    def _preprocess_text(self, lyrics_text: str) -> str:
        plain = self._extract_lyrics_text(lyrics_text)
        if not plain.strip():
            return ""
        plain = re.sub(r'\s+', ' ', plain).strip()
        has_chinese = bool(re.search(r'[\u4e00-\u9fff]', plain))
        if has_chinese:
            return self._chinese_to_pinyin(plain)
        return plain

    def align(self, audio_path: str, lyrics_text: str) -> dict:
        pinyin_text = self._preprocess_text(lyrics_text)
        if not pinyin_text.strip():
            log.warning("Empty lyrics text after preprocessing")
            return {"success": False, "phonemes": [], "words": [], "confidence": 0.0}

        log.info(f"Pinyin text ({len(pinyin_text)} chars): {pinyin_text[:200]}...")

        ph_seq, word_seq, ph_idx_to_word_idx = self.g2p._g2p(pinyin_text)
        if len(ph_seq) < 2:
            log.warning("No valid phonemes after G2P conversion")
            return {"success": False, "phonemes": [], "words": [], "confidence": 0.0}

        log.info(f"G2P: {len(ph_seq)} phonemes, {len(word_seq)} words")

        sr = self.melspec_config["sample_rate"]
        waveform, _ = librosa.load(audio_path, sr=sr, mono=True)
        wav_length = len(waveform) / sr

        result = self._infer(waveform, wav_length, ph_seq, word_seq, ph_idx_to_word_idx)
        if result is None:
            return {"success": False, "phonemes": [], "words": [], "confidence": 0.0}

        ph_seq_pred, ph_intervals_pred, word_seq_pred, word_intervals_pred, confidence = result

        phonemes = [
            {"ph": str(ph), "start": float(start), "end": float(end)}
            for ph, (start, end) in zip(ph_seq_pred, ph_intervals_pred)
        ]
        words = [
            {"text": str(t), "start": float(start), "end": float(end)}
            for t, (start, end) in zip(word_seq_pred, word_intervals_pred)
        ]

        log.info(f"SOFA alignment: {len(phonemes)} phonemes, confidence={confidence:.4f}")
        return {"success": True, "phonemes": phonemes, "words": words, "confidence": float(confidence)}

    @torch.no_grad()
    def _infer(self, waveform, wav_length, ph_seq, word_seq, ph_idx_to_word_idx):
        from modules.utils.get_melspec import MelSpecExtractor
        from modules.utils.post_processing import fill_small_gaps, add_SP
        from einops import repeat

        try:
            if self.model.get_melspec is None:
                self.model.get_melspec = MelSpecExtractor(**self.melspec_config)

            wav_t = torch.from_numpy(waveform).float().to(self.device)
            melspec = self.model.get_melspec(wav_t).detach().unsqueeze(0)
            melspec = (melspec - melspec.mean()) / melspec.std()
            melspec = repeat(melspec, "B C T -> B C (T N)", N=self.melspec_config["scale_factor"])

            ph_frame_logits, ph_edge_logits, _ = self.model.forward(melspec.transpose(1, 2))

            num_frames = int(
                (wav_length * self.melspec_config["scale_factor"] * self.melspec_config["sample_rate"] + 0.5)
                / self.melspec_config["hop_length"]
            )
            ph_frame_logits = ph_frame_logits[:, :num_frames, :]
            ph_edge_logits = ph_edge_logits[:, :num_frames]

            vocab = self.model.vocab
            ph_seq_id = np.array([vocab[ph] for ph in ph_seq])

            ph_mask = np.zeros(vocab["<vocab_size>"])
            ph_mask[ph_seq_id] = 1
            ph_mask[0] = 1
            ph_mask_t = torch.from_numpy(ph_mask).float().to(self.device)
            ph_mask_t = ph_mask_t.unsqueeze(0).unsqueeze(0).logical_not() * 1e9

            ph_prob_log = (
                torch.log_softmax(ph_frame_logits.float() - ph_mask_t.float(), dim=-1)
                .squeeze(0).cpu().numpy().astype("float32")
            )
            ph_edge_pred = (
                (torch.nn.functional.sigmoid(ph_edge_logits.float()) - 0.1) / 0.8
            ).clamp(0.0, 1.0).squeeze(0).cpu().numpy().astype("float32")

            T = ph_prob_log.shape[0]
            edge_diff = np.concatenate((np.diff(ph_edge_pred, axis=0), [0]), axis=0)
            edge_prob = (ph_edge_pred + np.concatenate(([0], ph_edge_pred[:-1]))).clip(0, 1)

            ph_idx_seq, ph_time_int_pred, frame_confidence = self.model._decode(
                ph_seq_id, ph_prob_log, edge_prob
            )

            frame_length = self.melspec_config["hop_length"] / (
                self.melspec_config["sample_rate"] * self.melspec_config["scale_factor"]
            )
            ph_time_fractional = (edge_diff[ph_time_int_pred] / 2).clip(-0.5, 0.5)
            ph_time_pred = frame_length * np.concatenate([
                ph_time_int_pred.astype("float32") + ph_time_fractional, [T]
            ])
            ph_intervals = np.stack([ph_time_pred[:-1], ph_time_pred[1:]], axis=1)

            ph_seq_pred = []
            ph_intervals_pred = []
            word_seq_pred = []
            word_intervals_pred = []
            word_idx_last = -1

            for i, ph_idx in enumerate(ph_idx_seq):
                if ph_seq[ph_idx] == "SP":
                    continue
                ph_seq_pred.append(ph_seq[ph_idx])
                ph_intervals_pred.append(ph_intervals[i, :])
                word_idx = ph_idx_to_word_idx[ph_idx]
                if word_idx == word_idx_last:
                    word_intervals_pred[-1][1] = ph_intervals[i, 1]
                else:
                    word_seq_pred.append(word_seq[word_idx])
                    word_intervals_pred.append([ph_intervals[i, 0], ph_intervals[i, 1]])
                    word_idx_last = word_idx

            ph_seq_pred = np.array(ph_seq_pred)
            ph_intervals_pred = np.array(ph_intervals_pred).clip(min=0, max=None)
            word_seq_pred = np.array(word_seq_pred)
            word_intervals_pred = np.array(word_intervals_pred).clip(min=0, max=None)

            total_confidence = np.exp(np.mean(np.log(frame_confidence + 1e-6)) / 3)

            word_seq_pred, word_intervals_pred = fill_small_gaps(word_seq_pred, word_intervals_pred, wav_length)
            ph_seq_pred, ph_intervals_pred = fill_small_gaps(ph_seq_pred, ph_intervals_pred, wav_length)
            word_seq_pred, word_intervals_pred = add_SP(word_seq_pred, word_intervals_pred, wav_length)
            ph_seq_pred, ph_intervals_pred = add_SP(ph_seq_pred, ph_intervals_pred, wav_length)

            return (ph_seq_pred, ph_intervals_pred, word_seq_pred, word_intervals_pred, total_confidence)

        except Exception:
            log.exception("SOFA inference failed")
            return None
