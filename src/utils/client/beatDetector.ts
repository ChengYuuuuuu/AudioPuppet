export interface BeatResult {
  bpm: number | null;
  beats: number[];
}

let worker: Worker | null = null;
let pending:
  | { resolve: (r: BeatResult) => void; reject: (e: Error) => void }
  | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./beatWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const p = pending;
      pending = null;
      if (!p) return;
      if (e.data?.error) p.reject(new Error(e.data.error));
      else p.resolve({ bpm: e.data?.bpm ?? null, beats: e.data?.beats ?? [] });
    };
    worker.onerror = (e) => {
      const p = pending;
      pending = null;
      p?.reject(new Error(e.message || '节拍检测 worker 错误'));
    };
  }
  return worker;
}

export function detectBeats(audio: Float32Array, sampleRate: number): Promise<BeatResult> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    w.postMessage({ audio: audio.buffer, sampleRate }, [audio.buffer]);
  });
}

export function disposeBeatWorker(): void {
  worker?.terminate();
  worker = null;
}
