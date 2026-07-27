import {
  type MouthShape,
  type CharacterAssets,
  type UIConfig,
  type LyricLine,
  type AssetTransform,
  DEFAULT_TRANSFORM,
} from '../types/index';

export interface VisibleBounds {
  x: number; y: number; w: number; h: number;
}

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
  transforms: Record<string, AssetTransform>;
  editMode: boolean;
  selectedAsset: string | null;
  visibleBounds: Record<string, VisibleBounds>;
  eyeImagesLoaded: Record<string, HTMLImageElement | null>;
  isBlinking: boolean;
}

const visibleBoundsCache = new WeakMap<HTMLImageElement, VisibleBounds>();

export function computeVisibleBounds(img: HTMLImageElement): VisibleBounds {
  const cached = visibleBoundsCache.get(img);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx2 = c.getContext('2d');
  if (!ctx2) {
    const fallback: VisibleBounds = { x: 0, y: 0, w: img.width, h: img.height };
    visibleBoundsCache.set(img, fallback);
    return fallback;
  }
  ctx2.drawImage(img, 0, 0);
  const data = ctx2.getImageData(0, 0, img.width, img.height).data;
  let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const result: VisibleBounds = minX > maxX
    ? { x: 0, y: 0, w: img.width, h: img.height }
    : { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  visibleBoundsCache.set(img, result);
  return result;
}

export function renderFrame(r: RenderContext): void {
  const { ctx, width, height } = r;
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height);
  drawCharacter(r);
  drawHUD(r);
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
}

function drawCharacter(r: RenderContext): void {
  const { ctx, width, height } = r;
  ctx.save();
  const centerX = width * 0.25;
  const centerY = height / 2 - 40;
  const { scaleX, scaleY } = r.editMode ? { scaleX: 1, scaleY: 1 } : r.bounceScale;

  const charH = r.baseImageLoaded ? r.baseImageLoaded.height : 200;
  const bottomY = centerY + charH / 2;
  ctx.translate(centerX, bottomY);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-centerX, -bottomY);

  drawL3Character(r, centerX, centerY);

  if (r.editMode && r.selectedAsset) {
    drawAssetOverlay(r, centerX, centerY);
  }

  ctx.restore();
}

function drawL3Character(r: RenderContext, cx: number, cy: number): void {
  const { ctx } = r;
  const img = r.baseImageLoaded;
  if (!img) return;

  const maxDim = 400;
  let w = img.width;
  let h = img.height;
  if (w > maxDim || h > maxDim) {
    const s = maxDim / Math.max(w, h);
    w *= s;
    h *= s;
  }

  const baseT = r.transforms.base ?? DEFAULT_TRANSFORM;
  ctx.save();
  ctx.translate(cx + baseT.x, cy + baseT.y);
  ctx.rotate(baseT.rotation * Math.PI / 180);
  ctx.scale(baseT.scale, baseT.scale);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  // Blink overlay (same position/transform as base)
  if (r.isBlinking) {
    const blinkImg = r.eyeImagesLoaded.blink ?? null;
    if (blinkImg) {
      ctx.save();
      ctx.translate(cx + baseT.x, cy + baseT.y);
      ctx.rotate(baseT.rotation * Math.PI / 180);
      ctx.scale(baseT.scale, baseT.scale);
      ctx.drawImage(blinkImg, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  const mouthImg = r.mouthImagesLoaded[r.mouthShape] ?? null;
  if (mouthImg) {
    const faceRegionSize = Math.min(w, h) * 0.8;
    const mw = faceRegionSize;
    const mh = (mouthImg.height / mouthImg.width) * mw;
    const mouthT = r.transforms.mouth ?? DEFAULT_TRANSFORM;
    const mouthCx = cx + r.config.mouthOffset.x;
    const mouthCy = cy + r.config.mouthOffset.y;
    ctx.save();
    ctx.translate(mouthCx + mouthT.x, mouthCy + mouthT.y);
    ctx.rotate(mouthT.rotation * Math.PI / 180);
    ctx.scale(mouthT.scale, mouthT.scale);
    ctx.drawImage(mouthImg, -mw / 2, -mh / 2, mw, mh);
    ctx.restore();
  }
}

function visibleCenterOffset(key: string, vb: VisibleBounds, fullW: number, fullH: number, maxDim: number): { dx: number; dy: number } {
  if (key === 'base') {
    const scale = (fullW > maxDim || fullH > maxDim) ? maxDim / Math.max(fullW, fullH) : 1;
    const sw = fullW * scale;
    const sh = fullH * scale;
    const svb = { x: vb.x * scale, y: vb.y * scale, w: vb.w * scale, h: vb.h * scale };
    return { dx: svb.x + svb.w / 2 - sw / 2, dy: svb.y + svb.h / 2 - sh / 2 };
  }
  return { dx: 0, dy: 0 };
}

function scaledVisibleSize(key: string, vb: VisibleBounds, fullW: number, fullH: number, maxDim: number, transformScale: number): { w: number; h: number } {
  if (key === 'base') {
    const scale = (fullW > maxDim || fullH > maxDim) ? maxDim / Math.max(fullW, fullH) : 1;
    return { w: vb.w * scale * transformScale, h: vb.h * scale * transformScale };
  }
  const faceScale = Math.min(fullW, fullH) > maxDim ? maxDim / Math.max(fullW, fullH) : 1;
  const faceRegionSize = Math.min(fullW * faceScale, fullH * faceScale) * 0.8;
  const mouthW = faceRegionSize;
  const mouthH = vb.h / vb.w * faceRegionSize;
  return { w: mouthW * transformScale, h: mouthH * transformScale };
}

export function getAssetCenter(
  key: string,
  cx: number,
  cy: number,
  config: UIConfig,
  transforms: Record<string, AssetTransform>,
  visibleBounds?: Record<string, VisibleBounds>,
  baseImageLoaded?: HTMLImageElement | null,
): { x: number; y: number } {
  const t = transforms[key] ?? DEFAULT_TRANSFORM;
  const vb = visibleBounds?.[key];
  const maxDim = 400;

  if (key === 'base') {
    let offX = 0, offY = 0;
    if (vb && baseImageLoaded) {
      const imgW = baseImageLoaded.width;
      const imgH = baseImageLoaded.height;
      const offset = visibleCenterOffset(key, vb, imgW, imgH, maxDim);
      offX = offset.dx;
      offY = offset.dy;
    }
    return { x: cx + t.x + offX, y: cy + t.y + offY };
  }
  return { x: cx + config.mouthOffset.x + t.x, y: cy + config.mouthOffset.y + t.y };
}

export function getAssetSize(
  key: string,
  baseImageLoaded: HTMLImageElement | null,
  mouthImagesLoaded: Record<string, HTMLImageElement | null>,
  transforms: Record<string, AssetTransform>,
  visibleBounds?: Record<string, VisibleBounds>,
): { w: number; h: number } {
  const maxDim = 400;
  const t = transforms[key] ?? DEFAULT_TRANSFORM;

  if (key === 'base') {
    if (!baseImageLoaded) return { w: 0, h: 0 };
    const vb = visibleBounds?.base;
    if (vb) {
      return scaledVisibleSize(key, vb, baseImageLoaded.width, baseImageLoaded.height, maxDim, t.scale);
    }
    let w = baseImageLoaded.width;
    let h = baseImageLoaded.height;
    if (w > maxDim || h > maxDim) {
      const s = maxDim / Math.max(w, h);
      w *= s; h *= s;
    }
    return { w: w * t.scale, h: h * t.scale };
  }

  const anyMouthImg = Object.values(mouthImagesLoaded).find(v => v !== null) ?? null;
  if (!anyMouthImg || !baseImageLoaded) return { w: 0, h: 0 };
  const vb = visibleBounds?.mouth ?? (anyMouthImg ? computeVisibleBounds(anyMouthImg) : undefined);
  let bw = baseImageLoaded.width;
  let bh = baseImageLoaded.height;
  if (bw > maxDim || bh > maxDim) {
    const s = maxDim / Math.max(bw, bh);
    bw *= s; bh *= s;
  }
  const faceRegionSize = Math.min(bw, bh) * 0.8;
  const mouthAspect = vb ? (vb.h / vb.w) : (anyMouthImg.height / anyMouthImg.width);
  const w = faceRegionSize * t.scale;
  const h = mouthAspect * faceRegionSize * t.scale;
  return { w, h };
}

function drawAssetOverlay(r: RenderContext, cx: number, cy: number): void {
  const { ctx } = r;
  const key = r.selectedAsset!;
  const t = r.transforms[key] ?? DEFAULT_TRANSFORM;

  if (key === 'lyric') return;

  const c = getAssetCenter(key, cx, cy, r.config, r.transforms, r.visibleBounds, r.baseImageLoaded ? r.baseImageLoaded : null);
  const s = getAssetSize(key, r.baseImageLoaded, r.mouthImagesLoaded, r.transforms, r.visibleBounds);
  if (s.w === 0 || s.h === 0) return;
  const center = c;
  const size = s;
  const angle = t.rotation * Math.PI / 180;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = size.w / 2;
  const hh = size.h / 2;

  const corners = [
    { x: center.x + cos * (-hw) - sin * (-hh), y: center.y + sin * (-hw) + cos * (-hh) },
    { x: center.x + cos * hw - sin * (-hh), y: center.y + sin * hw + cos * (-hh) },
    { x: center.x + cos * hw - sin * hh, y: center.y + sin * hw + cos * hh },
    { x: center.x + cos * (-hw) - sin * hh, y: center.y + sin * (-hw) + cos * hh },
  ];

  const mids = [
    { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 },
    { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 },
    { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 },
    { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 },
  ];

  const topMid = mids[0];

  ctx.save();

  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#007aff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  const allHandles = [...corners, ...mids];
  for (const pt of allHandles) {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#007aff';
    ctx.lineWidth = 1.5;
    ctx.fillRect(pt.x - 5, pt.y - 5, 10, 10);
    ctx.strokeRect(pt.x - 5, pt.y - 5, 10, 10);
  }

  const rotY = topMid.y - 25;
  ctx.beginPath();
  ctx.moveTo(topMid.x, topMid.y);
  ctx.lineTo(topMid.x, rotY);
  ctx.strokeStyle = '#007aff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(topMid.x, rotY, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();
  ctx.strokeStyle = '#007aff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
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
