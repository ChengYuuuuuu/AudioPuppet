import { useState, useRef, useEffect, useCallback } from 'react';
import { CanvasPreview, RightPanel, DebugPanel } from './components/Panel';
import { AudioEngine, updateBounce } from './utils/audio';
import { parseLRC, getCurrentLyric } from './utils/api';
import { loadImage } from './utils/renderer';
import { saveUIConfig, loadUIConfig, loadBaseImage, loadMouthImages, loadAssetTransforms, saveAssetTransforms } from './utils/storage';
import { analyzeSofaUrl } from './utils/sofa';
import { phonemesToMouthPoints } from './utils/mouthMapper';
import {
  type LyricLine,
  type CharacterAssets,
  type UIConfig,
  type PlaybackState,
  type MouthShape,
  type MouthImages,
  type MouthPoint,
  type BounceState,
  type AssetTransform,
} from './types/index';
import './styles/app.css';

import tetoBase from './assets/teto-底.png';
import tetoA from './assets/teto-a.png';
import tetoE from './assets/teto-e.png';
import tetoI from './assets/teto-i.png';
import tetoO from './assets/teto-o.png';
import tetoU from './assets/teto-u.png';
import tetoClosed from './assets/teto-closed.png';

const defaultMouthImages: MouthImages = {
  A: tetoA, E: tetoE, I: tetoI, O: tetoO, U: tetoU, closed: tetoClosed,
};

const defaultAssets: CharacterAssets = {
  baseImage: tetoBase,
  mouthImages: { ...defaultMouthImages },
};

export default function App() {
  const [config, setConfig] = useState<UIConfig>(() => {
    const loaded = loadUIConfig();
    return loaded;
  });

  const [assets, setAssets] = useState<CharacterAssets>(() => ({
    ...defaultAssets,
    mouthImages: { ...defaultAssets.mouthImages },
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
  const [beatTimes, setBeatTimes] = useState<number[]>([]);
  const [currentBPM, setCurrentBPM] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [transforms, setTransforms] = useState<Record<string, AssetTransform>>({});
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  useEffect(() => {
    loadAssetTransforms().then(saved => {
      if (saved) setTransforms(saved);
    });
  }, []);

  const handleConfirmEdit = useCallback(async () => {
    await saveAssetTransforms(transforms);
    setEditMode(false);
    setSelectedAsset(null);
  }, [transforms]);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const bounceStateRef = useRef<BounceState>({ phase: 'idle', currentBeatIndex: -1, triggerTime: 0, scaleX: 1, scaleY: 1 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const whisperTimelineRef = useRef<MouthPoint[]>([]);
  const beatTimesRef = useRef<number[]>([]);
  const configRef = useRef(config);
  const energyHistoryRef = useRef<number[]>([]);
  configRef.current = config;
  beatTimesRef.current = beatTimes;

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
      for (const key of ['A', 'E', 'I', 'O', 'U', 'closed'] as const) {
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
      const energy = audioData.energy;
      setPlaybackState((prev) => ({
        ...prev,
        currentTime,
        energy,
        duration: engine.getDuration(),
      }));

      energyHistoryRef.current = [...energyHistoryRef.current.slice(-299), energy];

      let mouth: MouthShape | null = null;
      for (const p of whisperTimelineRef.current) {
        if (p.start <= currentTime && currentTime < p.end) {
          mouth = p.mouth;
          break;
        }
      }
      setMouthShape(mouth ?? 'closed');

      const c = configRef.current;
      bounceStateRef.current = updateBounce(bounceStateRef.current, currentTime, beatTimesRef.current, c.bounceIntensity);
      setBounceScale({
        scaleX: bounceStateRef.current.scaleX,
        scaleY: bounceStateRef.current.scaleY,
      });

      const matched = getCurrentLyric(lyricsList, currentTime, c.lyricOffset);
      setPlaybackState((prev) => ({ ...prev, currentLyric: matched || null }));
    });

    engine.onPlayEnded(() => {
      setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
      setMouthShape('closed');
      bounceStateRef.current = { phase: 'idle', currentBeatIndex: -1, triggerTime: 0, scaleX: 1, scaleY: 1 };
      setBounceScale({ scaleX: 1, scaleY: 1 });
    });
  }, []);

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
      }

      if (data.audioUrl) {
        audioEngineRef.current?.destroy();
        const engine = new AudioEngine();
        audioEngineRef.current = engine;
        setupAudioEngine(engine, lyricsList);
        loadAudioToEngine(engine, data.audioUrl);

        setAnalyzing(true);
        analyzeSofaUrl(data.audioUrl, data.lyrics, 'https://music.163.com')
          .then((result) => {
            console.log('SOFA 分析结果:', result);
            if (result.success && result.phonemes) {
              const points = phonemesToMouthPoints(result.phonemes);
              console.log('口型点数:', points.length);
              whisperTimelineRef.current = points;
            }
            if (result.bpm && result.beats) {
              setCurrentBPM(result.bpm);
              setBeatTimes(result.beats);
            }
          })
          .catch((err) => console.error('SOFA 分析请求失败:', err))
          .finally(() => setAnalyzing(false));
      }
    },
    [setupAudioEngine, loadAudioToEngine]
  );

  const handleWhisperResult = useCallback((mouthPoints: MouthPoint[]) => {
    whisperTimelineRef.current = mouthPoints;
  }, []);

  const handleFileAnalyze = useCallback((result: { bpm: number | null; beats: number[]; mouthPoints: MouthPoint[] }) => {
    whisperTimelineRef.current = result.mouthPoints;
    if (result.bpm && result.beats.length > 0) {
      setCurrentBPM(result.bpm);
      setBeatTimes(result.beats);
    }
  }, []);

  const handleLyricsLoad = useCallback((lrcText: string) => {
    parseLRC(lrcText);
  }, []);

  const handleConfigChange = useCallback((partial: Partial<UIConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveUIConfig(next);
      return next;
    });
  }, []);

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
    loadBaseImage().then((saved) => {
      if (saved) setAssets((prev) => ({ ...prev, baseImage: saved }));
    });
    loadMouthImages().then((saved) => {
      if (saved) setAssets((prev) => ({ ...prev, mouthImages: { ...prev.mouthImages, ...saved } }));
    });
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
                onMouthOffsetChange={(offset) => handleConfigChange({ mouthOffset: offset })}
                transforms={transforms}
                editMode={editMode}
                selectedAsset={selectedAsset}
                onSelectAsset={setSelectedAsset}
                onEditTransform={(key, t) => setTransforms(prev => ({ ...prev, [key]: t }))}
              />
              <button
                className="canvas-edit-btn"
                onClick={() => {
                  if (editMode) {
                    handleConfirmEdit();
                  } else {
                    setEditMode(true);
                  }
                }}
              >
                {editMode ? '确认' : '编辑'}
              </button>
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
          onSongLoad={handleSongLoad}
          onLyricsLoad={handleLyricsLoad}
          onSeek={handleSeek}
          songInfo={songInfo}
          onWhisperResult={handleWhisperResult}
          onFileAnalyze={handleFileAnalyze}
          analyzing={analyzing}
          editMode={editMode}
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
        energyHistoryRef={energyHistoryRef}
        isPlaying={playbackState.isPlaying}
      />
    </div>
  );
}
