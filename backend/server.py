from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from faster_whisper import WhisperModel
import tempfile
import os
import logging

import librosa
import traceback
import numpy as np
import requests

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)
fh = logging.FileHandler(os.path.join(os.path.dirname(__file__), 'backend.log'), encoding='utf-8')
fh.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
log.addHandler(fh)
log.info(f"librosa 版本: {librosa.__version__}")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeURLRequest(BaseModel):
    url: str
    referer: str | None = None

model = WhisperModel("small", device="cpu", compute_type="int8")


def transcribe_audio(file_path: str) -> list:
    segments, _ = model.transcribe(file_path, word_timestamps=True)
    words = []
    for seg in segments:
        for word in seg.words:
            words.append({"text": word.word, "start": word.start, "end": word.end})
    return words


def detect_beats(audio: np.ndarray, sr: float) -> tuple:
    log.info(f"  detect_beats 输入: shape={audio.shape}, sr={sr}, duration={len(audio)/sr:.2f}s")
    configs = [
        {"start_bpm": 120, "tightness": 100},
        {"start_bpm": 80, "tightness": 60},
        {"start_bpm": 140, "tightness": 80},
        {"start_bpm": 60, "tightness": 40},
    ]

    for i, cfg in enumerate(configs):
        try:
            log.debug(f"  beat_track [{i}] 调用: y.shape={audio.shape}, cfg={cfg}")
            tempo, beat_times = librosa.beat.beat_track(
                y=audio, sr=sr, units='time',
                start_bpm=cfg["start_bpm"],
                tightness=cfg["tightness"],
            )
            beats_arr = beat_times if hasattr(beat_times, '__len__') else []
            n_beats = len(beats_arr)
            log.info(f"  beat_track [{i}] cfg={cfg}: tempo={tempo} (type={type(tempo).__name__}), "
                     f"beat_times type={type(beat_times).__name__}, beats={n_beats}")
            if n_beats >= 1:
                bpm_val = None
                if tempo is not None:
                    try:
                        t = tempo.item() if hasattr(tempo, 'item') else float(tempo)
                        if t > 0:
                            bpm_val = round(t, 1)
                    except (TypeError, ValueError, AttributeError):
                        pass
                log.info(f"  beat_track [{i}] 成功: bpm={bpm_val}, 首拍={beats_arr[0]:.4f}")
                return bpm_val, [float(t) for t in beats_arr]
            else:
                log.warning(f"  beat_track [{i}] 返回 0 拍: tempo={tempo}")
        except Exception:
            log.exception(f"  beat_track [{i}] 异常")

    # Fallback: compute onset envelope manually
    try:
        log.debug("  beat_track [fallback] 调用 onset_strength...")
        onset_env = librosa.onset.onset_strength(y=audio, sr=sr, aggregate=np.median)
        log.debug(f"  onset_env: shape={onset_env.shape}, mean={float(np.mean(onset_env)):.4f}")
        tempo, beat_times = librosa.beat.beat_track(
            onset_envelope=onset_env, sr=sr, units='time',
            start_bpm=120, tightness=50,
        )
        beats_arr = beat_times if hasattr(beat_times, '__len__') else []
        n_beats = len(beats_arr)
        log.info(f"  beat_track [fallback onset]: tempo={tempo} (type={type(tempo).__name__}), "
                 f"beat_times type={type(beat_times).__name__}, beats={n_beats}")
        if n_beats >= 1:
            bpm_val = None
            if tempo is not None:
                try:
                    t = tempo.item() if hasattr(tempo, 'item') else float(tempo)
                    if t > 0:
                        bpm_val = round(t, 1)
                except (TypeError, ValueError, AttributeError):
                    pass
            return bpm_val, [float(t) for t in beats_arr]
        else:
            log.warning(f"  beat_track [fallback] 返回 0 拍: tempo={tempo}")
    except Exception:
        log.exception("  beat_track [fallback] 异常")

    log.warning("所有节拍检测策略均失败，返回 None, []")
    return None, []


@app.options("/analyze-url")
async def analyze_url_options():
    return Response(status_code=200)


@app.post("/analyze-url")
async def analyze_url(req: AnalyzeURLRequest):
    headers = {}
    if req.referer:
        headers["Referer"] = req.referer
    else:
        headers["Referer"] = "https://music.163.com"

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            tmp_path = tmp.name
        resp = requests.get(req.url, headers=headers, timeout=30, stream=True)
        resp.raise_for_status()
        with open(tmp_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        log.info(f"音频下载完成: {req.url}")
    except Exception as e:
        log.error(f"音频下载失败: {e}")
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        return {"success": False, "error": f"音频下载失败: {e}", "words": [], "bpm": None, "beats": []}

    try:
        words = transcribe_audio(tmp_path)
    except Exception as e:
        log.error(f"转写失败: {e}")
        words = []

    bpm = None
    beats = []

    try:
        y, sr = librosa.load(tmp_path, sr=None, mono=True)
        duration = len(y) / sr
        max_amp = float(np.max(np.abs(y)))
        rms = float(np.sqrt(np.mean(y**2)))
        log.info(f"音频: sr={sr}, 时长={duration:.2f}s, 样本数={len(y)}, max_amp={max_amp:.4f}, rms={rms:.4f}")
        bpm, beats = detect_beats(y, sr)
        log.info(f"结果: bpm={bpm}, 节拍数={len(beats)}")
    except Exception as e:
        log.exception(f"Librosa 分析失败: {e}")

    if tmp_path and os.path.exists(tmp_path):
        os.unlink(tmp_path)

    return {
        "success": True,
        "words": words,
        "bpm": bpm,
        "beats": beats,
    }


@app.post("/analyze")
async def analyze(audio: UploadFile = File(...)):
    suffix = os.path.splitext(audio.filename or "audio.mp3")[1] or ".mp3"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    file_size = os.path.getsize(tmp_path)
    log.info(f"上传文件: {audio.filename}, 大小={file_size} bytes, suffix={suffix}")

    words = transcribe_audio(tmp_path)

    bpm = None
    beats = []

    try:
        y, sr = librosa.load(tmp_path, sr=None, mono=True)
        duration = len(y) / sr
        max_amp = float(np.max(np.abs(y)))
        rms = float(np.sqrt(np.mean(y**2)))
        log.info(f"音频: sr={sr}, 时长={duration:.2f}s, 样本数={len(y)}, max_amp={max_amp:.4f}, rms={rms:.4f}")
        bpm, beats = detect_beats(y, sr)
        log.info(f"结果: bpm={bpm}, 节拍数={len(beats)}")
    except Exception as e:
        log.exception(f"Librosa 分析失败: {e}")

    os.unlink(tmp_path)
    return {
        "success": True,
        "words": words,
        "bpm": bpm,
        "beats": beats,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
