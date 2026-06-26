import { useState, useRef, useEffect, useCallback } from 'react';
import { CanvasPreview, LeftPanel, RightPanel, StatusBar } from './components/Panel';
import { AudioEngine, mapEnergyToMouth, resetMouthMapper, createBounceState, updateBounce, detectBassPeak } from './utils/audio';
import { parseLRC, getCurrentLyric } from './utils/api';
import { loadImage } from './utils/renderer';
import { saveUIConfig, loadUIConfig, loadBaseImage, loadMouthImages } from './utils/storage';
import {
  type LyricLine,
  type CharacterAssets,
  type UIConfig,
  type PlaybackState,
  type MouthShape,
  type MouthImages,
  type RenderMode,
} from './types/index';
import './styles/app.css';

const defaultMouthImages: MouthImages = { A: null, E: null, I: null, O: null, U: null };

export default function App() {
  const [config, setConfig] = useState<UIConfig>(() => {
    const loaded = loadUIConfig();
    return loaded;
  });

  const [assets, setAssets] = useState<CharacterAssets>(() => ({
    baseImage: loadBaseImage(),
    mouthImages: loadMouthImages() || { ...defaultMouthImages },
  }));

  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    energy: 0,
    bassEnergy: 0,
    currentLyric: null,
  });

  const [mouthShape, setMouthShape] = useState<MouthShape>('closed');
  const [bounceOffset, setBounceOffset] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const bounceStateRef = useRef(createBounceState());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [baseImageLoaded, setBaseImageLoaded] = useState<HTMLImageElement | null>(null);
  const [mouthImagesLoaded, setMouthImagesLoaded] = useState<Record<string, HTMLImageElement | null>>({});

  useEffect(() => {
    if (assets.baseImage) {
      loadImage(assets.baseImage).then(setBaseImageLoaded).catch(() => setBaseImageLoaded(null));
    } else {
      setBaseImageLoaded(null);
    }
  }, [assets.baseImage]);

  useEffect(() => {
    const loadAll = async () => {
      const loaded: Record<string, HTMLImageElement | null> = {};
      for (const key of ['A', 'E', 'I', 'O', 'U'] as const) {
        const src = assets.mouthImages[key];
        if (src) {
          try { loaded[key] = await loadImage(src); } catch { loaded[key] = null; }
        } else { loaded[key] = null; }
      }
      setMouthImagesLoaded(loaded);
    };
    loadAll();
  }, [assets.mouthImages]);

  const setupAudioEngine = useCallback((engine: AudioEngine, lyricsList: LyricLine[]) => {
    engine.onFrameUpdate((audioData, currentTime) => {
      setPlaybackState((prev) => ({
        ...prev,
        currentTime,
        energy: audioData.energy,
        bassEnergy: audioData.bassEnergy,
        duration: engine.getDuration(),
      }));

      const newMouth = mapEnergyToMouth(audioData.energy, config.sensitivity, performance.now());
      setMouthShape(newMouth);

      const peak = detectBassPeak(audioData.bassEnergy, engine.bassHistoryData);
      bounceStateRef.current = updateBounce(bounceStateRef.current, peak, config.bounceIntensity);
      setBounceOffset(bounceStateRef.current.position);

      const matched = getCurrentLyric(lyricsList, currentTime, config.lyricOffset);
      setPlaybackState((prev) => ({ ...prev, currentLyric: matched || null }));
    });

    engine.onPlayEnded(() => {
      setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
      setMouthShape('closed');
      bounceStateRef.current = createBounceState();
    });
  }, [config.sensitivity, config.bounceIntensity, config.lyricOffset]);

  const loadAudioToEngine = useCallback(async (engine: AudioEngine, url: string) => {
    try {
      await engine.loadAudio(url);
      setPlaybackState((prev) => ({ ...prev, duration: engine.getDuration() }));
    } catch {
      console.error('音频加载失败');
    }
  }, []);

  const handleSongLoad = useCallback(
    (data: { title: string; artist: string; coverUrl: string; audioUrl: string; lyrics: string }) => {
      let lyricsList: LyricLine[] = [];
      if (data.lyrics) {
        lyricsList = parseLRC(data.lyrics);
        setLyrics(lyricsList);
      }

      if (data.audioUrl) {
        const engine = new AudioEngine();
        audioEngineRef.current = engine;
        setupAudioEngine(engine, lyricsList);
        loadAudioToEngine(engine, data.audioUrl);
      }
    },
    [setupAudioEngine, loadAudioToEngine]
  );

  const handleLyricsLoad = useCallback((lrcText: string) => {
    setLyrics(parseLRC(lrcText));
  }, []);

  const handleLocalAudioLoad = useCallback(async (file: File) => {
    const engine = new AudioEngine();
    audioEngineRef.current = engine;
    setupAudioEngine(engine, lyrics);
    try {
      await engine.loadFromFile(file);
      setPlaybackState((prev) => ({ ...prev, duration: engine.getDuration() }));
    } catch {
      console.error('本地音频加载失败');
    }
  }, [setupAudioEngine, lyrics]);

  const handleConfigChange = useCallback((partial: Partial<UIConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveUIConfig(next);
      return next;
    });
  }, []);

  const handleModeChange = useCallback((mode: RenderMode) => {
    handleConfigChange({ renderMode: mode });
  }, [handleConfigChange]);

  const handleAssetsChange = useCallback((newAssets: CharacterAssets) => {
    setAssets(newAssets);
  }, []);

  useEffect(() => {
    return () => {
      audioEngineRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    audioEngineRef.current?.setVolume(playbackState.volume);
  }, [playbackState.volume]);

  useEffect(() => {
    resetMouthMapper();
  }, [config.sensitivity]);

  return (
    <div className="app-container">
      <div className="main-layout">
        <LeftPanel
          assets={assets}
          onAssetsChange={handleAssetsChange}
          config={config}
          onModeChange={handleModeChange}
          onSongLoad={handleSongLoad}
          onLyricsLoad={handleLyricsLoad}
          onLocalAudioLoad={handleLocalAudioLoad}
        />
        <div className="center-panel">
          <CanvasPreview
            ref={canvasRef}
            audioEngine={audioEngineRef.current}
            assets={assets}
            config={config}
            playbackState={playbackState}
            mouthShape={mouthShape}
            bounceOffset={bounceOffset}
            baseImageLoaded={baseImageLoaded}
            mouthImagesLoaded={mouthImagesLoaded}
          />
        </div>
        <RightPanel
          audioEngine={audioEngineRef.current}
          playbackState={playbackState}
          config={config}
          onConfigChange={handleConfigChange}
          canvasRef={canvasRef}
        />
      </div>
      <StatusBar renderMode={config.renderMode} playbackState={playbackState} />
    </div>
  );
}
