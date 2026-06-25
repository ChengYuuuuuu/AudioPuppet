import { type BounceState } from '../types/index';

export function createBounceState(): BounceState {
  return { position: 0, velocity: 0, isBouncing: false };
}

export function updateBounce(
  state: BounceState,
  trigger: boolean,
  intensity: number
): BounceState {
  let { position, velocity } = state;

  if (trigger) {
    velocity = -intensity * 15;
  }

  if (Math.abs(position) > 0.1 || Math.abs(velocity) > 0.1) {
    position += velocity;
    velocity *= 0.92;
    return { position, velocity, isBouncing: true };
  }

  return { position: 0, velocity: 0, isBouncing: false };
}

export function detectBassPeak(
  bassEnergy: number,
  history: Float32Array,
  threshold: number = 1.3
): boolean {
  let sum = 0;
  for (let i = 0; i < history.length; i++) {
    sum += history[i];
  }
  const avg = sum / history.length;
  return bassEnergy > avg * threshold && bassEnergy > 30;
}
