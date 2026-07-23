import {
  type MouthShape,
  type CharacterAssets,
  type UIConfig,
  type LyricLine,
} from '../types/index';
// ── Canvas Renderer ──

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  energy: number;
  mouthShape: MouthShape;
  bounceScale: { scaleX: number; scaleY: number };
  currentLyric: LyricLine | null;
  assets: CharacterAssets;
  config: UIConfig;
  mouthImagesLoaded: Record<string, HTMLImageElement | null>;
  baseImageLoaded: HTMLImageElement | null;
  prevLyric: LyricLine | null;
  lyricTransition: number;
}

export function renderFrame(r: RenderContext): void {
  const { ctx, width, height } = r;
  ctx.clearRect(0, 0, width, height);

  drawBackground(ctx, width, height);
  drawCharacter(r);
  drawHUD(r);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
}

function drawCharacter(r: RenderContext): void {
  const { ctx, width, height } = r;
  ctx.save();
  const centerX = width * 0.25;
  const centerY = height / 2 - 40;
  const { scaleX, scaleY } = r.bounceScale;

  const charH = r.baseImageLoaded ? r.baseImageLoaded.height : 200;
  const bottomY = centerY + charH / 2;
  ctx.translate(centerX, bottomY);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-centerX, -bottomY);

  drawL3Character(r, centerX, centerY);

  ctx.restore();
}

function drawL3Character(r: RenderContext, cx: number, cy: number): void {
  const { ctx } = r;
  const img = r.baseImageLoaded;
  if (img) {
    const maxDim = 400;
    let w = img.width;
    let h = img.height;
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w *= scale;
      h *= scale;
    }
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);

    const mouthImg = r.mouthImagesLoaded[r.mouthShape] ?? null;

    if (mouthImg) {
      const faceRegionSize = Math.min(w, h) * 0.8;
      const mw = faceRegionSize;
      const mh = (mouthImg.height / mouthImg.width) * mw;
      ctx.drawImage(
        mouthImg,
        cx + r.config.mouthOffset.x - mw / 2,
        cy + r.config.mouthOffset.y - mh / 2,
        mw,
        mh
      );
    }
  }
}

function drawHUD(r: RenderContext): void {
  const { ctx } = r;

  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'left';

  const energyText = `能量: ${Math.round(r.energy)}`;
  const mouthText = `口型: ${r.mouthShape}`;

  ctx.fillText(`${energyText} | ${mouthText}`, 10, 20);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}
