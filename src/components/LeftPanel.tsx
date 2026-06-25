import { useState, useCallback } from 'react';
import { type CharacterAssets, type RenderMode, type MouthImages } from '../types/index';
import { parseNeteaseSong, extractSongId } from '../utils/neteaseApi';
import { saveBaseImage, saveMouthImages, loadMouthOffset } from '../utils/storage';

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

export default function LeftPanel({
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
      {/* Mode Switcher */}
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

      {/* Song URL */}
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

      {/* Local audio fallback */}
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

      {/* L2/L3: Base Image */}
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

      {/* L3: Mouth Images */}
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
