import { parse, isValid } from "date-fns";
import { poolAdjacentViolators } from "./isotonic";
import { wilsonCI, binomialLowerPValue, computeECE } from "./statistics";

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
  accuracy: number;       // raw accuracy in this bucket
  count: number;
  smoothedAccuracy: number; // isotonic-regression smoothed
  ciLower: number;          // Wilson 95% lower bound
  ciUpper: number;          // Wilson 95% upper bound
}

export interface FieldBreakdownRow {
  field: string;
  avgConfidence: number;
  actualAccuracy: number;
  gap: number;
  status: "calibrated" | "overconfident" | "unreliable";
  isOverconfident: boolean; // true even when status is "unreliable" — both can co-occur
  ece: number;           // Expected Calibration Error for this field
  sampleCount: number;
  pValueUnreliable: number; // one-sided binomial p-value (H0: accuracy >= 90%)
}

export interface CalibrationResult {
  totalFields: number;
  overallAccuracy: number;
  stpThreshold: number;
  stpRate: number;        // % of fields above threshold
  documentStpRate: number; // % of documents where ALL fields are above threshold
  stpTarget: number;
  calibrationCurve: BucketData[];
  fieldBreakdown: FieldBreakdownRow[];
  fieldResults: FieldResult[];
  sampleSizeWarning: boolean;
  minBucketCount: number;
  thresholdAccuracy: number;  // accuracy specifically on fields above stpThreshold
  thresholdCILower: number;   // Wilson 95% CI lower bound for above-threshold accuracy
  thresholdCIUpper: number;   // Wilson 95% CI upper bound for above-threshold accuracy
}

const DATE_FORMATS = [
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "dd/MM/yyyy",
  "MMMM d, yyyy",
  "MMM d, yyyy",
  "d MMMM yyyy",
  "d MMM yyyy",
  "MM-dd-yyyy",
];

function parseDate(str: string): Date | null {
  for (const fmt of DATE_FORMATS) {
    const d = parse(str.trim(), fmt, new Date());
    if (isValid(d)) return d;
  }
  return null;
}

export function compareValues(
  extracted: string | number | null,
  truth: string | number,
  fieldType: "string" | "number" | "date"
): boolean {
  if (extracted === null || extracted === undefined) return false;

  if (fieldType === "number") {
    const e =
      typeof extracted === "string"
        ? parseFloat(extracted.replace(/[,$]/g, ""))
        : extracted;
    const t =
      typeof truth === "string" ? parseFloat(truth.replace(/[,$]/g, "")) : truth;
    if (isNaN(e) || isNaN(t)) return false;
    if (t === 0) return e === 0;
    return Math.abs(e - t) / Math.abs(t) < 0.01;
  }

  if (fieldType === "date") {
    const ed = parseDate(String(extracted));
    const td = parseDate(String(truth));
    if (!ed || !td) {
      return (
        String(extracted).trim().toLowerCase() ===
        String(truth).trim().toLowerCase()
      );
    }
    return (
      ed.getFullYear() === td.getFullYear() &&
      ed.getMonth() === td.getMonth() &&
      ed.getDate() === td.getDate()
    );
  }

  return (
    String(extracted).trim().toLowerCase() === String(truth).trim().toLowerCase()
  );
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

  // Step 1: Raw calibration curve
  const rawBuckets = BUCKETS.map(({ label, min, max, midpoint }) => {
    const inBucket = results.filter((r) => r.confidence >= min && r.confidence < max);
    const correct = inBucket.filter((r) => r.isCorrect).length;
    return { label, midpoint, count: inBucket.length, correct };
  }).filter((b) => b.count > 0);

  // Step 2: Isotonic regression on bucket accuracies (weighted by count)
  const rawAccuracies = rawBuckets.map((b) => b.correct / b.count);
  const counts = rawBuckets.map((b) => b.count);
  const smoothed = poolAdjacentViolators(rawAccuracies, counts);

  // Step 3: Build calibration curve with smoothed values + Wilson CI per bucket
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

  // Step 4: STP threshold from smoothed buckets
  // Find the leftmost (lowest confidence) bucket where smoothedAccuracy >= stpTarget.
  // Isotonic regression guarantees monotonicity, so once a bucket qualifies,
  // all higher-confidence buckets also qualify.
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

  // Accuracy and Wilson CI on extractions above the threshold — this is what the
  // Finding block should display, NOT overallAccuracy, since the CI is for this subset.
  const aboveCorrect = aboveThreshold.filter((r) => r.isCorrect).length;
  const thresholdAccuracy = aboveThreshold.length > 0 ? aboveCorrect / aboveThreshold.length : overallAccuracy;
  const thresholdCI = wilsonCI(aboveCorrect, aboveThreshold.length);

  // Step 5: Field breakdown with ECE + statistical tests
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

    // isOverconfident is independent of sample reliability — both can be true simultaneously
    const isOverconfident = ece > 0.05 && gap > 0;

    // Statistically unreliable: reject H0 (accuracy >= 90%) at α = 0.05
    // Overconfident label only assigned when sample is reliable enough to trust the signal
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

  // Document STP rate: % of docs where every field is above the threshold.
  // This is the operationally correct metric — a single low-confidence field
  // forces a human to open the document regardless of other fields.
  const docIndices = Array.from(new Set(results.map((r) => r.docIndex)));
  const docsFullyAbove = docIndices.filter((idx) =>
    results.filter((r) => r.docIndex === idx).every((r) => r.confidence >= stpThreshold)
  ).length;
  const documentStpRate = docIndices.length > 0 ? docsFullyAbove / docIndices.length : 0;

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
