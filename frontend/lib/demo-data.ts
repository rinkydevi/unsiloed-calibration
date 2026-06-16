import { computeCalibration } from "./calibration";
import type { FieldResult, CalibrationResult } from "./calibration";

// ── Document names (shared across all provider demos) ─────────────────────────

export const DEMO_DOC_NAMES: string[] = [
  "invoice_01_INV_2024_0041.pdf",
  "invoice_02_INV_88120.pdf",
  "invoice_03_BCS_2024_007.pdf",
  "invoice_04_SLP_00391.pdf",
  "invoice_05_CV_INV_2024_0152.pdf",
  "invoice_06_MCL_0841.pdf",
  "invoice_07_GPL_2024_3301.pdf",
  "invoice_08_RDS_24_019.pdf",
  "invoice_09_SGS_INV_7724.pdf",
  "invoice_10_PSR_2024_0088.pdf",
  "invoice_11_AOS_10042.pdf",
  "invoice_12_NBC_2024_0021.pdf",
];

// ── AWS Textract results ───────────────────────────────────────────────────────
// Populated by: python3 /tmp/demo-tools/textract-extract.py > /tmp/aws-results.json
// then pasted here. Placeholder until Textract is enabled on the account.

const AWS_FIELD_RESULTS: FieldResult[] = [];

// ── Google Document AI results ────────────────────────────────────────────────
// Populated by: python3 /tmp/demo-tools/google-docai-extract.py > /tmp/google-results.json
// then pasted here. Placeholder until GCP credentials are configured.

const GOOGLE_FIELD_RESULTS: FieldResult[] = [];

// ── Fallback: modelled results used until real extractions are available ───────
// Based on known failure modes of document extractors on these exact invoices.
// invoice_number is overconfident (+19.8pp gap); total_due misses on tax lines.

const MODELLED_FIELD_RESULTS: FieldResult[] = [
  // Doc 0: Acme Supplies Co.
  { field:"vendor_name",    groundTruth:"Acme Supplies Co.",       extracted:"Acme Supplies Co.",       confidence:0.982, isCorrect:true,  docIndex:0 },
  { field:"invoice_number", groundTruth:"INV-2024-0041",           extracted:"INV-2024-0041",           confidence:0.977, isCorrect:true,  docIndex:0 },
  { field:"issue_date",     groundTruth:"2024-03-15",              extracted:"2024-03-15",              confidence:0.994, isCorrect:true,  docIndex:0 },
  { field:"total_due",      groundTruth:"4820.00",                 extracted:"4820.00",                 confidence:0.971, isCorrect:true,  docIndex:0 },
  // Doc 1: TechParts International
  { field:"vendor_name",    groundTruth:"TechParts International", extracted:"TechParts International", confidence:0.961, isCorrect:true,  docIndex:1 },
  { field:"invoice_number", groundTruth:"INV-88120",               extracted:"INV-88120",               confidence:0.983, isCorrect:true,  docIndex:1 },
  { field:"issue_date",     groundTruth:"2024-04-02",              extracted:"2024-04-02",              confidence:0.991, isCorrect:true,  docIndex:1 },
  { field:"total_due",      groundTruth:"12340.50",                extracted:"12340.50",                confidence:0.958, isCorrect:true,  docIndex:1 },
  // Doc 2: Bright Cleaning Services — invoice_number drops leading zero
  { field:"vendor_name",    groundTruth:"Bright Cleaning Services",extracted:"Bright Cleaning Services",confidence:0.944, isCorrect:true,  docIndex:2 },
  { field:"invoice_number", groundTruth:"BCS-2024-007",            extracted:"BCS-2024-07",             confidence:0.927, isCorrect:false, docIndex:2 },
  { field:"issue_date",     groundTruth:"2024-03-31",              extracted:"2024-03-31",              confidence:0.988, isCorrect:true,  docIndex:2 },
  { field:"total_due",      groundTruth:"2160.00",                 extracted:"2160.00",                 confidence:0.975, isCorrect:true,  docIndex:2 },
  // Doc 3: Summit Legal Print — total_due grabs pre-tax subtotal
  { field:"vendor_name",    groundTruth:"Summit Legal Print",      extracted:"Summit Legal Print",      confidence:0.902, isCorrect:true,  docIndex:3 },
  { field:"invoice_number", groundTruth:"SLP-00391",               extracted:"SLP-00391",               confidence:0.918, isCorrect:true,  docIndex:3 },
  { field:"issue_date",     groundTruth:"2024-02-20",              extracted:"2024-02-20",              confidence:0.962, isCorrect:true,  docIndex:3 },
  { field:"total_due",      groundTruth:"875.40",                  extracted:"813.33",                  confidence:0.921, isCorrect:false, docIndex:3 },
  // Doc 4: CloudVault Software LLC
  { field:"vendor_name",    groundTruth:"CloudVault Software LLC", extracted:"CloudVault Software LLC", confidence:0.973, isCorrect:true,  docIndex:4 },
  { field:"invoice_number", groundTruth:"CV-INV-2024-0152",        extracted:"CV-INV-2024-0152",        confidence:0.986, isCorrect:true,  docIndex:4 },
  { field:"issue_date",     groundTruth:"2024-04-01",              extracted:"2024-04-01",              confidence:0.997, isCorrect:true,  docIndex:4 },
  { field:"total_due",      groundTruth:"9600.00",                 extracted:"9600.00",                 confidence:0.968, isCorrect:true,  docIndex:4 },
  // Doc 5: Maple Catering Ltd.
  { field:"vendor_name",    groundTruth:"Maple Catering Ltd.",     extracted:"Maple Catering Ltd.",     confidence:0.856, isCorrect:true,  docIndex:5 },
  { field:"invoice_number", groundTruth:"MCL-0841",                extracted:"MCL-0841",                confidence:0.912, isCorrect:true,  docIndex:5 },
  { field:"issue_date",     groundTruth:"2024-03-22",              extracted:"2024-03-22",              confidence:0.941, isCorrect:true,  docIndex:5 },
  { field:"total_due",      groundTruth:"3348.00",                 extracted:"3348.00",                 confidence:0.877, isCorrect:true,  docIndex:5 },
  // Doc 6: GreenPath Logistics
  { field:"vendor_name",    groundTruth:"GreenPath Logistics",     extracted:"GreenPath Logistics",     confidence:0.963, isCorrect:true,  docIndex:6 },
  { field:"invoice_number", groundTruth:"GPL-2024-3301",           extracted:"GPL-2024-3301",           confidence:0.971, isCorrect:true,  docIndex:6 },
  { field:"issue_date",     groundTruth:"2024-01-18",              extracted:"2024-01-18",              confidence:0.989, isCorrect:true,  docIndex:6 },
  { field:"total_due",      groundTruth:"18750.00",                extracted:"18750.00",                confidence:0.942, isCorrect:true,  docIndex:6 },
  // Doc 7: Riverside Design Studio — invoice_number expands "24" to "2024"
  { field:"vendor_name",    groundTruth:"Riverside Design Studio", extracted:"Riverside Design Studio", confidence:0.913, isCorrect:true,  docIndex:7 },
  { field:"invoice_number", groundTruth:"RDS-24-019",              extracted:"RDS-2024-019",            confidence:0.938, isCorrect:false, docIndex:7 },
  { field:"issue_date",     groundTruth:"2024-02-14",              extracted:"2024-02-14",              confidence:0.957, isCorrect:true,  docIndex:7 },
  { field:"total_due",      groundTruth:"6200.00",                 extracted:"6200.00",                 confidence:0.929, isCorrect:true,  docIndex:7 },
  // Doc 8: SafeGuard Security Inc. — invoice_number drops compound segment at >0.95 conf
  { field:"vendor_name",    groundTruth:"SafeGuard Security Inc.", extracted:"SafeGuard Security Inc.", confidence:0.891, isCorrect:true,  docIndex:8 },
  { field:"invoice_number", groundTruth:"SGS-INV-7724",            extracted:"SGS-7724",                confidence:0.953, isCorrect:false, docIndex:8 },
  { field:"issue_date",     groundTruth:"2024-03-01",              extracted:"2024-03-01",              confidence:0.974, isCorrect:true,  docIndex:8 },
  { field:"total_due",      groundTruth:"5396.00",                 extracted:"5396.00",                 confidence:0.912, isCorrect:true,  docIndex:8 },
  // Doc 9: ProStaff Recruitment
  { field:"vendor_name",    groundTruth:"ProStaff Recruitment",    extracted:"ProStaff Recruitment",    confidence:0.977, isCorrect:true,  docIndex:9 },
  { field:"invoice_number", groundTruth:"PSR-2024-0088",           extracted:"PSR-2024-0088",           confidence:0.969, isCorrect:true,  docIndex:9 },
  { field:"issue_date",     groundTruth:"2024-04-10",              extracted:"2024-04-10",              confidence:0.993, isCorrect:true,  docIndex:9 },
  { field:"total_due",      groundTruth:"7500.00",                 extracted:"7500.00",                 confidence:0.971, isCorrect:true,  docIndex:9 },
  // Doc 10: Apex Office Supplies — total_due is partial sum (misses third line + tax)
  { field:"vendor_name",    groundTruth:"Apex Office Supplies",    extracted:"Apex Office Supplies",    confidence:0.826, isCorrect:true,  docIndex:10 },
  { field:"invoice_number", groundTruth:"AOS-10042",               extracted:"AOS-10042",               confidence:0.874, isCorrect:true,  docIndex:10 },
  { field:"issue_date",     groundTruth:"2024-01-30",              extracted:"2024-01-30",              confidence:0.917, isCorrect:true,  docIndex:10 },
  { field:"total_due",      groundTruth:"1134.90",                 extracted:"1040.19",                 confidence:0.839, isCorrect:false, docIndex:10 },
  // Doc 11: NovaBuild Contractors
  { field:"vendor_name",    groundTruth:"NovaBuild Contractors",   extracted:"NovaBuild Contractors",   confidence:0.958, isCorrect:true,  docIndex:11 },
  { field:"invoice_number", groundTruth:"NBC-2024-0021",           extracted:"NBC-2024-0021",           confidence:0.972, isCorrect:true,  docIndex:11 },
  { field:"issue_date",     groundTruth:"2024-02-29",              extracted:"2024-02-29",              confidence:0.981, isCorrect:true,  docIndex:11 },
  { field:"total_due",      groundTruth:"32400.00",                extracted:"32400.00",                confidence:0.955, isCorrect:true,  docIndex:11 },
];

// ── Exports ───────────────────────────────────────────────────────────────────

export type DemoProvider = "aws" | "google" | "modelled";

function pickResults(provider: DemoProvider): FieldResult[] {
  if (provider === "aws"      && AWS_FIELD_RESULTS.length    > 0) return AWS_FIELD_RESULTS;
  if (provider === "google"   && GOOGLE_FIELD_RESULTS.length > 0) return GOOGLE_FIELD_RESULTS;
  return MODELLED_FIELD_RESULTS;
}

export function getDemoData(provider: DemoProvider = "modelled"): CalibrationResult {
  return computeCalibration(pickResults(provider), 0.95);
}

export function getDemoLabel(provider: DemoProvider): string {
  if (provider === "aws"    && AWS_FIELD_RESULTS.length    > 0) return "AWS Textract";
  if (provider === "google" && GOOGLE_FIELD_RESULTS.length > 0) return "Google Document AI";
  return "Illustrative sample";
}

// Legacy exports kept for backward compat
export const DEMO_DATA: CalibrationResult = getDemoData("modelled");
export const DEMO_DOCUMENT_TYPE = "Invoice";
