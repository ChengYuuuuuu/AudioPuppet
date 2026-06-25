import { forwardRef, useEffect, useCallback } from 'react';
import { renderFrame, type RenderContext } from '../utils/canvasRenderer';
import {
  type CharacterAssets,
  type UIConfig,
  type PlaybackState,
  type LyricLine,
  type MouthShape,
} from '../types/index';

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

const CanvasPreview = forwardRef<HTMLCanvasElement, CanvasPreviewProps>(function CanvasPreview(
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
  const animRef = useCallback(() => {
    // Animation handled by parent via state updates
  }, []);

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

export default CanvasPreview;
