export function parseLyricText(text: string): { original: string; translation: string } {
  for (const sep of [' // ', ' / ', '//', '/']) {
    const idx = text.indexOf(sep);
    if (idx > 0) {
      return {
        original: text.slice(0, idx).trim(),
        translation: text.slice(idx + sep.length).trim(),
      };
    }
  }
  const m = text.match(/^(.+?)[（(]([^）)]+)[）)]\s*$/);
  if (m) {
    return { original: m[1].trim(), translation: m[2].trim() };
  }
  return { original: text.trim(), translation: '' };
}
