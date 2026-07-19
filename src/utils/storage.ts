import { type UIConfig, DEFAULT_UI_CONFIG, type MouthImages } from '../types/index';

const STORAGE_KEYS = {
  UI_CONFIG: 'lip-sync-ui-config',
  MOUTH_OFFSET: 'lip-sync-mouth-offset',
  MOUTH_IMAGES: 'lip-sync-mouth-images',
  BASE_IMAGE: 'lip-sync-base-image',
} as const;

export function saveUIConfig(config: Partial<UIConfig>): void {
  try {
    const existing = loadUIConfig();
    const merged = { ...existing, ...config };
    localStorage.setItem(STORAGE_KEYS.UI_CONFIG, JSON.stringify(merged));
  } catch {}
}

export function loadUIConfig(): UIConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.UI_CONFIG);
    if (data) return { ...DEFAULT_UI_CONFIG, ...JSON.parse(data) };
  } catch {}
  return { ...DEFAULT_UI_CONFIG };
}

export function saveMouthOffset(offset: { x: number; y: number }): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MOUTH_OFFSET, JSON.stringify(offset));
  } catch {}
}

export function loadMouthOffset(): { x: number; y: number } | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MOUTH_OFFSET);
    if (data) return JSON.parse(data);
  } catch {}
  return null;
}

export function saveBaseImage(dataUrl: string): void {
  try {
    const size = new Blob([dataUrl]).size;
    if (size > 4 * 1024 * 1024) {
      console.warn('Base image too large for localStorage, skipping save');
      return;
    }
    localStorage.setItem(STORAGE_KEYS.BASE_IMAGE, dataUrl);
  } catch (e) {
    console.warn('localStorage save failed (image too large?), clearing old data');
    try { localStorage.removeItem(STORAGE_KEYS.BASE_IMAGE); } catch {}
  }
}

export function loadBaseImage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.BASE_IMAGE);
  } catch {}
  return null;
}

export function saveMouthImages(images: MouthImages): void {
  try {
    const json = JSON.stringify(images);
    if (json.length > 4 * 1024 * 1024) {
      console.warn('Mouth images too large for localStorage, skipping save');
      return;
    }
    localStorage.setItem(STORAGE_KEYS.MOUTH_IMAGES, json);
  } catch (e) {
    console.warn('localStorage save failed, clearing mouth images');
    try { localStorage.removeItem(STORAGE_KEYS.MOUTH_IMAGES); } catch {}
  }
}

export function loadMouthImages(): MouthImages | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MOUTH_IMAGES);
    if (data) return JSON.parse(data);
  } catch {}
  return null;
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    try { localStorage.removeItem(key); } catch {}
  });
}
