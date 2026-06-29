import { useState, useRef, useEffect, useCallback } from 'react';
import { CanvasPreview, RightPanel, DebugPanel } from './components/Panel';
import { AudioEngine, mapEnergyToMouth, resetMouthMapper, updateBounce } from './utils/audio';
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
    currentLyric: null,
  });

  const [songInfo, setSongInfo] = useState<{ title: string; artist: string; coverUrl: string } | null>(null);
  const [mouthShape, setMouthShape] = useState<MouthShape>('closed');
  const [bounceScale, setBounceScale] = useState({ scaleX: 1, scaleY: 1 });
  const [beatTimes, setBeatTimes] = useState<number[]>(() => {
    const beats: number[] = [];
    for (let t = 0; t < 200; t += 60 / 128) beats.push(parseFloat(t.toFixed(3)));
    return beats;
  });
  const [currentBPM, setCurrentBPM] = useState<number | null>(128);
  const [energyHistory, setEnergyHistory] = useState<number[]>([]);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [showDebug, setShowDebug] = useState(true);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const bounceStateRef = useRef<BounceState>({ phase: 'idle', currentBeatIndex: -1, triggerTime: 0, scaleX: 1, scaleY: 1 });
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
    engine.onPlayStateChangeCallback((playing) => {
      setPlaybackState((prev) => ({ ...prev, isPlaying: playing }));
    });

    engine.onFrameUpdate((audioData, currentTime) => {
      setPlaybackState((prev) => ({
        ...prev,
        currentTime,
        energy: audioData.energy,
        duration: engine.getDuration(),
      }));

      setEnergyHistory(prev => {
        if (prev.length > 300) return [...prev.slice(-299), audioData.energy];
        return [...prev, audioData.energy];
      });

      const newMouth = mapEnergyToMouth(audioData.energy, config.sensitivity, performance.now());
      setMouthShape(newMouth);

      bounceStateRef.current = updateBounce(bounceStateRef.current, currentTime, beatTimes, config.bounceIntensity);
      setBounceScale({
        scaleX: bounceStateRef.current.scaleX,
        scaleY: bounceStateRef.current.scaleY,
      });

      const matched = getCurrentLyric(lyricsList, currentTime, config.lyricOffset);
      setPlaybackState((prev) => ({ ...prev, currentLyric: matched || null }));
    });

    engine.onPlayEnded(() => {
      setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
      setMouthShape('closed');
      bounceStateRef.current = { phase: 'idle', currentBeatIndex: -1, triggerTime: 0, scaleX: 1, scaleY: 1 };
      setBounceScale({ scaleX: 1, scaleY: 1 });
    });
  }, [config.sensitivity, config.bounceIntensity, config.lyricOffset, beatTimes]);

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
      setSongInfo({ title: data.title, artist: data.artist, coverUrl: data.coverUrl });

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

  const handleBeatData = useCallback((bpm: number, beats: number[]) => {
    setCurrentBPM(bpm);
    setBeatTimes(beats);
    nextBeatIndexRef.current = 0;
  }, []);

  const handleLyricsLoad = useCallback((lrcText: string) => {
    setLyrics(parseLRC(lrcText));
  }, []);

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

  const handleSeek = useCallback((time: number) => {
    setPlaybackState((prev) => ({ ...prev, currentTime: time }));
    let newIndex = -1;
    for (let i = 0; i < beatTimes.length; i++) {
      if (beatTimes[i] <= time) newIndex = i;
      else break;
    }
    bounceStateRef.current = {
      phase: 'idle',
      currentBeatIndex: newIndex,
      triggerTime: 0,
      scaleX: 1,
      scaleY: 1,
    };
  }, [beatTimes]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        setShowDebug(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-container">
      <div className="main-layout">
        <div className="canvas-area">
          <div className="canvas-wrap">
            <div className="canvas-frame">
              <CanvasPreview
                ref={canvasRef}
                audioEngine={audioEngineRef.current}
                assets={assets}
                config={config}
                playbackState={playbackState}
                mouthShape={mouthShape}
                bounceScale={bounceScale}
                baseImageLoaded={baseImageLoaded}
                mouthImagesLoaded={mouthImagesLoaded}
              />
            </div>
          </div>
        </div>
        <RightPanel
          audioEngine={audioEngineRef.current}
          playbackState={playbackState}
          config={config}
          onConfigChange={handleConfigChange}
          canvasRef={canvasRef}
          assets={assets}
          onAssetsChange={handleAssetsChange}
          onModeChange={handleModeChange}
          onSongLoad={handleSongLoad}
          onLyricsLoad={handleLyricsLoad}
          onSeek={handleSeek}
          songInfo={songInfo}
        />
      </div>

      <DebugPanel
        show={showDebug}
        onClose={() => setShowDebug(false)}
        bpm={currentBPM}
        energy={playbackState.energy}
        currentTime={playbackState.currentTime}
        duration={playbackState.duration}
        beatTimes={beatTimes}
        nextBeatIndex={bounceStateRef.current.currentBeatIndex}
        mouthShape={mouthShape}
        bounceScale={bounceScale}
        energyHistory={energyHistory}
        isPlaying={playbackState.isPlaying}
      />
    </div>
  );
}
