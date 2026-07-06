import type { MouthPoint, MouthShape } from '../types';

const SOFA_API = 'http://localhost:8001';

export interface SofaPhoneme {
  ph: string;
  start: number;
  end: number;
}

interface SofaResult {
  success: boolean;
  phonemes?: SofaPhoneme[];
  words?: Array<{ text: string; start: number; end: number }>;
  bpm?: number;
  beats?: number[];
  confidence?: number;
}

export async function analyzeSofaUrl(
  url: string,
  lyricsText: string,
  referer?: string
): Promise<SofaResult> {
  try {
    const res = await fetch(`${SOFA_API}/analyze-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, lyrics_text: lyricsText, referer }),
    });

    if (!res.ok) {
      console.error('SOFA /analyze-url 请求失败:', res.status, res.statusText);
      return { success: false };
    }

    return await res.json();
  } catch (err) {
    console.error('SOFA /analyze-url 请求失败:', err);
    return { success: false };
  }
}

export async function analyzeSofaBlob(
  blob: Blob,
  lyricsText: string
): Promise<SofaResult> {
  try {
    const formData = new FormData();
    formData.append('audio', blob, 'audio.mp3');
    formData.append('lyrics_text', lyricsText);

    const res = await fetch(`${SOFA_API}/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.error('SOFA /analyze 请求失败:', res.status, res.statusText);
      return { success: false };
    }

    return await res.json();
  } catch (err) {
    console.error('SOFA /analyze 请求失败:', err);
    return { success: false };
  }
}
