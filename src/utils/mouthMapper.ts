import type { MouthShape } from '../types';

const VOWEL_PRIORITY = ['a', 'e', 'o', 'i', 'u'];

export function charToMouth(text: string): MouthShape {
  const lower = text.toLowerCase();
  for (const v of VOWEL_PRIORITY) {
    if (lower.includes(v)) {
      return v.toUpperCase() as MouthShape;
    }
  }
  return 'closed';
}
