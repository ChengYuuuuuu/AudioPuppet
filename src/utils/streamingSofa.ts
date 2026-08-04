import type { SofaPhoneme } from './sofa';
import { loadModels, runPipeline, disposePipeline, getSofaSession, type ModelProgress } from './client/sofaPipeline';
import { runSofaInference } from './client/onnxLoader';
import { decodePhonemes, edgePredStats } from './client/viterbi';
import { VOCAB } from './client/g2p';
import { disposeBeatWorker } from './client/beatDetector';

export interface ChunkEvent {
  type: 'chunk_start' | 'chunk_complete' | 'bpm' | 'error' | 'complete';
  index?: number;
  start?: number;
  end?: number;
  success?: boolean;
  phonemes?: SofaPhoneme[];
  words?: Array<{ text: string; start: number; end: number }>;
  confidence?: number;
  bpm?: number;
  beats?: number[];
  message?: string;
}

export interface StreamingCallbacks {
  onChunkStart?: (index: number, start: number, end: number) => void;
  onChunkComplete?: (index: number, data: ChunkEvent) => void;
  onBpm?: (bpm: number | null, beats: number[]) => void;
  onError?: (message: string) => void;
  onComplete?: () => void;
}

export type ModelLoadState =
  | { status: 'idle' }
  | { status: 'loading'; loaded: number; total: number; label: string }
  | { status: 'done' }
  | { status: 'error'; message: string };

let modelLoadState: ModelLoadState = { status: 'idle' };
const loadListeners = new Set<() => void>();

export function getModelLoadState(): ModelLoadState {
  return modelLoadState;
}

export function subscribeModelLoadState(cb: () => void): () => void {
  loadListeners.add(cb);
  return () => {
    loadListeners.delete(cb);
  };
}

function setModelLoadState(s: ModelLoadState): void {
  modelLoadState = s;
  loadListeners.forEach((cb) => cb());
}

let loadingPromise: Promise<void> | null = null;

function progressHandler(progress: ModelProgress): void {
  setModelLoadState({
    status: 'loading',
    loaded: progress.loaded,
    total: progress.total,
    label: progress.label,
  });
}

export function ensureModelsLoaded(
  onProgress?: (progress: ModelProgress) => void,
  useVocalSeparation = false,
): Promise<void> {
  if (!loadingPromise) {
    loadingPromise = loadModels(onProgress ?? progressHandler, useVocalSeparation)
      .then(() => setModelLoadState({ status: 'done' }))
      .catch((err) => {
        setModelLoadState({ status: 'error', message: err?.message ?? String(err) });
        throw err;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  return loadingPromise;
}

export function analyzeSofaUrlChunked(
  url: string,
  lyricsText: string,
  _referer: string | undefined,
  callbacks: StreamingCallbacks,
  useVocalSeparation = false,
): AbortController {
  const controller = new AbortController();

  const start = async () => {
    await ensureModelsLoaded(undefined, useVocalSeparation);
    if (controller.signal.aborted) return;
    await runPipeline(url, lyricsText, callbacks, useVocalSeparation);
  };

  start().catch((err) => {
    if (err.name !== 'AbortError') {
      callbacks.onError?.(err.message ?? String(err));
      callbacks.onComplete?.();
    }
  });

  return controller;
}

export function disposeLocalPipeline(): void {
  disposePipeline();
  disposeBeatWorker();
  loadingPromise = null;
  setModelLoadState({ status: 'idle' });
}

export async function testSofaInference(): Promise<{ ms: number; frames: number }> {
  await ensureModelsLoaded();
  const session = getSofaSession();
  if (!session) throw new Error('SOFA session 未就绪');

  const sr = 44100;
  const n = sr;
  const wave = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    wave[i] = Math.sin((2 * Math.PI * 220 * i) / sr) * 0.3;
  }
  const padded = new Float32Array(Math.ceil(n / 512) * 512);
  padded.set(wave);

  const t0 = performance.now();
  const res = await runSofaInference(session, padded);
  const ms = performance.now() - t0;
  const frames = Math.round(res.phFrameLogits.length / 65);

  return { ms, frames };
}

export async function testSofaLongAlignment(): Promise<{
  ms: number; phonemeCount: number; meanDur: number; gt5: number; seq: string; edgeMean: number; edgeLt01: number;
}> {
  await ensureModelsLoaded();
  const session = getSofaSession();
  if (!session) throw new Error('SOFA session 未就绪');

  const cons = ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'];
  const vows = ['a','o','e','i','u','ai','ei','ao','ou','an','en','ang','eng','ong','ia','ie','iao','iu','ian','in','iang','ing','iong','ua','uo','uai','ui','uan','uang','un','ve','vn'];
  const phSeq: string[] = ['SP'];
  for (let i = 0; i < 62; i++) {
    phSeq.push(cons[i % cons.length], vows[i % vows.length], 'SP');
  }

  const sr = 44100;
  const dur = 40;
  const n = sr * dur;
  const audio = new Float32Array(n);
  const syllableLen = dur / 62;
  const toneLen = syllableLen * 0.75;
  for (let i = 0; i < 62; i++) {
    const start = Math.floor(i * syllableLen * sr);
    const end = Math.min(start + Math.floor(toneLen * sr), n);
    const f = 180 + (i % 10) * 30 + Math.floor(i / 10) * 15;
    for (let s = start; s < end; s++) {
      const t = (s - start) / sr;
      audio[s] = 0.4 * Math.sin((Math.PI * t) / toneLen) ** 2 * Math.sin(2 * Math.PI * f * t);
    }
  }

  const phSeqId = new Int32Array(phSeq.map((p) => VOCAB[p]));
  const padded = new Float32Array(Math.ceil(audio.length / 512) * 512);
  padded.set(audio);

  const t0 = performance.now();
  const res = await runSofaInference(session, padded);
  const ms = performance.now() - t0;

  const frameLength = 512 / (44100 * 4);
  const { phonemes } = decodePhonemes(phSeqId, res.phFrameLogits, res.phEdgeLogits, phSeq, frameLength, 65);
  const durs = phonemes.map((p) => p.end - p.start);
  const meanDur = durs.length > 0 ? durs.reduce((s, d) => s + d, 0) / durs.length : 0;
  const gt5 = durs.filter((d) => d > 5).length;
  const es = edgePredStats(res.phEdgeLogits);
  return {
    ms,
    phonemeCount: phonemes.length,
    meanDur,
    gt5,
    seq: phonemes.slice(0, 20).map((p) => p.ph).join(' '),
    edgeMean: es.mean,
    edgeLt01: es.lt01,
  };
}

