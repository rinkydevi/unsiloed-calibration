/**
 * Statistical utilities for calibration analysis.
 * No project imports — pure math functions only.
 */

// Abramowitz & Stegun approximation for standard normal CDF (max error ~7.5e-8)
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const phi = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? 1 - phi : phi;
}

/**
 * Wilson score 95% confidence interval for a proportion.
 * More accurate than normal approximation for small n or extreme p.
 */
export function wilsonCI(
  k: number,
  n: number,
  z = 1.96
): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 1 };
  const p = k / n;
  const z2 = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margin =
    (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

/**
 * One-sided binomial lower-tail p-value (normal approximation with continuity correction).
 * Tests H0: true accuracy >= p0  vs  H1: accuracy < p0.
 * Small p-value = strong evidence the field is performing below p0.
 */
export function binomialLowerPValue(k: number, n: number, p0: number): number {
  if (n === 0) return 1;
  const mu = n * p0;
  const sigma = Math.sqrt(n * p0 * (1 - p0));
  if (sigma === 0) return k < n * p0 ? 0 : 1;
  const z = (k + 0.5 - mu) / sigma; // +0.5 continuity correction
  return normalCDF(z);
}

/**
 * Expected Calibration Error (ECE) for a set of results within named confidence buckets.
 * ECE = weighted mean |confidence − accuracy| across buckets.
 * Literature threshold for "well-calibrated": ECE < 0.05.
 */
export function computeECE(
  results: Array<{ confidence: number; isCorrect: boolean }>,
  buckets: Array<{ min: number; max: number }>
): number {
  const n = results.length;
  if (n === 0) return 0;
  return buckets.reduce((ece, bucket) => {
    const inBucket = results.filter(
      (r) => r.confidence >= bucket.min && r.confidence < bucket.max
    );
    if (inBucket.length === 0) return ece;
    const avgConf = inBucket.reduce((s, r) => s + r.confidence, 0) / inBucket.length;
    const accuracy = inBucket.filter((r) => r.isCorrect).length / inBucket.length;
    return ece + (inBucket.length / n) * Math.abs(avgConf - accuracy);
  }, 0);
}
