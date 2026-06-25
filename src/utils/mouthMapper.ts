import { type MouthShape, MOUTH_THRESHOLDS, MOUTH_SHAPES } from '../types/index';

let lastMouth: MouthShape = 'closed';
let lastSwitchTime = 0;
let randomMouthTimer = 0;
let lastRandomMouth: MouthShape = 'A';

const DEBOUNCE_MS = 50;
const RANDOM_SWITCH_MS = 100;

export function mapEnergyToMouth(
  energy: number,
  sensitivity: number,
  now: number
): MouthShape {
  const adjusted = energy * sensitivity;

  if (adjusted < MOUTH_THRESHOLDS.closed) {
    if (lastMouth !== 'closed' && now - lastSwitchTime < DEBOUNCE_MS) {
      return lastMouth;
    }
    lastMouth = 'closed';
    lastSwitchTime = now;
    return 'closed';
  }

  if (adjusted < MOUTH_THRESHOLDS.E) {
    if (lastMouth !== 'E' && now - lastSwitchTime < DEBOUNCE_MS) {
      return lastMouth;
    }
    lastMouth = 'E';
    lastSwitchTime = now;
    return 'E';
  }

  if (adjusted < MOUTH_THRESHOLDS.A) {
    if (lastMouth !== 'A' && now - lastSwitchTime < DEBOUNCE_MS) {
      return lastMouth;
    }
    lastMouth = 'A';
    lastSwitchTime = now;
    return 'A';
  }

  if (adjusted < MOUTH_THRESHOLDS.random) {
    if (now - randomMouthTimer >= RANDOM_SWITCH_MS) {
      let next: MouthShape;
      do {
        next = MOUTH_SHAPES[Math.floor(Math.random() * MOUTH_SHAPES.length)];
      } while (next === lastRandomMouth);
      lastRandomMouth = next;
      randomMouthTimer = now;
      lastMouth = next;
      lastSwitchTime = now;
      return next;
    }
    return lastMouth;
  }

  if (adjusted >= MOUTH_THRESHOLDS.random) {
    if (lastMouth !== 'O' && now - lastSwitchTime < DEBOUNCE_MS) {
      return lastMouth;
    }
    lastMouth = 'O';
    lastSwitchTime = now;
    return 'O';
  }

  return 'closed';
}

export function resetMouthMapper(): void {
  lastMouth = 'closed';
  lastSwitchTime = 0;
  randomMouthTimer = 0;
  lastRandomMouth = 'A';
}
