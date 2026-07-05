import { useState, useCallback, forwardRef, useEffect, useRef, useLayoutEffect } from 'react';
import {
  type CharacterAssets,
  type RenderMode,
  type MouthImages,
  type UIConfig,
  type PlaybackState,
  type LyricLine,
  type MouthShape,
  type MouthPoint,
} from '../types/index';
import { parseNeteaseSong } from '../utils/api';
import { analyzeAudioBlob, wordsToMouthPoints } from '../utils/whisper';
import { saveBaseImage, saveMouthImages } from '../utils/storage';
import { renderFrame, type RenderContext } from '../utils/renderer';
import { AudioEngine } from '../utils/audio';

// ── CanvasPreview ──

interface CanvasPreviewProps {
  audioEngine: unknown;
  assets: CharacterAssets;
  config: UIConfig;
  playbackState: PlaybackState;
  mouthShape: MouthShape;
  bounceScale: { scaleX: number; scaleY: number };
  baseImageLoaded: HTMLImageElement | null;
  mouthImagesLoaded: Record<string, HTMLImageElement | null>;
}

function parseLyricText(text: string): { original: string; translation: string } {
  const separators = [' // ', ' / ', '//', '/'];
  for (const sep of separators) {
    const idx = text.indexOf(sep);
    if (idx > 0) {
      return {
        original: text.slice(0, idx).trim(),
        translation: text.slice(idx + sep.length).trim().replace(/^[（(【]|[）)】]$/g, '').trim(),
      };
    }
  }
  return { original: text, translation: '' };
}

export const CanvasPreview = forwardRef<HTMLCanvasElement, CanvasPreviewProps>(function CanvasPreview(
  {
    assets,
    config,
    playbackState,
    mouthShape,
    bounceScale,
    baseImageLoaded,
    mouthImagesLoaded,
  }: CanvasPreviewProps,
  ref
) {
  useEffect(() => {
    const canvas = (ref as React.RefObject<HTMLCanvasElement | null>).current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width * dpr;
    const h = rect.height * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    let running = true;
    let prevLyric: LyricLine | null = null;
    let lyricTransition = 1;
    let lyricTimer = 0;

    const frame = (now: number) => {
      if (!running) return;

      const rect2 = canvas.getBoundingClientRect();
      if (canvas.width !== rect2.width * dpr || canvas.height !== rect2.height * dpr) {
        canvas.width = rect2.width * dpr;
        canvas.height = rect2.height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const currentLyric = playbackState.currentLyric;
      if (currentLyric && currentLyric !== prevLyric) {
        prevLyric = currentLyric;
        lyricTransition = 0;
        lyricTimer = now;
      }

      if (lyricTransition < 1) {
        const elapsed = now - lyricTimer;
        lyricTransition = Math.min(elapsed / 300, 1);
      }

      const rc: RenderContext = {
        ctx,
        width: rect2.width,
        height: rect2.height,
        time: playbackState.currentTime,
        energy: playbackState.energy,
        mouthShape,
        bounceScale,
        currentLyric,
        assets,
        config,
        mouthImagesLoaded,
        baseImageLoaded,
        prevLyric: null,
        lyricTransition,
      };

      renderFrame(rc);
      ctx.resetTransform();

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);

    return () => { running = false; };
  }, [ref, playbackState, mouthShape, bounceScale, assets, config, baseImageLoaded, mouthImagesLoaded]);

  const itemIdRef = useRef(0);
  const prevLyricRef = useRef<LyricLine | null>(null);
  const [lyricItems, setLyricItems] = useState<Array<{
    id: number;
    original: string;
    translation: string;
    level: number;
    entering: boolean;
  }>>([]);

  useEffect(() => {
    const current = playbackState.currentLyric;
    if (!current || current === prevLyricRef.current) return;
    prevLyricRef.current = current;

    const { original, translation } = parseLyricText(current.text);
    const id = ++itemIdRef.current;

    setLyricItems(prev => {
      const updated = prev
        .map(item => ({ ...item, level: item.level + 1 }))
        .filter(item => item.level <= 4);
      return [...updated, { id, original, translation, level: 0, entering: true }];
    });

    requestAnimationFrame(() => {
      setLyricItems(prev =>
        prev.map(item => item.id === id ? { ...item, entering: false } : item)
      );
    });
  }, [playbackState.currentLyric]);

  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [bottoms, setBottoms] = useState<Record<number, number>>({});

  useLayoutEffect(() => {
    const sorted = [...lyricItems].sort((a, b) => a.level - b.level);
    let cum = 0;
    const newBottoms: Record<number, number> = {};
    for (const item of sorted) {
      const el = itemRefs.current.get(item.id);
      const h = el ? el.offsetHeight : 60;
      newBottoms[item.id] = cum;
      cum += h + 20;
    }

    let changed = Object.keys(bottoms).length !== Object.keys(newBottoms).length;
    if (!changed) {
      for (const [id, val] of Object.entries(newBottoms)) {
        if (bottoms[Number(id)] !== val) { changed = true; break; }
      }
    }

    if (changed) setBottoms(newBottoms);
  }, [lyricItems, bottoms]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={ref as React.Ref<HTMLCanvasElement>} style={{ width: '100%', height: '100%', display: 'block' }} />
      {lyricItems.length > 0 && (
        <div className="lyric-container">
          {lyricItems.map(item => (
            <div
              key={item.id}
              ref={el => { if (el) itemRefs.current.set(item.id, el); }}
              className={`lyric-item level-${item.level}${item.entering ? ' entering' : ''}`}
              style={{ bottom: bottoms[item.id] ?? 0 }}
            >
              <div className="lyric-original">{item.original}</div>
              {item.translation && <div className="lyric-translated">{item.translation}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ── RightPanel ──

interface RightPanelProps {
  audioEngine: AudioEngine | null;
  playbackState: PlaybackState;
  config: UIConfig;
  onConfigChange: (config: Partial<UIConfig>) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  assets: CharacterAssets;
  onAssetsChange: (assets: CharacterAssets) => void;
  onModeChange: (mode: RenderMode) => void;
  onSongLoad: (data: { title: string; artist: string; coverUrl: string; audioUrl: string; lyrics: string }) => void;
  onLyricsLoad: (lrcText: string) => void;
  onSeek: (time: number) => void;
  onWhisperResult: (mouthPoints: MouthPoint[]) => void;
  onFileAnalyze: (result: { bpm: number | null; beats: number[]; mouthPoints: MouthPoint[] }) => void;
  songInfo: { title: string; artist: string; coverUrl: string } | null;
  analyzing?: boolean;
}

const MOUTH_KEYS: (keyof MouthImages)[] = ['A', 'E', 'I', 'O', 'U'];

export function RightPanel({
  audioEngine,
  playbackState,
  config,
  onConfigChange,
  assets,
  onAssetsChange,
  onModeChange,
  onSongLoad,
  onLyricsLoad,
  onSeek,
  onWhisperResult,
  onFileAnalyze,
  songInfo,
  analyzing,
}: RightPanelProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragTime, setDragTime] = useState<number | null>(null);

  const handleParse = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    const result = await parseNeteaseSong(url);
    if (result.success && result.data) {
      onSongLoad(result.data);
      onLyricsLoad(result.data.lyrics);
    } else {
      setError(result.error || '解析失败');
    }
    setLoading(false);
  }, [url, onSongLoad, onLyricsLoad]);

  const handlePlayPause = useCallback(() => {
    if (!audioEngine) return;
    if (playbackState.isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  }, [audioEngine, playbackState.isPlaying]);

  const handleSeekDrag = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    audioEngine?.seek(value);
    setDragTime(value);
  }, [audioEngine]);

  const handleSeekEnd = useCallback(() => {
    if (dragTime !== null) {
      onSeek(dragTime);
      audioEngine?.seek(dragTime);
      setDragTime(null);
    }
  }, [audioEngine, dragTime, onSeek]);

  const handleBaseImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        saveBaseImage(dataUrl);
        onAssetsChange({ ...assets, baseImage: dataUrl });
      };
      reader.readAsDataURL(file);
    },
    [assets, onAssetsChange]
  );

  const handleMouthUpload = useCallback(
    (key: keyof MouthImages) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const newMouthImages = { ...assets.mouthImages, [key]: dataUrl };
        saveMouthImages(newMouthImages);
        onAssetsChange({ ...assets, mouthImages: newMouthImages });
      };
      reader.readAsDataURL(file);
    },
    [assets, onAssetsChange]
  );

  const [fileAnalyzing, setFileAnalyzing] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileAnalyzing(true);
    console.log('📁 上传文件:', file.name);
    const result = await analyzeAudioBlob(file);
    console.log('🔍 文件分析结果:', result);
    if (result.success && result.words) {
      const mouthPoints = wordsToMouthPoints(result.words);
      onWhisperResult(mouthPoints);
      onFileAnalyze({ bpm: result.bpm ?? null, beats: result.beats ?? [], mouthPoints });
    } else {
      console.error('❌ 文件分析失败:', result);
    }
    setFileAnalyzing(false);
    e.target.value = '';
  }, [onWhisperResult, onFileAnalyze]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="right-panel">
      <div className="right-panel-logo">对口型</div>

      {/* 1. Song Import */}
      <div className="song-import">
        <input
          type="url"
          placeholder="网易云链接..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button onClick={handleParse} disabled={loading || analyzing || !url.trim()}>
          {loading ? <span className="spinner" /> : analyzing ? <span className="spinner" /> : '解析'}
        </button>
      </div>
      {error && <div className="error-text">{error}</div>}

      {/* 2. Cover */}
      <div className="cover-box">
        {songInfo?.coverUrl ? (
          <img src={songInfo.coverUrl} alt="" />
        ) : (
          <div className="cover-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span>No Song</span>
          </div>
        )}
      </div>

      {/* 3. Song Info */}
      <div className="song-info-right">
        <div className="title font-title">{songInfo?.title || '—'}</div>
        <div className="artist">{songInfo?.artist || '—'}</div>
      </div>

      {/* 4. Progress + Time */}
      <div className="progress-row">
        <span className="time">{formatTime(dragTime !== null ? dragTime : playbackState.currentTime)}</span>
        <input
          type="range"
          className="progress-bar"
          min="0"
          max={playbackState.duration || 1}
          step="0.1"
          value={dragTime !== null ? dragTime : playbackState.currentTime}
          onChange={handleSeekDrag}
          onMouseUp={handleSeekEnd}
          onTouchEnd={handleSeekEnd}
        />
        <span className="time">{formatTime(playbackState.duration)}</span>
      </div>

      {/* 5. Play Button */}
      <div className="play-btn-wrap">
        <button className="play-btn-big" onClick={handlePlayPause}>
          {playbackState.isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
      </div>

      {/* 6. Mode Dots */}
      <div>
        <div className="mode-dots">
          {(['L1', 'L2', 'L3'] as RenderMode[]).map((mode) => (
            <button
              key={mode}
              className={`mode-dot ${config.renderMode === mode ? 'active' : ''}`}
              onClick={() => onModeChange(mode)}
              title={mode}
            />
          ))}
        </div>
        <div className="mode-label">{config.renderMode}</div>
      </div>

      {/* 7. Sliders */}
      <div className="sliders-compact">
        <div className="slider-row">
          <label>灵敏度</label>
          <input
            type="range" min="0.5" max="1.5" step="0.1"
            value={config.sensitivity}
            onChange={(e) => onConfigChange({ sensitivity: parseFloat(e.target.value) })}
          />
          <span className="val">{config.sensitivity.toFixed(1)}</span>
        </div>
        <div className="slider-row">
          <label>弹跳</label>
          <input
            type="range" min="0.3" max="1.0" step="0.1"
            value={config.bounceIntensity}
            onChange={(e) => onConfigChange({ bounceIntensity: parseFloat(e.target.value) })}
          />
          <span className="val">{config.bounceIntensity.toFixed(1)}</span>
        </div>
        <div className="slider-row">
          <label>歌词偏移</label>
          <input
            type="range" min="-500" max="500" step="50"
            value={config.lyricOffset}
            onChange={(e) => onConfigChange({ lyricOffset: parseInt(e.target.value) })}
          />
          <span className="val">{config.lyricOffset}</span>
        </div>
      </div>

      {/* 8. Asset Uploads */}
      {config.renderMode !== 'L1' && (
        <div className="asset-section">
          <div className="label">角色素材</div>
          <div className="asset-btns">
            <label className={`asset-btn ${assets.baseImage ? 'uploaded' : ''}`}>
              {assets.baseImage ? '底图 ✓' : '角色底图'}
              <input type="file" accept="image/png,image/jpeg" onChange={handleBaseImageUpload} />
            </label>
            {config.renderMode === 'L3' && MOUTH_KEYS.map((key) => (
              <label key={key} className={`asset-btn ${assets.mouthImages[key] ? 'uploaded' : ''}`}>
                {assets.mouthImages[key] ? `${key} ✓` : key}
                <input type="file" accept="image/png" onChange={handleMouthUpload(key)} />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 9. File Upload */}
      <div className="asset-section">
        <div className="label">上传音频测试</div>
        <div className="asset-btns">
          <label className={`asset-btn ${fileAnalyzing ? '' : ''}`}>
            {fileAnalyzing ? '🎵 分析中...' : '📁 选择音频文件'}
            <input type="file" accept="audio/*" onChange={handleFileUpload} disabled={fileAnalyzing} />
          </label>
        </div>
      </div>
    </div>
  );
}

// ── DebugPanel ──

interface DebugPanelProps {
  show: boolean;
  onClose: () => void;
  bpm: number | null;
  energy: number;
  currentTime: number;
  duration: number;
  beatTimes: number[];
  nextBeatIndex: number;
  mouthShape: MouthShape;
  bounceScale: { scaleX: number; scaleY: number };
  energyHistory: number[];
  isPlaying: boolean;
}

export function DebugPanel({
  show, onClose, bpm, energy, currentTime, duration,
  beatTimes, nextBeatIndex, mouthShape, bounceScale, energyHistory, isPlaying,
}: DebugPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.scale(dpr, dpr);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Time window: last 5 seconds
    const windowSec = 5;
    const tStart = Math.max(0, currentTime - windowSec);
    const tEnd = currentTime + 0.5;

    const toX = (t: number) => ((t - tStart) / (tEnd - tStart)) * W;

    // Draw beat markers
    for (const bt of beatTimes) {
      if (bt < tStart || bt > tEnd) continue;
      const x = toX(bt);
      const isNext = bt === beatTimes[nextBeatIndex];
      ctx.fillStyle = isNext ? 'rgba(255,217,61,0.5)' : 'rgba(255,107,107,0.25)';
      ctx.fillRect(x - 1, 0, 2, H);
    }

    // Draw energy waveform
    if (energyHistory.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#4A90D9';
      ctx.lineWidth = 1.5;
      const step = windowSec / energyHistory.length;
      for (let i = 0; i < energyHistory.length; i++) {
        const t = tStart + i * step;
        const x = toX(t);
        const norm = energyHistory[i] / 255;
        const y = H - 4 - norm * (H - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw progress line
    const px = toX(currentTime);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();

    // Label on progress line
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(formatTime(currentTime), px, H - 2);
  }, [energyHistory, currentTime, beatTimes, nextBeatIndex]);

  if (!show) return null;

  const nextBeat = nextBeatIndex >= 0 && nextBeatIndex < beatTimes.length ? beatTimes[nextBeatIndex] : null;
  const beatCount = beatTimes.length;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#0d1117', color: '#c9d1d9',
      fontFamily: 'monospace', fontSize: 11,
      zIndex: 999, borderTop: '1px solid #30363d',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '4px 12px', borderBottom: '1px solid #30363d',
        background: '#161b22',
      }}>
        <span style={{ color: isPlaying ? '#3fb950' : '#8b949e' }}>
          {isPlaying ? '▶ 播放中' : '⏸ 暂停'}
        </span>
        <span>BPM: <b style={{ color: '#ffa657' }}>{bpm?.toFixed(1) ?? '—'}</b></span>
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        <span>🔵 节拍: {beatCount}</span>
        <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#f88' }} onClick={onClose}>✕</span>
      </div>

      {/* Waveform canvas */}
      <div style={{ height: 80, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {/* Bottom numerical values */}
      <div style={{
        display: 'flex', gap: 16, padding: '3px 12px',
        borderTop: '1px solid #30363d', color: '#8b949e',
      }}>
        <span>当前: <b style={{ color: '#c9d1d9' }}>{formatTime(currentTime)}</b></span>
        <span>下一拍: <b style={{ color: nextBeat !== null ? '#ffd93d' : '#8b949e' }}>
          {nextBeat !== null ? nextBeat.toFixed(2) + 's' : '—'}
        </b></span>
        <span>能量: <b style={{ color: '#4A90D9' }}>{Math.round(energy)}</b></span>
        <span>口型: <b style={{ color: '#ff6b6b' }}>{mouthShape}</b></span>
        <span>弹跳: <b style={{ color: bounceScale.scaleY < 0.98 ? '#3fb950' : '#8b949e' }}>
          {bounceScale.scaleY < 0.98 ? '💥 压缩' : '静止'}
        </b></span>
        <span>节拍索引: <b style={{ color: '#c9d1d9' }}>{nextBeatIndex}/{beatCount}</b></span>
      </div>
    </div>
  );
}
