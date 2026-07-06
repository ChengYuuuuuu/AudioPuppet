import type { MouthShape } from '../types';
import type { SofaPhoneme } from './sofa';

const VOWEL_PRIORITY = ['a', 'e', 'o', 'i', 'u'];

const PHONEME_TO_MOUTH: Record<string, MouthShape> = {
  a: 'A', ai: 'A', an: 'A', ang: 'A', ao: 'A',
  ia: 'A', ian: 'A', iang: 'A', iao: 'A',
  ua: 'A', uai: 'A', uan: 'A', uang: 'A',
  van: 'A',

  e: 'E', ei: 'E', en: 'E', eng: 'E', er: 'E',
  ie: 'E', ve: 'E',
  E: 'E', En: 'E',

  i: 'I', in: 'I', ing: 'I', ir: 'I', iu: 'I',
  i0: 'I',

  o: 'O', ong: 'O', ou: 'O',
  iong: 'O', uo: 'O',

  u: 'U', ui: 'U', un: 'U',
  v: 'U', vn: 'U',

  SP: 'closed', AP: 'closed',
};

export function phonemeToMouth(ph: string): MouthShape {
  return PHONEME_TO_MOUTH[ph] || 'closed';
}

export function phonemesToMouthPoints(phonemes: SofaPhoneme[]): Array<{
  char: string; start: number; end: number; mouth: MouthShape;
}> {
  return phonemes.map((ph) => ({
    char: ph.ph,
    start: ph.start,
    end: ph.end,
    mouth: phonemeToMouth(ph.ph),
  }));
}

export function charToMouth(text: string): MouthShape {
  const lower = text.toLowerCase();
  for (const v of VOWEL_PRIORITY) {
    if (lower.includes(v)) {
      return v.toUpperCase() as MouthShape;
    }
  }
  return 'closed';
}

export function wordsToMouthPoints(
  words: Array<{ text: string; start: number; end: number }>
): Array<{ char: string; start: number; end: number; mouth: MouthShape }> {
  return words.map((w) => ({
    char: w.text.trim(),
    start: w.start,
    end: w.end,
    mouth: charToMouth(w.text.trim()),
  }));
}
