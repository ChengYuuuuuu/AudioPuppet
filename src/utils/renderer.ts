import {
  type RenderMode,
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
  mouthLabel: '#4A90D9',
  lyricBg: 'rgba(255,255,255,0.95)',
  lyricText: '#333',
  lyricBorder: '#ddd',
  lyricTriangle: 'rgba(255,255,255,0.95)',
};

export function renderFrame(r: RenderContext): void {
  const { ctx, width, height } = r;
  ctx.clearRect(0, 0, width, height);

  drawBackground(ctx, width, height);
  drawCharacter(r);
  drawLyrics(r);
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

function drawL1Character(r: RenderContext, cx: number, cy: number): void {
  const { ctx } = r;
  ctx.font = '120px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(EMOJI, cx, cy);

  if (r.mouthShape !== 'closed') {
    drawMouthLabel(r, cx, cy - 90);
  }
}

function drawL2Character(r: RenderContext, cx: number, cy: number): void {
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
    const size = 32 + (r.energy / 255) * 32;
    drawMouthLabelWithSize(r, cx + r.config.mouthOffset.x, cy + r.config.mouthOffset.y, size);
  }
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
      const size = 32 + (r.energy / 255) * 32;
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

function drawMouthLabel(r: RenderContext, x: number, y: number): void {
  drawMouthLabelWithSize(r, x, y, 48);
}

function drawMouthLabelWithSize(r: RenderContext, x: number, y: number, size: number): void {
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

// ── Exporters ──

export function exportVideo(
  canvas: HTMLCanvasElement,
  audioContext: AudioContext | null,
  duration: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);

    const audioDest = audioContext?.createMediaStreamDestination();
    if (audioDest && audioContext) {
      const audioTracks = audioDest.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        stream.addTrack(audioTracks[0]);
      }
    }

    const chunks: Blob[] = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    mediaRecorder.onerror = () => reject(new Error('录制失败'));

    mediaRecorder.start(100);

    const startTime = Date.now();
    const checkProgress = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      onProgress?.(progress);
      if (progress >= 1) {
        clearInterval(checkProgress);
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }
    }, 200);

    setTimeout(() => {
      clearInterval(checkProgress);
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, (duration + 1) * 1000);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportGIF(
  canvas: HTMLCanvasElement,
  duration: number,
  fps: number = 8
): Promise<Blob | null> {
  const width = canvas.width;
  const height = canvas.height;
  const totalFrames = Math.floor(duration * fps);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const frames: ImageData[] = [];
  const frameInterval = duration / totalFrames;

  ctx.save();
  for (let i = 0; i < totalFrames; i++) {
    const imageData = ctx.getImageData(0, 0, width, height);
    frames.push(imageData);
  }
  ctx.restore();

  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(1000 / fps);

  for (const frame of frames) {
    encoder.addFrame(frame);
  }
  encoder.finish();

  return new Promise((resolve) => {
    const binary = encoder.stream().getData();
    const blob = new Blob([binary], { type: 'image/gif' });
    resolve(blob);
  });
}

class LZWStream {
  private data: number[] = [];
  bits = 0;
  bitBuffer = 0;

  writeByte(byte: number): void {
    this.data.push(byte);
  }

  writeBytes(bytes: number[]): void {
    for (const b of bytes) this.writeByte(b);
  }

  getData(): Uint8Array {
    return new Uint8Array(this.data);
  }
}

class GIFEncoder {
  private width: number;
  private height: number;
  private stream: LZWStream;
  private started = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.stream = new LZWStream();
  }

  start(): void {
    this.writeHeader();
    this.writeLSD();
    this.started = true;
  }

  setRepeat(repeat: number): void {
    this.stream.writeByte(0x21);
    this.stream.writeByte(0xff);
    this.stream.writeByte(0x0b);
    this.stream.writeBytes([78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48]);
    this.stream.writeByte(0x03);
    this.stream.writeByte(repeat);
    this.stream.writeByte(0x00);
    this.stream.writeByte(0x00);
    this.stream.writeByte(0x00);
  }

  setDelay(ms: number): void {
    const delay = Math.round(ms / 10);
    this.stream.writeByte(0x21);
    this.stream.writeByte(0xf9);
    this.stream.writeByte(0x04);
    this.stream.writeByte(0x04);
    this.stream.writeByte(delay & 0xff);
    this.stream.writeByte((delay >> 8) & 0xff);
    this.stream.writeByte(0x00);
    this.stream.writeByte(0x00);
  }

  addFrame(imageData: ImageData): void {
    this.stream.writeByte(0x2c);
    this.stream.writeByte(0x00);
    this.stream.writeByte(0x00);
    this.stream.writeByte(0x00);
    this.stream.writeByte(0x00);
    this.stream.writeByte(this.width & 0xff);
    this.stream.writeByte((this.width >> 8) & 0xff);
    this.stream.writeByte(this.height & 0xff);
    this.stream.writeByte((this.height >> 8) & 0xff);
    this.stream.writeByte(0x00);

    this.writeImageData(imageData);
  }

  finish(): void {
    this.stream.writeByte(0x3b);
  }

  stream(): LZWStream {
    return this.stream;
  }

  private writeHeader(): void {
    this.stream.writeBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  }

  private writeLSD(): void {
    this.stream.writeByte(this.width & 0xff);
    this.stream.writeByte((this.width >> 8) & 0xff);
    this.stream.writeByte(this.height & 0xff);
    this.stream.writeByte((this.height >> 8) & 0xff);
    this.stream.writeByte(0xf0);
    this.stream.writeByte(0x00);
    this.stream.writeByte(0x00);
  }

  private writeImageData(imageData: ImageData): void {
    const pixels: number[] = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      const index = this.rgbToPaletteIndex(r, g, b, a);
      pixels.push(index);
    }

    this.stream.writeByte(0x80);

    const bpp = 7;
    this.stream.writeByte(0x07);

    const sortedPixels = this.quantize(pixels);
    const minCodeSize = 8;
    this.stream.writeByte(minCodeSize);

    const lzwData = this.lzwEncode(sortedPixels, minCodeSize);
    for (const byte of lzwData) {
      this.stream.writeByte(byte);
    }

    this.stream.writeByte(0x00);
  }

  private rgbToPaletteIndex(r: number, g: number, b: number, a: number): number {
    if (a < 128) return 0;
    return ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
  }

  private quantize(pixels: number[]): number[] {
    return pixels;
  }

  private lzwEncode(pixels: number[], minCodeSize: number): number[] {
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let nextCode = eoiCode + 1;

    const dict = new Map<string, number>();
    for (let i = 0; i < clearCode; i++) {
      dict.set(String.fromCharCode(i), i);
    }

    const result: number[] = [];
    let codeSize = minCodeSize + 1;
    let w = '';
    let bitBuffer = 0;
    let bitCount = 0;

    const writeCode = (code: number) => {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        result.push(bitBuffer & 0xff);
        bitBuffer >>= 8;
        bitCount -= 8;
      }
    };

    writeCode(clearCode);

    for (const pixel of pixels) {
      const wk = w + String.fromCharCode(pixel);
      if (dict.has(wk)) {
        w = wk;
      } else {
        writeCode(dict.get(w)!);
        if (nextCode < 4096) {
          dict.set(wk, nextCode++);
          if (nextCode > (1 << codeSize)) {
            codeSize++;
          }
        } else {
          writeCode(clearCode);
          dict.clear();
          for (let i = 0; i < clearCode; i++) {
            dict.set(String.fromCharCode(i), i);
          }
          nextCode = eoiCode + 1;
          codeSize = minCodeSize + 1;
        }
        w = String.fromCharCode(pixel);
      }
    }

    if (w !== '') {
      writeCode(dict.get(w)!);
    }

    writeCode(eoiCode);

    if (bitCount > 0) {
      result.push(bitBuffer & 0xff);
    }

    return result;
  }
}
