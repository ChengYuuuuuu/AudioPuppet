import { beat_track } from 'pleco-xa';

self.onmessage = (e: MessageEvent) => {
  const { audio, sampleRate } = e.data as { audio: ArrayBuffer; sampleRate: number };
  const y = new Float32Array(audio);
  try {
    const res = beat_track(y, sampleRate, {
      units: 'time',
      startBpm: 120,
      tightness: 100,
      trim: true,
    });
    const bpm = typeof res.tempo === 'number' ? res.tempo : 0;
    const beats = Array.isArray(res.beats)
      ? (res.beats as number[]).filter((b) => typeof b === 'number')
      : [];
    (self as unknown as Worker).postMessage({ bpm: bpm > 0 ? bpm : null, beats });
  } catch (err) {
    (self as unknown as Worker).postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};
