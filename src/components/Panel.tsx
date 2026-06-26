import { useState, useCallback, forwardRef, useEffect, useRef } from 'react';
import {
  type CharacterAssets,
  type RenderMode,
  type MouthImages,
  type UIConfig,
  type PlaybackState,
  type LyricLine,
  type MouthShape,
} from '../types/index';
import { parseNeteaseSong, extractSongId } from '../utils/api';
import { saveBaseImage, saveMouthImages, loadMouthOffset } from '../utils/storage';
import { renderFrame, type RenderContext } from '../utils/renderer';
import { AudioEngine } from '../utils/audio';
import { exportVideo, exportGIF, downloadBlob } from '../utils/renderer';

// ── LeftPanel ──

interface LeftPanelProps {
  assets: CharacterAssets;
  onAssetsChange: (assets: CharacterAssets) => void;
  config: { renderMode: RenderMode };
  onModeChange: (mode: RenderMode) => void;
  onSongLoad: (data: { title: string; artist: string; coverUrl: string; audioUrl: string; lyrics: string }) => void;
  onLyricsLoad: (lrcText: string) => void;
  onLocalAudioLoad: (file: File) => void;
}

const MOUTH_KEYS: (keyof MouthImages)[] = ['A', 'E', 'I', 'O', 'U'];

export function LeftPanel({
  assets,
  onAssetsChange,
  config,
  onModeChange,
  onSongLoad,
  onLyricsLoad,
  onLocalAudioLoad,
}: LeftPanelProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [songInfo, setSongInfo] = useState<{
    title: string;
    artist: string;
    coverUrl: string;
  } | null>(null);

  const handleParse = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');

    const result = await parseNeteaseSong(url);
    if (result.success && result.data) {
      setSongInfo({
        title: result.data.title,
        artist: result.data.artist,
        coverUrl: result.data.coverUrl,
      });
      onSongLoad(result.data);
      onLyricsLoad(result.data.lyrics);
    } else {
      setError(result.error || '解析失败');
    }
    setLoading(false);
  }, [url, onSongLoad, onLyricsLoad]);

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

  return (
    <div className="left-panel">
      <div className="panel-section">
        <h3>渲染模式</h3>
        <div className="mode-switcher">
          {(['L1', 'L2', 'L3'] as RenderMode[]).map((mode) => (
            <button
              key={mode}
              className={`mode-btn ${config.renderMode === mode ? 'active' : ''}`}
              onClick={() => onModeChange(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3>网易云音乐</h3>
        <div className="input-group">
          <input
            type="url"
            placeholder="粘贴网易云歌曲链接..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="btn btn-primary btn-full"
            onClick={handleParse}
            disabled={loading || !url.trim()}
          >
            {loading ? <><span className="spinner" /> 解析中...</> : '解析'}
          </button>
        </div>
        {error && <div style={{ color: '#f44336', fontSize: 12 }}>{error}</div>}
        {songInfo && (
          <div className="song-info">
            {songInfo.coverUrl && <img src={songInfo.coverUrl} alt="" />}
            <div className="details">
              <div className="title">{songInfo.title}</div>
              <div className="artist">{songInfo.artist}</div>
            </div>
          </div>
        )}
      </div>

      <div className="panel-section">
        <h3>本地音频</h3>
        <div className="file-upload">
          <label className="file-upload-label">
            上传 MP3 文件
            <input
              type="file"
              accept="audio/mp3,audio/mpeg,audio/wav"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onLocalAudioLoad(file);
              }}
            />
          </label>
        </div>
      </div>

      {(config.renderMode === 'L2' || config.renderMode === 'L3') && (
        <div className="panel-section">
          <h3>角色底图</h3>
          <div className="file-upload">
            <label
              className={`file-upload-label ${assets.baseImage ? 'uploaded' : ''}`}
            >
              {assets.baseImage ? '已上传 ✓' : '上传 PNG 底图'}
              <input type="file" accept="image/png,image/jpeg" onChange={handleBaseImageUpload} />
            </label>
          </div>
        </div>
      )}

      {config.renderMode === 'L3' && (
        <div className="panel-section">
          <h3>口型图 (PNG)</h3>
          {MOUTH_KEYS.map((key) => (
            <div className="file-upload" key={key}>
              <label
                className={`file-upload-label ${assets.mouthImages[key] ? 'uploaded' : ''}`}
              >
                {assets.mouthImages[key] ? `${key} ✓` : `${key}.png`}
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleMouthUpload(key)}
                />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    <div className="canvas-wrapper">
      <canvas ref={ref as React.Ref<HTMLCanvasElement>} style={{ width: '100%', height: '100%' }} />
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
}

export function RightPanel({
  audioEngine,
  playbackState,
  config,
  onConfigChange,
  canvasRef,
}: RightPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handlePlayPause = useCallback(() => {
    if (!audioEngine) return;
    if (playbackState.isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  }, [audioEngine, playbackState.isPlaying]);

  const handleStop = useCallback(() => {
    audioEngine?.stop();
  }, [audioEngine]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      audioEngine?.seek(time);
    },
    [audioEngine]
  );

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      audioEngine?.setVolume(vol);
    },
    [audioEngine]
  );

  const handleExportVideo = useCallback(async () => {
    if (!audioEngine) return;
    setExporting(true);
    setExportProgress(0);

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const duration = audioEngine.getDuration();
      const blob = await exportVideo(
        canvas,
        audioEngine.getAudioContext(),
        duration,
        (p) => setExportProgress(p)
      );
      downloadBlob(blob, 'lip-sync-video.webm');
    } catch (err) {
      console.error('导出失败:', err);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [audioEngine, canvasRef]);

  const handleExportGIF = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setExporting(true);

    try {
      const blob = await exportGIF(canvas, 3);
      if (blob) {
        downloadBlob(blob, 'lip-sync.gif');
      }
    } catch (err) {
      console.error('GIF导出失败:', err);
    } finally {
      setExporting(false);
    }
  }, [canvasRef]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="right-panel">
      <div className="panel-section">
        <h3>播放控制</h3>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={handlePlayPause}>
            {playbackState.isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </button>
          <button className="btn btn-secondary" onClick={handleStop}>
            ⏹ 停止
          </button>
        </div>

        <div className="slider-group">
          <label>音量</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={playbackState.volume}
            onChange={handleVolume}
          />
        </div>
      </div>

      <div className="panel-section">
        <h3>进度</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>
            {formatTime(playbackState.currentTime)}
          </span>
          <input
            type="range"
            className="progress-bar"
            min="0"
            max={playbackState.duration || 1}
            step="0.1"
            value={playbackState.currentTime}
            onChange={handleSeek}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>
            {formatTime(playbackState.duration)}
          </span>
        </div>
      </div>

      <div className="panel-section">
        <h3>参数调节</h3>
        <div className="slider-group">
          <label>口型灵敏度 <span>{config.sensitivity.toFixed(1)}</span></label>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={config.sensitivity}
            onChange={(e) => onConfigChange({ sensitivity: parseFloat(e.target.value) })}
          />
        </div>
        <div className="slider-group">
          <label>弹跳幅度 <span>{config.bounceIntensity.toFixed(1)}</span></label>
          <input
            type="range"
            min="0.3"
            max="1.0"
            step="0.1"
            value={config.bounceIntensity}
            onChange={(e) => onConfigChange({ bounceIntensity: parseFloat(e.target.value) })}
          />
        </div>
        <div className="slider-group">
          <label>歌词偏移 <span>{config.lyricOffset}ms</span></label>
          <input
            type="range"
            min="-500"
            max="500"
            step="50"
            value={config.lyricOffset}
            onChange={(e) => onConfigChange({ lyricOffset: parseInt(e.target.value) })}
          />
        </div>
      </div>

      <div className="panel-section">
        <h3>背景</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['#1a1a2e', '#16213e', '#0f3460', '#533483', '#1a1a1a', '#2d2d2d', '#3d3d3d'].map(
            (color) => (
              <button
                key={color}
                onClick={() => onConfigChange({ backgroundColor: color })}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: color,
                  border: config.backgroundColor === color ? '2px solid #FF6B6B' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            )
          )}
        </div>
      </div>

      <div className="panel-section">
        <h3>导出</h3>
        <button
          className="export-btn"
          onClick={handleExportVideo}
          disabled={exporting || !audioEngine}
        >
          {exporting
            ? `导出中 ${Math.round(exportProgress * 100)}%`
            : '🎬 导出 WebM'}
        </button>
        <button
          className="btn btn-secondary btn-full"
          onClick={handleExportGIF}
          disabled={exporting}
          style={{ marginTop: 6 }}
        >
          {exporting ? '导出中...' : '🎞 导出 GIF'}
        </button>
      </div>
    </div>
  );
}

// ── StatusBar ──

interface StatusBarProps {
  renderMode: RenderMode;
  playbackState: PlaybackState;
}

export function StatusBar({ renderMode, playbackState }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span>层级: {renderMode}</span>
      <span>|</span>
      <span>状态: {playbackState.isPlaying ? '▶ 播放中' : '⏸ 暂停'}</span>
      <span>|</span>
      <span>能量: {Math.round(playbackState.energy)}</span>
      <span>|</span>
      <span>低频: {Math.round(playbackState.bassEnergy)}</span>
    </div>
  );
}
