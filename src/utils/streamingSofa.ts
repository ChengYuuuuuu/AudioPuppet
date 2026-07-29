import type { SofaPhoneme } from './sofa';

const SOFA_API = '';

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

async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamingCallbacks,
) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data: ChunkEvent = JSON.parse(line.slice(6));
        switch (data.type) {
          case 'chunk_start':
            callbacks.onChunkStart?.(data.index!, data.start!, data.end!);
            break;
          case 'chunk_complete':
            callbacks.onChunkComplete?.(data.index!, data);
            break;
          case 'bpm':
            callbacks.onBpm?.(data.bpm ?? null, data.beats ?? []);
            break;
          case 'error':
            callbacks.onError?.(data.message ?? 'Unknown error');
            break;
          case 'complete':
            callbacks.onComplete?.();
            break;
        }
      } catch {
        // skip malformed JSON
      }
    }
  }
}

export function analyzeSofaUrlChunked(
  url: string,
  lyricsText: string,
  referer: string | undefined,
  callbacks: StreamingCallbacks,
): AbortController {
  const controller = new AbortController();

  fetch(`${SOFA_API}/analyze-url-chunked`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, lyrics_text: lyricsText, referer }),
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok || !res.body) {
        callbacks.onError?.(`HTTP ${res.status}`);
        callbacks.onComplete?.();
        return;
      }
      return readSSEStream(res.body.getReader(), callbacks);
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err.message);
        callbacks.onComplete?.();
      }
    });

  return controller;
}

