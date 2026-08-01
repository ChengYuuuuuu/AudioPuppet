export function detectBeats(audio: Float32Array, sampleRate: number): { bpm: number | null; beats: number[] } {
  const onsetEnv = computeOnsetEnvelope(audio, sampleRate);
  const { bpm, beats } = beatTrack(onsetEnv, sampleRate);
  return {
    bpm: bpm > 0 ? bpm : null,
    beats: beats.map(b => b * 512 / sampleRate),
  };
}

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const vIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

function computeOnsetEnvelope(audio: Float32Array, sampleRate: number): Float32Array {
  const hopLength = 512;
  const nFft = 2048;
  const nFrames = Math.floor((audio.length - nFft) / hopLength) + 1;
  if (nFrames <= 0) return new Float32Array(0);

  const envelope = new Float32Array(nFrames);
  const window = new Float32Array(nFft);
  for (let i = 0; i < nFft; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (nFft - 1)));
  }

  const re = new Float32Array(nFft);
  const im = new Float32Array(nFft);
  const spectrum = new Float32Array(nFft / 2 + 1);
  const prevSpectrum = new Float32Array(nFft / 2 + 1);

  for (let frame = 0; frame < nFrames; frame++) {
    const start = frame * hopLength;
    for (let i = 0; i < nFft; i++) {
      const s = start + i;
      re[i] = (s < audio.length ? audio[s] : 0) * window[i];
      im[i] = 0;
    }

    fft(re, im);

    for (let k = 0; k <= nFft / 2; k++) {
      spectrum[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }

    if (frame > 0) {
      let diff = 0;
      for (let k = 0; k < spectrum.length; k++) {
        const d = spectrum[k] - prevSpectrum[k];
        if (d > 0) diff += d;
      }
      envelope[frame] = diff;
    }

    prevSpectrum.set(spectrum);
  }

  return envelope;
}

function autoCorrelate(signal: Float32Array, sampleRate: number): number {
  const n = signal.length;
  const rms = Math.sqrt(signal.reduce((s, v) => s + v * v, 0) / n);
  if (rms < 0.01) return 0;

  const minLag = Math.max(1, Math.round((60 * sampleRate) / 300));
  const maxLag = Math.round((60 * sampleRate) / 30);
  const ac = new Float32Array(maxLag - minLag);

  for (let lag = minLag; lag < maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += signal[i] * signal[i + lag];
    }
    ac[lag - minLag] = sum;
  }

  let maxVal = -Infinity;
  let maxIdx = 0;
  for (let i = 0; i < ac.length; i++) {
    if (ac[i] > maxVal) {
      maxVal = ac[i];
      maxIdx = i;
    }
  }

  const period = maxIdx + minLag;
  if (period === 0) return 0;
  return (60 * sampleRate) / period;
}

function beatTrack(
  onsetEnv: Float32Array,
  sampleRate: number,
): { bpm: number; beats: number[] } {
  if (onsetEnv.length < 10) return { bpm: 0, beats: [] };

  const bpm = autoCorrelate(onsetEnv, 44100 / 512);
  const beats: number[] = [];
  const threshold = 0.3 * onsetEnv.reduce((s, v) => Math.max(s, v), 0);

  let lastBeat = -Infinity;
  const minInterval = bpm > 0 ? Math.round((60 / bpm) * 44100 / 512 * 0.5) : 0;

  for (let i = 1; i < onsetEnv.length - 1; i++) {
    if (onsetEnv[i] > threshold &&
        onsetEnv[i] > onsetEnv[i - 1] &&
        onsetEnv[i] > onsetEnv[i + 1] &&
        i - lastBeat >= minInterval) {
      beats.push(i);
      lastBeat = i;
    }
  }

  return { bpm, beats };
}
