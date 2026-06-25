import {
  type RenderMode,
  type MouthShape,
  type CharacterAssets,
  type UIConfig,
  type LyricLine,
} from '../types/index';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  energy: number;
  bassEnergy: number;
  mouthShape: MouthShape;
  bounceOffset: number;
  currentLyric: LyricLine | null;
  assets: CharacterAssets;
  config: UIConfig;
  mouthImagesLoaded: Record<string, HTMLImageElement | null>;
  baseImageLoaded: HTMLImageElement | null;
  prevLyric: LyricLine | null;
  lyricTransition: number;
}

const EMOJI = '🐱';
const COLORS = {
  mouthLabel: '#FF6B6B',
  lyricBg: 'rgba(255,255,255,0.95)',
  lyricText: '#333',
  lyricBorder: '#ddd',
  lyricTriangle: 'rgba(255,255,255,0.95)',
};

export function renderFrame(r: RenderContext): void {
  const { ctx, width, height } = r;
  ctx.clearRect(0, 0, width, height);

  drawBackground(ctx, width, height, r.config.backgroundColor);
  drawCharacter(r);
  drawLyrics(r);
  drawHUD(r);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

function drawCharacter(r: RenderContext): void {
  const { ctx, width, height } = r;
  ctx.save();
  const bounceY = r.bounceOffset;
  const centerX = width / 2;
  const centerY = height / 2 - 40 + bounceY;

  if (r.config.renderMode === 'L1') {
    drawL1Character(r, centerX, centerY);
  } else if (r.config.renderMode === 'L2') {
    drawL2Character(r, centerX, centerY);
  } else if (r.config.renderMode === 'L3') {
    drawL3Character(r, centerX, centerY);
  }

  ctx.restore();
}

function drawL1Character(
  r: RenderContext,
  cx: number,
  cy: number
): void {
  const { ctx } = r;
  ctx.font = '120px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(EMOJI, cx, cy);

  if (r.mouthShape !== 'closed') {
    drawMouthLabel(r, cx, cy - 90);
  }
}

function drawL2Character(
  r: RenderContext,
  cx: number,
  cy: number
): void {
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
  } else {
    ctx.font = '120px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(EMOJI, cx, cy);
  }

  if (r.mouthShape !== 'closed') {
    const size =
      32 + (r.energy / 255) * 32;
    drawMouthLabelWithSize(r, cx + r.config.mouthOffset.x, cy + r.config.mouthOffset.y, size);
  }
}

function drawL3Character(
  r: RenderContext,
  cx: number,
  cy: number
): void {
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

    const mouthImg =
      r.mouthShape !== 'closed'
        ? r.mouthImagesLoaded[r.mouthShape]
        : null;

    if (mouthImg && r.mouthShape !== 'closed') {
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
    } else if (r.mouthShape !== 'closed') {
      const size =
        32 + (r.energy / 255) * 32;
      drawMouthLabelWithSize(r, cx + r.config.mouthOffset.x, cy + r.config.mouthOffset.y, size);
    }
  } else {
    ctx.font = '120px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(EMOJI, cx, cy);

    if (r.mouthShape !== 'closed') {
      drawMouthLabel(r, cx, cy - 90);
    }
  }
}

function drawMouthLabel(
  r: RenderContext,
  x: number,
  y: number
): void {
  drawMouthLabelWithSize(r, x, y, 48);
}

function drawMouthLabelWithSize(
  r: RenderContext,
  x: number,
  y: number,
  size: number
): void {
  const { ctx } = r;
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.mouthLabel;
  ctx.fillText(r.mouthShape, x, y);
}

function drawLyrics(r: RenderContext): void {
  const { ctx, width } = r;
  const currentLyric = r.currentLyric;
  const prevLyric = r.prevLyric;

  const bubbleY = r.height - 120;

  if (!currentLyric) {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('等待播放...', width / 2, bubbleY + 30);
    return;
  }

  const alpha = prevLyric && currentLyric !== prevLyric ? r.lyricTransition : 1;
  const slideOffset = prevLyric && currentLyric !== prevLyric
    ? (1 - r.lyricTransition) * 10
    : 0;

  ctx.save();
  ctx.globalAlpha = alpha;

  const text = currentLyric.text;
  const maxWidth = width * 0.7;
  const lineHeight = 28;
  const padding = 20;
  const bubbleRadius = 16;

  ctx.font = '20px sans-serif';
  const metrics = ctx.measureText(text);
  let bubbleWidth = Math.min(metrics.width + padding * 2, maxWidth + padding);
  bubbleWidth = Math.max(bubbleWidth, 80);
  const bubbleHeight = lineHeight + padding;

  const bubbleX = (width - bubbleWidth) / 2;
  const bubbleYFinal = bubbleY + slideOffset;

  ctx.fillStyle = COLORS.lyricBg;
  ctx.strokeStyle = COLORS.lyricBorder;
  ctx.lineWidth = 1;

  roundRect(ctx, bubbleX, bubbleYFinal, bubbleWidth, bubbleHeight, bubbleRadius);
  ctx.fill();
  ctx.stroke();

  const triangleSize = 10;
  ctx.beginPath();
  ctx.moveTo(width / 2 - triangleSize, bubbleYFinal);
  ctx.lineTo(width / 2, bubbleYFinal - triangleSize);
  ctx.lineTo(width / 2 + triangleSize, bubbleYFinal);
  ctx.closePath();
  ctx.fillStyle = COLORS.lyricTriangle;
  ctx.fill();
  ctx.strokeStyle = COLORS.lyricBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = COLORS.lyricText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, bubbleYFinal + bubbleHeight / 2);

  ctx.restore();
}

function drawHUD(r: RenderContext): void {
  const { ctx, width } = r;

  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'left';

  const modeText = `层级: ${r.config.renderMode}`;
  const energyText = `能量: ${Math.round(r.energy)}`;
  const bassText = `低频: ${Math.round(r.bassEnergy)}`;
  const mouthText = `口型: ${r.mouthShape}`;

  ctx.fillText(`${modeText} | ${energyText} | ${bassText} | ${mouthText}`, 10, 20);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}
