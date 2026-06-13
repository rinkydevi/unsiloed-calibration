import { computeCalibration } from "./calibration";
import type { FieldResult, CalibrationResult } from "./calibration";

function generateDemoFieldResults(): FieldResult[] {
  const fields = ["company_name", "report_date", "total_revenue", "total_expenses", "net_income"];
  // Realistic distribution: skewed toward high confidence, with a genuine
  // non-monotonicity between 0.7–0.8 and 0.8–0.9 that isotonic regression smooths out.
  const buckets = [
    { min: 0.0,  max: 0.6,  count: 7,  correctCount: 3  },  // 42.9%
    { min: 0.6,  max: 0.7,  count: 12, correctCount: 8  },  // 66.7%
    { min: 0.7,  max: 0.8,  count: 18, correctCount: 14 },  // 77.8% — above next bucket (non-monotone)
    { min: 0.8,  max: 0.9,  count: 27, correctCount: 19 },  // 70.4% — isotonic merges this with above
    { min: 0.9,  max: 0.95, count: 34, correctCount: 32 },  // 94.1%
    { min: 0.95, max: 1.0,  count: 52, correctCount: 51 },  // 98.1%
  ];

  const results: FieldResult[] = [];
  let fieldIdx = 0;
  let docIdx = 0;

  buckets.forEach(({ min, max, count, correctCount }) => {
    for (let i = 0; i < count; i++) {
      const confidence = min + ((max - min) * (i + 0.5)) / count;
      results.push({
        field: fields[fieldIdx % fields.length],
        groundTruth: "demo-value",
        extracted: i < correctCount ? "demo-value" : "wrong-value",
        confidence,
        isCorrect: i < correctCount,
        docIndex: docIdx,
      });
      fieldIdx++;
      if (fieldIdx % fields.length === 0) docIdx++;
    }
  });

  return results;
}

// Compute from raw field results so DEMO_DATA always carries all fields
// (including new ones like smoothedAccuracy, ciLower, thresholdCILower, etc.)
export const DEMO_DATA: CalibrationResult = computeCalibration(
  generateDemoFieldResults(),
  0.95
);

export const DEMO_DOCUMENT_TYPE = "Financial Filing";
