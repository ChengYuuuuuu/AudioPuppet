import os
import numpy as np
import librosa
import soundfile as sf
import onnxruntime
import logging
import tempfile

log = logging.getLogger(__name__)

SR = 44100
CHUNK_SIZE = 343980
VOCALS_IDX = 3

_session = None


def _load_model():
    global _session
    if _session is not None:
        return _session
    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "htdemucs_fp16weights.onnx")
    log.info(f"Loading htdemucs model from {model_path}")
    _session = onnxruntime.InferenceSession(
        model_path,
        providers=["CPUExecutionProvider"]
    )
    log.info("htdemucs model loaded successfully")
    return _session


def separate_vocals(audio_path: str) -> str:
    log.info(f"Separating vocals from: {audio_path}")

    y, sr = librosa.load(audio_path, sr=SR, mono=False)

    if y.ndim == 1:
        y = np.stack([y, y], axis=0)
    if y.shape[0] == 1:
        y = np.concatenate([y, y], axis=0)

    n_samples = y.shape[1]
    log.info(f"Audio loaded: {n_samples} samples at {SR}Hz, stereo")

    session = _load_model()
    input_name = session.get_inputs()[0].name

    num_chunks = int(np.ceil(n_samples / CHUNK_SIZE))
    log.info(f"Processing {num_chunks} chunks (0% overlap)")

    vocals_list = []

    for i in range(num_chunks):
        start = i * CHUNK_SIZE
        end = min(start + CHUNK_SIZE, n_samples)
        actual_len = end - start

        chunk = np.zeros((2, CHUNK_SIZE), dtype=np.float32)
        chunk[:, :actual_len] = y[:, start:end]

        inp = chunk[np.newaxis, :, :]
        out = session.run(None, {input_name: inp})[0]

        v = out[0, VOCALS_IDX, :, :actual_len]
        vocals_list.append(v)

    vocals = np.concatenate(vocals_list, axis=1)

    fd, path = tempfile.mkstemp(suffix="_vocals.wav")
    os.close(fd)
    sf.write(path, vocals.T, SR)
    log.info(f"Vocals saved to: {path}, duration={vocals.shape[1]/SR:.2f}s")

    return path
