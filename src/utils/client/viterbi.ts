function forwardPass(
  T: number, S: number,
  probLog: Float64Array,
  notEdgeProbLog: Float64Array,
  edgeProbLog: Float64Array,
  currPhMaxProbLog: Float64Array,
  dp: Float64Array,
  backtrackS: Int32Array,
  phSeqId: Int32Array,
  prob3PadLen: number,
): { dp: Float64Array; backtrackS: Int32Array; currPhMaxProbLog: Float64Array } {
  for (let t = 1; t < T; t++) {
    const tOffset = t * S;
    const tPrevOffset = (t - 1) * S;
    const notEdge = notEdgeProbLog[t];
    const edge = edgeProbLog[t];

    for (let s = 0; s < S; s++) {
      const prob1 = dp[tPrevOffset + s] + probLog[tOffset + s] + notEdge;

      let prob2 = -Infinity;
      if (s > 0) {
        prob2 = dp[tPrevOffset + s - 1] + probLog[tOffset + s - 1] + edge + currPhMaxProbLog[s - 1] * (T / S);
      }

      let prob3 = -Infinity;
      if (s >= prob3PadLen) {
        const prevS = s - prob3PadLen;
        if (prevS + 1 >= S - 1 || phSeqId[prevS + 1] === 0) {
          prob3 = dp[tPrevOffset + prevS] + probLog[tOffset + prevS] + edge + currPhMaxProbLog[prevS] * (T / S);
        }
      }

      let maxVal = prob1;
      let maxIdx = 0;
      if (prob2 > maxVal) { maxVal = prob2; maxIdx = 1; }
      if (prob3 > maxVal) { maxVal = prob3; maxIdx = 2; }

      if (!Number.isFinite(maxVal)) {
        maxVal = -Infinity;
      }

      dp[tOffset + s] = maxVal;
      backtrackS[tOffset + s] = maxIdx;
    }

    for (let s = 0; s < S; s++) {
      const idx = tOffset + s;
      if (backtrackS[idx] === 0) {
        currPhMaxProbLog[s] = Math.max(currPhMaxProbLog[s], probLog[tOffset + s]);
      } else if (backtrackS[idx] > 0) {
        currPhMaxProbLog[s] = probLog[tOffset + s];
      }
    }

    for (let s = 0; s < S; s++) {
      if (phSeqId[s] === 0) {
        currPhMaxProbLog[s] = 0;
      }
    }
  }

  return { dp, backtrackS, currPhMaxProbLog };
}

export function decode(
  phSeqId: Int32Array,
  phProbLog: Float64Array,
  edgeProb: Float64Array,
  vocabSize: number,
): { phIdxSeq: Int32Array; phTimeInt: Int32Array; frameConfidence: Float64Array } {
  const T = phProbLog.length / vocabSize;
  const S = phSeqId.length;

  const probLog = new Float64Array(T * S);
  for (let t = 0; t < T; t++) {
    const tOffProb = t * vocabSize;
    const tOff = t * S;
    for (let s = 0; s < S; s++) {
      const val = phProbLog[tOffProb + phSeqId[s]];
      probLog[tOff + s] = Number.isFinite(val) ? val : -1e9;
    }
  }

  const edgeProbLog = new Float64Array(T);
  const notEdgeProbLog = new Float64Array(T);
  for (let t = 0; t < T; t++) {
    const e = Number.isFinite(edgeProb[t] as number)
      ? Math.max(0, Math.min(1, edgeProb[t] as number))
      : 0.5;
    edgeProbLog[t] = Math.log(e + 1e-6);
    notEdgeProbLog[t] = Math.log(1 - e + 1e-6);
  }

  const currPhMaxProbLog = new Float64Array(S);
  currPhMaxProbLog.fill(-Infinity);

  const dp = new Float64Array(T * S);
  dp.fill(-Infinity);

  const backtrackS = new Int32Array(T * S);
  backtrackS.fill(-1);

  dp[0] = probLog[0];
  currPhMaxProbLog[0] = probLog[0];
  if (phSeqId[0] === 0 && S > 1) {
    dp[1] = probLog[1];
    currPhMaxProbLog[1] = probLog[1];
  }

  const prob3PadLen = S >= 2 ? 2 : 1;

  forwardPass(
    T, S, probLog, notEdgeProbLog, edgeProbLog,
    currPhMaxProbLog, dp, backtrackS, phSeqId, prob3PadLen,
  );

  let s: number;
  if (S >= 2 && dp[(T - 1) * S + (S - 2)] > dp[(T - 1) * S + (S - 1)] && phSeqId[S - 1] === 0) {
    s = S - 2;
  } else {
    s = S - 1;
  }

  const phIdxSeq: number[] = [];
  const phTimeInt: number[] = [];
  const frameConfidence: number[] = [];

  for (let t = T - 1; t >= 0; t--) {
    const backVal = backtrackS[t * S + s];
    frameConfidence.push(dp[t * S + s]);
    if (backVal !== 0) {
      phIdxSeq.push(s);
      phTimeInt.push(t);
      s -= backVal;
    }
  }

  phIdxSeq.reverse();
  phTimeInt.reverse();
  frameConfidence.reverse();

  const confArr = new Float64Array(frameConfidence.length);
  confArr[0] = 0;
  for (let i = 1; i < frameConfidence.length; i++) {
    const d = frameConfidence[i] - frameConfidence[i - 1];
    confArr[i] = Number.isFinite(d) ? Math.exp(d) : 0;
  }

  return {
    phIdxSeq: new Int32Array(phIdxSeq),
    phTimeInt: new Int32Array(phTimeInt),
    frameConfidence: confArr,
  };
}

export function edgePredStats(edgeLogits: Float32Array): { mean: number; max: number; lt01: number; nan: number } {
  let sum = 0;
  let lt = 0;
  let mx = 0;
  let nan = 0;
  const n = edgeLogits.length;
  for (let i = 0; i < n; i++) {
    const raw = edgeLogits[i] as number;
    if (!Number.isFinite(raw)) {
      nan++;
      continue;
    }
    const sig = 1 / (1 + Math.exp(-raw));
    const pred = Math.max(0, Math.min(1, sig / 0.8));
    sum += pred;
    if (pred < 0.1) lt++;
    if (pred > mx) mx = pred;
  }
  return { mean: n > 0 ? sum / n : 0, max: mx, lt01: n > 0 ? lt / n : 0, nan };
}

export function decodePhonemes(
  phSeqId: Int32Array,
  phFrameLogits: Float32Array,
  phEdgeLogits: Float32Array,
  phSeq: string[],
  frameLength: number,
  vocabSize: number,
): {
  phonemes: Array<{ ph: string; start: number; end: number }>;
  words: Array<{ text: string; start: number; end: number }>;
  confidence: number;
} {
  const T = phFrameLogits.length / vocabSize;
  const S = phSeqId.length;

  const phProbLog = new Float64Array(phFrameLogits.length);
  const phEdgePred = new Float64Array(T);

  for (let t = 0; t < T; t++) {
    const tOff = t * vocabSize;
    const mask = new Float64Array(vocabSize);
    mask.fill(-1e9);
    for (let s = 0; s < S; s++) {
      const phId = phSeqId[s];
      mask[phId] = 0;
    }
    mask[0] = 0;

    let maxLogit = -Infinity;
    for (let v = 0; v < vocabSize; v++) {
      const raw = phFrameLogits[tOff + v] as number;
      const val = (Number.isFinite(raw) ? raw : -1e3) + mask[v];
      phProbLog[tOff + v] = val;
      if (val > maxLogit) maxLogit = val;
    }
    let sumExp = 0;
    for (let v = 0; v < vocabSize; v++) {
      sumExp += Math.exp(phProbLog[tOff + v] - maxLogit);
    }
    const logSum = maxLogit + Math.log(sumExp);
    for (let v = 0; v < vocabSize; v++) {
      phProbLog[tOff + v] = phProbLog[tOff + v] - logSum;
    }

    const edgeRaw = phEdgeLogits[t] as number;
    const sig = Number.isFinite(edgeRaw) ? 1 / (1 + Math.exp(-edgeRaw)) : 0.5;
    phEdgePred[t] = Math.max(0, Math.min(1, sig / 0.8));
  }

  const edgeProb = new Float64Array(T);
  for (let t = 0; t < T; t++) {
    const prev = t > 0 ? phEdgePred[t - 1] : 0;
    edgeProb[t] = Math.max(0, Math.min(1, phEdgePred[t] + prev));
  }

  const decodeResult = decode(phSeqId, phProbLog, edgeProb, vocabSize);

  const edgeDiff = new Float64Array(T);
  for (let t = 0; t < T - 1; t++) {
    edgeDiff[t] = phEdgePred[t + 1] - phEdgePred[t];
  }
  edgeDiff[T - 1] = 0;

  const phTimeFractional = new Float64Array(decodeResult.phTimeInt.length);
  for (let i = 0; i < decodeResult.phTimeInt.length; i++) {
    const ti = decodeResult.phTimeInt[i];
    phTimeFractional[i] = Math.max(-0.5, Math.min(0.5, (edgeDiff[ti] as number) / 2));
  }

  const phTimePred = new Float64Array(decodeResult.phIdxSeq.length + 1);
  for (let i = 0; i < decodeResult.phIdxSeq.length; i++) {
    phTimePred[i] = frameLength * (decodeResult.phTimeInt[i] + phTimeFractional[i]);
  }
  phTimePred[phTimePred.length - 1] = T * frameLength;

  const phonemes: Array<{ ph: string; start: number; end: number }> = [];
  const words: Array<{ text: string; start: number; end: number }> = [];

  for (let j = 0; j < decodeResult.phIdxSeq.length; j++) {
    const phIdx = decodeResult.phIdxSeq[j];
    if (phSeq[phIdx] === 'SP') continue;
    const start = Math.max(0, phTimePred[j]);
    const end = Math.max(start, phTimePred[j + 1]);
    phonemes.push({ ph: phSeq[phIdx], start, end });
  }

  if (phonemes.length === 0) {
    console.warn('[viterbi] no phonemes generated', { T, S, pathLen: decodeResult.phIdxSeq.length });
  } else {
    console.log(`[viterbi] ${phonemes.length} phonemes (T=${T}, S=${S}, path=${decodeResult.phIdxSeq.length})`);
  }

  return { phonemes, words, confidence: 0.5 };
}
