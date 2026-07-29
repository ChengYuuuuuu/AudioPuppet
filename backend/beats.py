import logging
from typing import Optional, Tuple, List

import librosa
import numpy as np

log = logging.getLogger(__name__)


def detect_beats(y: np.ndarray, sr: float) -> Tuple[Optional[float], List[float]]:
    try:
        tempo, beat_times = librosa.beat.beat_track(
            y=y, sr=sr, units="time", start_bpm=120, tightness=100,
        )
        beats = (
            [float(t) for t in beat_times]
            if hasattr(beat_times, "__len__")
            else []
        )
        bpm = None
        if tempo is not None:
            try:
                t = tempo.item() if hasattr(tempo, "item") else float(tempo)
                if t > 0:
                    bpm = round(t, 1)
            except (TypeError, ValueError, AttributeError):
                pass
        return bpm, beats
    except Exception:
        log.exception("beat_track failed")
        return None, []
