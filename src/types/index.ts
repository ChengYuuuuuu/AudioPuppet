export interface LyricLine {
  time: number;
  text: string;
}

export interface SongData {
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  lyrics: LyricLine[];
}

export interface MouthImages {
  A: string | null;
  E: string | null;
  I: string | null;
  O: string | null;
  U: string | null;
  closed: string | null;
}

export interface CharacterAssets {
  baseImage: string | null;
  mouthImages: MouthImages;
}

export type MouthShape = 'A' | 'E' | 'I' | 'O' | 'U' | 'closed';
export type RenderMode = 'L3';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  energy: number;
  currentLyric: LyricLine | null;
}

export interface UIConfig {
  renderMode: RenderMode;
  mouthOffset: { x: number; y: number };
  sensitivity: number;
  bounceIntensity: number;
  lyricOffset: number;
  backgroundColor: string;
}

export interface BounceState {
  phase: 'idle' | 'compress' | 'hold' | 'release';
  currentBeatIndex: number;
  triggerTime: number;
  scaleX: number;
  scaleY: number;
}

export interface AudioAnalyserData {
  energy: number;
  frequencyData: Uint8Array;
}

export const DEFAULT_MOUTH_OFFSET = { x: 0, y: -60 };

export const DEFAULT_UI_CONFIG: UIConfig = {
  renderMode: 'L3',
  mouthOffset: { ...DEFAULT_MOUTH_OFFSET },
  sensitivity: 1.0,
  bounceIntensity: 0.6,
  lyricOffset: 0,
  backgroundColor: '#1a1a2e',
};

export const MOUTH_THRESHOLDS = {
  closed: 20,
  E: 45,
  A: 70,
  random: 85,
  O: 256,
};

export const MOUTH_LABELS: Record<string, string> = {
  A: 'A',
  E: 'E',
  I: 'I',
  O: 'O',
  U: 'U',
};

export const MOUTH_SHAPES: MouthShape[] = ['A', 'E', 'I', 'O', 'U'];
