from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import tempfile
import os
import json
import logging

import librosa
import traceback
import numpy as np
import requests

from sofa_aligner import SofaAligner
from vocal_separator import separate_vocals
from chunked_processor import ChunkedProcessor
from beats import detect_beats

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler(os.path.join(os.path.dirname(__file__), 'backend.log'), encoding='utf-8')],
)
log = logging.getLogger(__name__)
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
    lyrics_text: str = ""


script_dir = os.path.dirname(__file__)
ckpt_path = os.path.join(script_dir, "sofa_source", "ckpt", "v1.0.0_mandarin_singing.ckpt")
dict_path = os.path.join(script_dir, "sofa_source", "dictionary", "opencpop-extension.txt")
ja_dict_path = os.path.join(script_dir, "sofa_source", "dictionary", "japanese-dictionary-compat.txt")

en_ckpt_path = os.path.join(script_dir, "sofa_source", "ckpt", "tgm_en_v100.ckpt")
en_dict_path = os.path.join(script_dir, "sofa_source", "dictionary", "english-dictionary.txt")

aligner = SofaAligner(ckpt_path, dict_path, ja_dict_path=ja_dict_path,
                      en_ckpt_path=en_ckpt_path, en_dict_path=en_dict_path)

chunked_processor = ChunkedProcessor(aligner)


def _detect_beats_from_path(audio_path: str):
    y, sr = librosa.load(audio_path, sr=None, mono=True)
    return detect_beats(y, sr)


def analyze_audio_align(audio_path: str, lyrics_text: str) -> dict:
    vocal_path = None
    try:
        vocal_path = separate_vocals(audio_path)
    except Exception:
        log.exception("人声分离失败，回退到原始音频进行SOFA对齐")
        vocal_path = audio_path

    sofa_result = aligner.align(vocal_path, lyrics_text)

    if vocal_path != audio_path:
        try:
            os.unlink(vocal_path)
        except Exception:
            pass

    bpm = None
    beats = []

    try:
        y, sr = librosa.load(audio_path, sr=None, mono=True)
        duration = len(y) / sr
        max_amp = float(np.max(np.abs(y)))
        rms = float(np.sqrt(np.mean(y**2)))
        log.info(f"音频: sr={sr}, 时长={duration:.2f}s, 样本数={len(y)}, max_amp={max_amp:.4f}, rms={rms:.4f}")
        bpm, beats = _detect_beats_from_path(audio_path)
        log.info(f"结果: bpm={bpm}, 节拍数={len(beats)}")
    except Exception:
        log.exception("Librosa 分析失败")

    return {
        "success": sofa_result["success"],
        "phonemes": sofa_result["phonemes"],
        "words": sofa_result["words"],
        "confidence": sofa_result["confidence"],
        "bpm": bpm,
        "beats": beats,
    }


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
        return {"success": False, "error": f"音频下载失败: {e}", "phonemes": [], "bpm": None, "beats": []}

    result = analyze_audio_align(tmp_path, req.lyrics_text)

    if tmp_path and os.path.exists(tmp_path):
        os.unlink(tmp_path)

    return Response(
        content=json.dumps(result, ensure_ascii=False),
        media_type="application/json",
        headers={"Cache-Control": "no-store"},
    )


@app.post("/analyze")
async def analyze(
    audio: UploadFile = File(...),
    lyrics_text: str = Form(""),
):
    suffix = os.path.splitext(audio.filename or "audio.mp3")[1] or ".mp3"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    file_size = os.path.getsize(tmp_path)
    log.info(f"上传文件: {audio.filename}, 大小={file_size} bytes, suffix={suffix}")

    result = analyze_audio_align(tmp_path, lyrics_text)

    os.unlink(tmp_path)
    return Response(
        content=json.dumps(result, ensure_ascii=False),
        media_type="application/json",
        headers={"Cache-Control": "no-store"},
    )


@app.post("/analyze-url-chunked")
async def analyze_url_chunked(req: AnalyzeURLRequest):
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
    except Exception as exc:
        err_msg = str(exc)
        log.error(f"音频下载失败: {err_msg}")
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        async def err_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': f'音频下载失败: {err_msg}'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
        return StreamingResponse(err_stream(), media_type="text/event-stream")

    async def event_stream():
        try:
            async for event in chunked_processor.process_all(tmp_path, req.lyrics_text):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            log.exception("流式处理异常")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

    return StreamingResponse(
        event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@app.post("/analyze-chunked")
async def analyze_chunked(
    audio: UploadFile = File(...),
    lyrics_text: str = Form(""),
):
    suffix = os.path.splitext(audio.filename or "audio.mp3")[1] or ".mp3"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    file_size = os.path.getsize(tmp_path)
    log.info(f"上传文件: {audio.filename}, 大小={file_size} bytes, suffix={suffix}")

    async def event_stream():
        try:
            async for event in chunked_processor.process_all(tmp_path, lyrics_text):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            log.exception("流式处理异常")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    return StreamingResponse(
        event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


# ── Serve frontend static files (production build in dist/) ──
dist_dir = os.path.join(script_dir, "..", "dist")
if os.path.isdir(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
    log.info(f"Frontend static files mounted from {dist_dir}")
else:
    log.warning("dist/ not found, frontend will not be served. Run 'npm run build' first.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=False)
