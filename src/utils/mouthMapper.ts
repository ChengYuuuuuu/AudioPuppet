import type { MouthShape } from '../types';
import type { SofaPhoneme } from './sofa';

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

const PHONEME_TO_MOUTH_EN: Record<string, MouthShape> = {
  aa: 'A', ae: 'A', ah: 'E', ao: 'O', ax: 'E',
  aw: 'A', ay: 'A',
  eh: 'E', er: 'E', ey: 'E',
  ih: 'I', iy: 'I',
  ow: 'O', oy: 'U',
  uh: 'U', uw: 'U',
};

function extractVowelFromEnd(s: string): MouthShape | null {
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i].toLowerCase();
    if ('aeiou'.includes(ch)) return ch.toUpperCase() as MouthShape;
  }
  return null;
}

export function phonemeToMouth(ph: string): MouthShape {
  const en = PHONEME_TO_MOUTH_EN[ph];
  if (en) return en;
  const exact = PHONEME_TO_MOUTH[ph];
  if (exact) return exact;
  const vowel = extractVowelFromEnd(ph);
  if (vowel) return vowel;
  return 'closed';
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

