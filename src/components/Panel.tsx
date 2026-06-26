import { useState, useCallback, forwardRef, useEffect } from 'react';
import {
  type CharacterAssets,
  type RenderMode,
  type MouthImages,
  type UIConfig,
  type PlaybackState,
  type LyricLine,
  type MouthShape,
} from '../types/index';
import { parseNeteaseSong } from '../utils/api';
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
  bounceOffset: number;
  baseImageLoaded: HTMLImageElement | null;
  mouthImagesLoaded: Record<string, HTMLImageElement | null>;
}

export const CanvasPreview = forwardRef<HTMLCanvasElement, CanvasPreviewProps>(function CanvasPreview(
  {
    assets,
    config,
    playbackState,
    mouthShape,
    bounceOffset,
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
        bassEnergy: playbackState.bassEnergy,
        mouthShape,
        bounceOffset,
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
  }, [ref, playbackState, mouthShape, bounceOffset, assets, config, baseImageLoaded, mouthImagesLoaded]);

  return (
    <canvas ref={ref as React.Ref<HTMLCanvasElement>} style={{ width: '100%', height: '100%' }} />
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
  songInfo: { title: string; artist: string; coverUrl: string } | null;
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
  songInfo,
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
    setDragTime(parseFloat(e.target.value));
  }, []);

  const handleSeekEnd = useCallback(() => {
    if (dragTime !== null) {
      audioEngine?.seek(dragTime);
      setDragTime(null);
    }
  }, [audioEngine, dragTime]);

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
        <button onClick={handleParse} disabled={loading || !url.trim()}>
          {loading ? <span className="spinner" /> : '解析'}
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
    </div>
  );
}
