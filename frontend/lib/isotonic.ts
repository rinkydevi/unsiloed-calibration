/**
 * Pool Adjacent Violators (PAV) algorithm for weighted isotonic regression.
 * Returns a non-decreasing sequence that minimizes weighted squared error.
 * Used to smooth calibration curves so a single noisy bucket can't collapse the STP threshold.
 */
export function poolAdjacentViolators(
  values: number[],
  weights: number[]
): number[] {
  if (values.length === 0) return [];

  type Block = { sum: number; weight: number; start: number; end: number };
  const blocks: Block[] = [];

  for (let i = 0; i < values.length; i++) {
    blocks.push({
      sum: values[i] * weights[i],
      weight: weights[i],
      start: i,
      end: i,
    });

    // Merge with previous block while monotonicity is violated
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (prev.sum / prev.weight <= last.sum / last.weight) break;
      prev.sum += last.sum;
      prev.weight += last.weight;
      prev.end = last.end;
      blocks.pop();
    }
  }

  const result = new Array<number>(values.length);
  for (const block of blocks) {
    const avg = block.sum / block.weight;
    for (let i = block.start; i <= block.end; i++) {
      result[i] = avg;
    }
  }
  return result;
}
