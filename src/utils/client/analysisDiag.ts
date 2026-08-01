export type AnalysisStage = 'audio' | 'g2p' | 'infer' | 'decode';

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'running'; stage: AnalysisStage; chunkIndex?: number }
  | { status: 'error'; stage?: AnalysisStage; message: string }
  | { status: 'done' };

let state: AnalysisState = { status: 'idle' };
const listeners = new Set<() => void>();

export function getAnalysisState(): AnalysisState {
  return state;
}

export function subscribeAnalysisState(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setAnalysisState(s: AnalysisState): void {
  state = s;
  listeners.forEach((cb) => cb());
}
