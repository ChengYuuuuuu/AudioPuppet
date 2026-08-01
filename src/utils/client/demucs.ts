import * as ort from 'onnxruntime-web';
import { DemucsProcessor } from 'demucs-web';
import { fetchWithProgress, DEMUCS_MODEL_SIZE } from './onnxLoader';

ort.env.wasm.wasmPaths = '/wasm/';

const DEMUCS_MODEL_PATH = '/models/htdemucs_ft_vocals_safe16.onnx';

let processor: DemucsProcessor | null = null;
let demucsLoaded = false;

export async function loadDemucs(
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  if (demucsLoaded) return;
  const buffer = await fetchWithProgress(DEMUCS_MODEL_PATH, onProgress, DEMUCS_MODEL_SIZE);
  processor = new DemucsProcessor({
    ort,
    sessionOptions: {
      executionProviders: ['webgpu', 'wasm'],
      graphOptimizationLevel: 'basic',
    },
  });
  await processor.loadModel(buffer);
  demucsLoaded = true;
}

export async function separateVocals(audio: Float32Array): Promise<Float32Array> {
  if (!processor) throw new Error('Demucs 模型未加载');
  const result = await processor.separate(audio, audio);
  const v = result.vocals;
  const n = Math.min(v.left.length, audio.length);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    mono[i] = (v.left[i] + v.right[i]) / 2;
  }
  return mono;
}

export function disposeDemucs(): void {
  processor = null;
  demucsLoaded = false;
}
