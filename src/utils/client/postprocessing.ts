const MIN_SP_LENGTH = 0.1;
const SP_MERGE_LENGTH = 0.3;

export function fillSmallGaps(
  wordSeq: string[],
  wordIntervals: Float64Array[],
  wavLength: number,
): { wordSeq: string[]; wordIntervals: Float64Array[] } {
  const intervals = wordIntervals.map(iv => [iv[0], iv[1]]);

  if (intervals[0][0] > 0 && intervals[0][0] < MIN_SP_LENGTH) {
    intervals[0][0] = 0;
  }

  for (let idx = 0; idx < wordSeq.length - 1; idx++) {
    const gap = intervals[idx + 1][0] - intervals[idx][1];
    if (gap > 0 && gap < SP_MERGE_LENGTH) {
      const leftIsAP = wordSeq[idx] === 'AP';
      const rightIsAP = wordSeq[idx + 1] === 'AP';
      if (leftIsAP && rightIsAP) {
        const mean = (intervals[idx][1] + intervals[idx + 1][0]) / 2;
        intervals[idx][1] = mean;
        intervals[idx + 1][0] = mean;
      } else if (leftIsAP) {
        intervals[idx][1] = intervals[idx + 1][0];
      } else if (rightIsAP) {
        intervals[idx + 1][0] = intervals[idx][1];
      } else if (gap < MIN_SP_LENGTH) {
        const mean = (intervals[idx][1] + intervals[idx + 1][0]) / 2;
        intervals[idx][1] = mean;
        intervals[idx + 1][0] = mean;
      }
    }
  }

  if (intervals[intervals.length - 1][1] < wavLength &&
      wavLength - intervals[intervals.length - 1][1] < MIN_SP_LENGTH) {
    intervals[intervals.length - 1][1] = wavLength;
  }

  return {
    wordSeq,
    wordIntervals: intervals.map(iv => new Float64Array(iv)),
  };
}

export function addSP(
  wordSeq: string[],
  wordIntervals: Float64Array[],
  wavLength: number,
): { wordSeq: string[]; wordIntervals: Float64Array[] } {
  const intervals = wordIntervals.map(iv => [iv[0], iv[1]]);
  const newWordSeq: string[] = [];
  const newIntervals: number[][] = [];

  if (wordSeq.length === 0) {
    newWordSeq.push('SP');
    newIntervals.push([0, wavLength]);
    return {
      wordSeq: newWordSeq,
      wordIntervals: newIntervals.map(iv => new Float64Array(iv)),
    };
  }

  newWordSeq.push('SP');
  newIntervals.push([0, intervals[0][0]]);

  for (let i = 0; i < wordSeq.length; i++) {
    const lastEnd = newIntervals[newIntervals.length - 1][1];
    const start = intervals[i][0];
    if (lastEnd < start) {
      newWordSeq.push('SP');
      newIntervals.push([lastEnd, start]);
    }
    newWordSeq.push(wordSeq[i]);
    newIntervals.push([start, intervals[i][1]]);
  }

  const lastEnd = newIntervals[newIntervals.length - 1][1];
  if (lastEnd < wavLength) {
    newWordSeq.push('SP');
    newIntervals.push([lastEnd, wavLength]);
  }

  if (intervals[0][0] <= 0) {
    newWordSeq.shift();
    newIntervals.shift();
  }

  return {
    wordSeq: newWordSeq,
    wordIntervals: newIntervals.map(iv => new Float64Array(iv)),
  };
}

export function postProcess(
  phSeq: string[],
  phIntervals: Float64Array[],
  wordSeq: string[],
  wordIntervals: Float64Array[],
  wavLength: number,
): {
  phSeq: string[];
  phIntervals: Float64Array[];
  wordSeq: string[];
  wordIntervals: Float64Array[];
} {
  const w1 = fillSmallGaps(wordSeq, wordIntervals, wavLength);
  const p1 = fillSmallGaps(phSeq, phIntervals, wavLength);

  const w2 = addSP(w1.wordSeq, w1.wordIntervals, wavLength);
  const p2 = addSP(p1.wordSeq, p1.wordIntervals, wavLength);

  return {
    phSeq: p2.wordSeq,
    phIntervals: p2.wordIntervals,
    wordSeq: w2.wordSeq,
    wordIntervals: w2.wordIntervals,
  };
}
