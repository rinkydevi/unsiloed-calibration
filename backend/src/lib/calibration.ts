import { poolAdjacentViolators } from "./isotonic.js";
import { wilsonCI, binomialLowerPValue, computeECE } from "./statistics.js";

export interface FieldResult {
  field: string;
  groundTruth: string | number;
  extracted: string | number | null;
  confidence: number;
  isCorrect: boolean;
  docIndex: number;
}

export interface BucketData {
  bucket: string;
  midpoint: number;
  accuracy: number;
  count: number;
  smoothedAccuracy: number;
  ciLower: number;
  ciUpper: number;
}

export interface FieldBreakdownRow {
  field: string;
  avgConfidence: number;
  actualAccuracy: number;
  gap: number;
  status: "calibrated" | "overconfident" | "unreliable";
  isOverconfident: boolean;
  ece: number;
  sampleCount: number;
  pValueUnreliable: number;
}

export interface CalibrationResult {
  totalFields: number;
  overallAccuracy: number;
  stpThreshold: number;
  stpRate: number;
  documentStpRate: number;
  stpTarget: number;
  calibrationCurve: BucketData[];
  fieldBreakdown: FieldBreakdownRow[];
  fieldResults: FieldResult[];
  sampleSizeWarning: boolean;
  minBucketCount: number;
  thresholdAccuracy: number;
  thresholdCILower: number;
  thresholdCIUpper: number;
}

export const BUCKETS = [
  { label: "0.0–0.6",   min: 0,    max: 0.6,   midpoint: 0.3   },
  { label: "0.6–0.7",   min: 0.6,  max: 0.7,   midpoint: 0.65  },
  { label: "0.7–0.8",   min: 0.7,  max: 0.8,   midpoint: 0.75  },
  { label: "0.8–0.9",   min: 0.8,  max: 0.9,   midpoint: 0.85  },
  { label: "0.9–0.95",  min: 0.9,  max: 0.95,  midpoint: 0.925 },
  { label: "0.95–1.0",  min: 0.95, max: 1.001, midpoint: 0.975 },
];

export function computeCalibration(
  results: FieldResult[],
  stpTarget: number = 0.95
): CalibrationResult {
  const totalFields = results.length;
  const correctCount = results.filter((r) => r.isCorrect).length;
  const overallAccuracy = totalFields > 0 ? correctCount / totalFields : 0;

  const rawBuckets = BUCKETS.map(({ label, min, max, midpoint }) => {
    const inBucket = results.filter((r) => r.confidence >= min && r.confidence < max);
    const correct = inBucket.filter((r) => r.isCorrect).length;
    return { label, midpoint, count: inBucket.length, correct };
  }).filter((b) => b.count > 0);

  const rawAccuracies = rawBuckets.map((b) => b.correct / b.count);
  const counts = rawBuckets.map((b) => b.count);
  const smoothed = poolAdjacentViolators(rawAccuracies, counts);

  const calibrationCurve: BucketData[] = rawBuckets.map((b, i) => {
    const ci = wilsonCI(b.correct, b.count);
    return {
      bucket: b.label,
      midpoint: b.midpoint,
      accuracy: rawAccuracies[i],
      count: b.count,
      smoothedAccuracy: smoothed[i],
      ciLower: ci.lower,
      ciUpper: ci.upper,
    };
  });

  let stpThreshold = 1.0;
  const qualifyingBucket = calibrationCurve.find(
    (b) => b.smoothedAccuracy >= stpTarget
  );
  if (qualifyingBucket) {
    const match = BUCKETS.find((b) => b.label === qualifyingBucket.bucket);
    stpThreshold = match?.min ?? qualifyingBucket.midpoint;
  }

  const aboveThreshold = results.filter((r) => r.confidence >= stpThreshold);
  const stpRate = totalFields > 0 ? aboveThreshold.length / totalFields : 0;

  const aboveCorrect = aboveThreshold.filter((r) => r.isCorrect).length;
  const thresholdAccuracy =
    aboveThreshold.length > 0 ? aboveCorrect / aboveThreshold.length : overallAccuracy;
  const thresholdCI = wilsonCI(aboveCorrect, aboveThreshold.length);

  const fieldNames = Array.from(new Set(results.map((r) => r.field)));
  const fieldBreakdown: FieldBreakdownRow[] = fieldNames.map((field) => {
    const fieldResults = results.filter((r) => r.field === field);
    const n = fieldResults.length;
    const avgConfidence = fieldResults.reduce((s, r) => s + r.confidence, 0) / n;
    const correctForField = fieldResults.filter((r) => r.isCorrect).length;
    const actualAccuracy = correctForField / n;
    const gap = avgConfidence - actualAccuracy;
    const ece = computeECE(fieldResults, BUCKETS);
    const pValueUnreliable = binomialLowerPValue(correctForField, n, 0.9);

    const isOverconfident = ece > 0.05 && gap > 0;

    let status: "calibrated" | "overconfident" | "unreliable";
    if (pValueUnreliable < 0.05) {
      status = "unreliable";
    } else if (isOverconfident) {
      status = "overconfident";
    } else {
      status = "calibrated";
    }

    return {
      field,
      avgConfidence,
      actualAccuracy,
      gap,
      status,
      isOverconfident,
      ece,
      sampleCount: n,
      pValueUnreliable,
    };
  });

  const docIndices = Array.from(new Set(results.map((r) => r.docIndex)));
  const docsFullyAbove = docIndices.filter((idx) =>
    results.filter((r) => r.docIndex === idx).every((r) => r.confidence >= stpThreshold)
  ).length;
  const documentStpRate =
    docIndices.length > 0 ? docsFullyAbove / docIndices.length : 0;

  const minBucketCount =
    calibrationCurve.length > 0
      ? Math.min(...calibrationCurve.map((b) => b.count))
      : 0;
  const sampleSizeWarning = totalFields < 50 || minBucketCount < 5;

  return {
    totalFields,
    overallAccuracy,
    stpThreshold,
    stpRate,
    documentStpRate,
    stpTarget,
    calibrationCurve,
    fieldBreakdown,
    fieldResults: results,
    sampleSizeWarning,
    minBucketCount,
    thresholdAccuracy,
    thresholdCILower: thresholdCI.lower,
    thresholdCIUpper: thresholdCI.upper,
  };
}
