import { type PlaybackState, type UIConfig } from '../types/index';
import { AudioEngine } from '../utils/audioEngine';
import { exportVideo, exportGIF, downloadBlob } from '../utils/exporters';
import { useState, useCallback, useRef } from 'react';

interface RightPanelProps {
  audioEngine: AudioEngine | null;
  playbackState: PlaybackState;
  config: UIConfig;
  onConfigChange: (config: Partial<UIConfig>) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export default function RightPanel({
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
      {/* Playback Controls */}
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

      {/* Progress */}
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

      {/* Parameters */}
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

      {/* Background */}
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

      {/* Export */}
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
