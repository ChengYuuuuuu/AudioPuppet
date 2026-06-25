import { type AudioAnalyserData } from '../types/index';

export class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private buffer: AudioBuffer | null = null;
  private isPlaying = false;
  private startTime = 0;
  private pauseOffset = 0;
  private duration = 0;
  private animationId: number | null = null;
  private onFrame: ((data: AudioAnalyserData, currentTime: number) => void) | null = null;
  private onEnded: (() => void) | null = null;
  private useElement = false;

  private bassHistory: Float32Array;
  private bassHistoryIndex = 0;

  constructor() {
    this.bassHistory = new Float32Array(3);
  }

  async loadAudio(url: string): Promise<void> {
    this.destroy();
    this.context = new AudioContext();

    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const arrayBuffer = await response.arrayBuffer();
      this.buffer = await this.context.decodeAudioData(arrayBuffer);
      this.duration = this.buffer.duration;
      this.useElement = false;
    } catch {
      await this.loadViaElement(url);
    }

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 0.7;
  }

  private loadViaElement(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = url;
      this.audioElement = audio;
      this.useElement = true;

      audio.addEventListener('canplaythrough', () => {
        this.duration = audio.duration;
        resolve();
      }, { once: true });

      audio.addEventListener('error', () => {
        reject(new Error('音频加载失败（CORS 或地址无效）'));
      }, { once: true });

      audio.load();
    });
  }

  loadFromFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      this.destroy();
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 0.7;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          this.buffer = await this.context!.decodeAudioData(arrayBuffer);
          this.duration = this.buffer.duration;
          this.useElement = false;
          resolve();
        } catch (e) {
          reject(new Error('音频解码失败'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  play(): void {
    if (!this.context || (!this.buffer && !this.audioElement)) return;
    if (this.isPlaying) return;

    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    if (this.useElement && this.audioElement) {
      this.mediaSource = this.context.createMediaElementSource(this.audioElement);
      this.mediaSource.connect(this.analyser!);
      this.analyser!.connect(this.gainNode!);
      this.gainNode!.connect(this.context.destination);
      this.audioElement.currentTime = this.pauseOffset;
      this.audioElement.play();
      this.isPlaying = true;
      this.startLoop();
      this.audioElement.onended = () => {
        this.isPlaying = false;
        this.pauseOffset = 0;
        this.onEnded?.();
      };
      return;
    }

    if (!this.buffer) return;

    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.analyser!);
    this.analyser!.connect(this.gainNode!);
    this.gainNode!.connect(this.context.destination);

    this.source.start(0, this.pauseOffset);
    this.startTime = this.context.currentTime - this.pauseOffset;
    this.isPlaying = true;

    this.source.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pauseOffset = 0;
        this.onEnded?.();
      }
    };

    this.startLoop();
  }

  pause(): void {
    if (this.useElement && this.audioElement) {
      this.audioElement.pause();
      this.pauseOffset = this.audioElement.currentTime;
    } else if (this.context && this.source) {
      this.source.stop();
      this.pauseOffset = this.context.currentTime - this.startTime;
    }
    this.isPlaying = false;
    this.stopLoop();
  }

  stop(): void {
    if (this.useElement && this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    } else {
      try { this.source?.stop(); } catch {}
    }
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.stopLoop();
  }

  seek(time: number): void {
    const wasPlaying = this.isPlaying;

    if (this.useElement && this.audioElement) {
      this.pauseOffset = Math.min(time, this.duration);
      this.audioElement.currentTime = this.pauseOffset;
      if (wasPlaying) {
        this.audioElement.play().catch(() => {});
      }
      return;
    }

    if (!this.buffer) return;
    if (wasPlaying) {
      this.source?.stop();
      this.stopLoop();
    }

    this.pauseOffset = Math.min(time, this.duration);
    this.isPlaying = false;

    if (wasPlaying && this.context) {
      this.source = this.context.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.connect(this.analyser!);
      this.analyser!.connect(this.gainNode!);
      this.gainNode!.connect(this.context.destination);
      this.source.start(0, this.pauseOffset);
      this.startTime = this.context.currentTime - this.pauseOffset;
      this.isPlaying = true;
      this.startLoop();
    }
  }

  setVolume(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, value));
    }
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, value));
    }
  }

  getCurrentTime(): number {
    if (this.useElement && this.audioElement) {
      return this.audioElement.currentTime;
    }
    if (!this.context || !this.isPlaying) return this.pauseOffset;
    return this.context.currentTime - this.startTime;
  }

  getDuration(): number {
    return this.duration;
  }

  getAudioContext(): AudioContext | null {
    return this.context;
  }

  onFrameUpdate(callback: (data: AudioAnalyserData, currentTime: number) => void): void {
    this.onFrame = callback;
  }

  onPlayEnded(callback: () => void): void {
    this.onEnded = callback;
  }

  private startLoop(): void {
    const loop = () => {
      if (!this.isPlaying || !this.analyser || !this.context) return;

      const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(frequencyData);

      let energy = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        energy += frequencyData[i];
      }
      energy = energy / frequencyData.length;

      let bassEnergy = 0;
      const bassBins = Math.min(5, frequencyData.length);
      for (let i = 0; i < bassBins; i++) {
        bassEnergy += frequencyData[i];
      }
      bassEnergy = bassEnergy / bassBins;

      this.bassHistory[this.bassHistoryIndex % 3] = bassEnergy;
      this.bassHistoryIndex++;

      const currentTime = this.getCurrentTime();

      this.onFrame?.({ energy, bassEnergy, frequencyData }, currentTime);

      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private stopLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy(): void {
    this.stopLoop();
    this.source?.stop();
    this.source?.disconnect();
    this.mediaSource?.disconnect();
    this.analyser?.disconnect();
    this.gainNode?.disconnect();
    this.context?.close();
    this.audioElement?.pause();
    this.context = null;
    this.analyser = null;
    this.gainNode = null;
    this.source = null;
    this.mediaSource = null;
    this.audioElement = null;
    this.buffer = null;
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.duration = 0;
    this.useElement = false;
    this.bassHistory = new Float32Array(3);
    this.bassHistoryIndex = 0;
  }

  get bassHistoryData(): Float32Array {
    return this.bassHistory;
  }

  get playing(): boolean {
    return this.isPlaying;
  }
}
