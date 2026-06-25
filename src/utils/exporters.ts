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

    // Use local color table with quantized colors
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
