import { type LyricLine } from '../types/index';

export function parseLRC(lrcText: string): LyricLine[] {
  const lines = lrcText.split('\n');
  const lyrics: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})[\.:](\d{2,3})\]/g;

  for (const line of lines) {
    const matches = [...line.matchAll(timeRegex)];
    if (matches.length === 0) continue;

    const text = line.replace(timeRegex, '').trim();
    if (!text) continue;

    for (const match of matches) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      let millis = parseInt(match[3]);
      if (match[3].length === 2) millis *= 10;
      const time = minutes * 60 + seconds + millis / 1000;
      lyrics.push({ time, text });
    }
  }

  lyrics.sort((a, b) => a.time - b.time);
  return lyrics;
}

export function getCurrentLyric(
  lyrics: LyricLine[],
  currentTime: number,
  offset: number = 0
): LyricLine | null {
  const adjustedTime = currentTime + offset / 1000;
  let result: LyricLine | null = null;
  for (const line of lyrics) {
    if (line.time <= adjustedTime) {
      result = line;
    } else {
      break;
    }
  }
  return result;
}
