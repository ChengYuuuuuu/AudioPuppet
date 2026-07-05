import type { MouthPoint } from '../types';
import { charToMouth } from './mouthMapper';

const WHISPER_API = 'http://localhost:8001';

export async function analyzeAudioBlob(blob: Blob): Promise<{
  success: boolean;
  words?: Array<{ text: string; start: number; end: number }>;
  bpm?: number;
  beats?: number[];
}> {
  try {
    const formData = new FormData();
    formData.append('audio', blob, 'audio.mp3');

    const res = await fetch(`${WHISPER_API}/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.error('❌ 后端 /analyze 请求失败:', res.status, res.statusText);
      return { success: false };
    }

    return await res.json();
  } catch (err) {
    console.error('❌ 后端 /analyze 请求失败:', err);
    return { success: false };
  }
}

export async function analyzeAudioUrl(url: string, referer?: string): Promise<{
  success: boolean;
  words?: Array<{ text: string; start: number; end: number }>;
  bpm?: number;
  beats?: number[];
}> {
  try {
    const res = await fetch(`${WHISPER_API}/analyze-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, referer }),
    });

    if (!res.ok) {
      console.error('❌ 后端 /analyze-url 请求失败:', res.status, res.statusText);
      return { success: false };
    }

    return await res.json();
  } catch (err) {
    console.error('❌ 后端 /analyze-url 请求失败:', err);
    return { success: false };
  }
}

export function wordsToMouthPoints(
  words: Array<{ text: string; start: number; end: number }>
): MouthPoint[] {
  return words.map((w) => ({
    char: w.text.trim(),
    start: w.start,
    end: w.end,
    mouth: charToMouth(w.text.trim()),
  }));
}
