"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import CalibrationCurve from "@/components/CalibrationCurve";
import FieldBreakdown from "@/components/FieldBreakdown";
import PerFieldCurves from "@/components/PerFieldCurves";
import STPCalculator from "@/components/STPCalculator";
import { getDemoData, getDemoLabel, DEMO_DOC_NAMES, type DemoProvider } from "@/lib/demo-data";
import { computeCalibration } from "@/lib/calibration";
import type { CalibrationResult, FieldResult } from "@/lib/calibration";
import { saveRunAuto, getLocalRun, getRun } from "@/lib/api-client";
import { BACKEND_ENABLED } from "@/lib/config";

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold tabular-nums ${accent ? "text-green-600" : "text-[#111827]"}`}>
        {value}
      </div>
      {sub && <div className="text-gray-400 text-xs mt-1">{sub}</div>}
    </div>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const demoParam = searchParams.get("demo");
  const isDemo = demoParam === "true" || demoParam === "aws" || demoParam === "google";
  const demoProvider: DemoProvider =
    demoParam === "aws" ? "aws" : demoParam === "google" ? "google" : "modelled";

  const [data, setData] = useState<CalibrationResult | null>(null);
  const [baseFieldResults, setBaseFieldResults] = useState<FieldResult[]>([]);
  const [docType, setDocType] = useState("Document");
  const [docNames, setDocNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [stpTarget, setStpTarget] = useState(0.95);
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const runId = searchParams.get("runId");

  useEffect(() => {
    const load = async () => {
      if (isDemo) {
        const demo = getDemoData(demoProvider);
        setData(demo);
        setBaseFieldResults(demo.fieldResults);
        setDocType("Invoice");
        setDocNames(DEMO_DOC_NAMES);
        setLoading(false);
        return;
      }

      if (runId) {
        try {
          const run = BACKEND_ENABLED
            ? await getRun(runId)
            : getLocalRun(runId);
          if (run) {
            setData(run.calibrationResult);
            setBaseFieldResults(run.calibrationResult.fieldResults);
            setDocType(run.docType);
            setDocNames(run.docNames);
            setSavedRunId(runId);
          } else {
            router.replace("/history");
          }
        } catch {
          router.replace("/history");
        }
        setLoading(false);
        return;
      }

      const raw = localStorage.getItem("unsiloed_last_calibration");
      const type = localStorage.getItem("unsiloed_last_calibration_doc_type");
      const names = localStorage.getItem("unsiloed_last_calibration_doc_names");
      if (raw) {
        const parsed: CalibrationResult = JSON.parse(raw);
        setData(parsed);
        setBaseFieldResults(parsed.fieldResults);
        setDocType(type ?? "Document");
        setDocNames(names ? (JSON.parse(names) as string[]) : []);
      } else {
        router.replace("/calibrate");
      }
      setLoading(false);
    };
    load();
  }, [isDemo, router, runId]);

  const handleSaveRun = async () => {
    if (!data || savedRunId) return;
    setSaving(true);
    try {
      const id = await saveRunAuto({
        docType,
        docNames,
        calibrationResult: data,
      });
      setSavedRunId(id);
      router.replace(`/results?runId=${id}`);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTargetChange = (target: number) => {
    setStpTarget(target);
    const source = baseFieldResults.length > 0 ? baseFieldResults : [];
    if (source.length > 0) {
      setData(computeCalibration(source, target));
    }
  };

  const exportReport = () => {
    if (!data) return;
    const html = generateReport(data, docType, isDemo, docNames);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unsiloed-calibration-report.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sub1pctResult = useMemo(() => {
    if (baseFieldResults.length === 0) return null;
    return computeCalibration(baseFieldResults, 0.99);
  }, [baseFieldResults]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (!data) return null;

  const stpPct = (data.stpRate * 100).toFixed(0);
  const docStpPct = (data.documentStpRate * 100).toFixed(0);
  const accuracyPct = (data.overallAccuracy * 100).toFixed(1);
  const thresholdAccuracyPct = ((data.thresholdAccuracy ?? data.overallAccuracy) * 100).toFixed(1);
  const thresholdStr = data.stpThreshold.toFixed(2);
  const sub1pctThreshold = sub1pctResult?.stpThreshold ?? 1.0;
  const sub1pctDocStpPct = sub1pctResult && sub1pctResult.stpThreshold < 1.0
    ? (sub1pctResult.documentStpRate * 100).toFixed(0)
    : null;

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between bg-white sticky top-0 z-10">
        <Link href="/" className="text-[#111827] font-semibold tracking-tight">
          Unsiloed <span className="text-[#FA82B9]">Calibration</span> Validator
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/history" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">History</Link>
          {isDemo && (
            <span className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-1 rounded-full">
              Demo · {getDemoLabel(demoProvider)}
            </span>
          )}
          <Link href="/calibrate" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">
            Run Your Own →
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Calibration Report</h1>
            <p className="text-gray-400 text-sm mt-1">
              {docType} · {data.totalFields} fields evaluated
              {isDemo ? " · Demo dataset" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isDemo && !savedRunId && (
              <button
                onClick={handleSaveRun}
                disabled={saving}
                className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save Run"}
              </button>
            )}
            {savedRunId && (
              <Link
                href="/history"
                className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                ✓ Saved · View history
              </Link>
            )}
            <button
              onClick={exportReport}
              className="border border-gray-300 text-gray-500 hover:text-[#111827] hover:border-gray-400 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Download Report
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Docs Auto-Accepted"
            value={`${docStpPct}%`}
            sub="of documents need zero human review"
            accent
          />
          <StatCard
            label="Sub-1% Error Threshold"
            value={sub1pctThreshold < 1.0 ? sub1pctThreshold.toFixed(2) : "—"}
            sub={sub1pctDocStpPct
              ? `covers ${sub1pctDocStpPct}% of docs · <1% error rate`
              : "not reached in this dataset"}
          />
          <StatCard
            label="STP Threshold"
            value={thresholdStr}
            sub={`at ${(stpTarget * 100).toFixed(0)}% accuracy target · ${stpPct}% of fields`}
          />
          <StatCard
            label="Fields Evaluated"
            value={String(data.totalFields)}
            sub={`${accuracyPct}% overall accuracy`}
          />
        </div>

        {/* Sample size warning */}
        {data.sampleSizeWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4">
            <p className="text-amber-700 text-sm leading-relaxed">
              <span className="font-semibold">Statistical note:</span>{" "}
              {data.totalFields} fields evaluated (min {data.minBucketCount} per confidence band).
              For reliable calibration, aim for 50+ fields with 10+ per band.
              Treat these results as directional — upload more documents to confirm.
            </p>
          </div>
        )}

        {/* Calibration quality gate */}
        {!isDemo && (() => {
          const reasons: string[] = [];
          if (data.stpThreshold >= 1.0 && data.calibrationCurve.length > 0)
            reasons.push("no confidence threshold reached the 95% accuracy target");
          if (data.overallAccuracy < 0.75)
            reasons.push(`overall accuracy is only ${(data.overallAccuracy * 100).toFixed(1)}%`);
          const unreliableCount = data.fieldBreakdown.filter((f) => f.status === "unreliable").length;
          if (unreliableCount > 0 && unreliableCount >= Math.ceil(data.fieldBreakdown.length / 2))
            reasons.push(`${unreliableCount} of ${data.fieldBreakdown.length} fields are statistically unreliable`);
          if (reasons.length === 0) return null;
          return (
            <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 space-y-2">
              <p className="text-red-700 text-sm font-semibold">Weak calibration detected</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                {reasons.map((r, i) => (
                  <span key={i}>{i > 0 ? "; " : ""}{r.charAt(0).toUpperCase() + r.slice(1)}</span>
                ))}.
              </p>
              <p className="text-gray-500 text-xs leading-relaxed">
                Before concluding the model is poorly calibrated on your documents, check:
                scan quality and resolution, whether the selected schema fields match your document layout,
                and whether you have enough samples (50+ fields recommended). Poor calibration can reflect
                document or ground-truth issues as much as model limitations.
              </p>
            </div>
          );
        })()}

        {/* Key insight */}
        <div className="bg-gray-50 border border-gray-200 border-l-4 border-l-[#FA82B9] rounded-r-lg px-6 py-5 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            <span className="text-[#FA82B9] font-semibold">Finding: </span>
            At a confidence threshold of <span className="text-[#111827] font-mono">{thresholdStr}</span>,
            Unsiloed achieves{" "}
            <span className="text-green-600">{thresholdAccuracyPct}%</span> accuracy
            {data.thresholdCILower !== undefined && data.thresholdCIUpper !== undefined && data.stpRate > 0 && (
              <span className="text-gray-400">
                {" "}(95% CI: {(data.thresholdCILower * 100).toFixed(1)}%–{(data.thresholdCIUpper * 100).toFixed(1)}%)
              </span>
            )}
            {" "}on the{" "}
            <span className="text-green-600">{stpPct}%</span> of your {docType.toLowerCase()} fields above this threshold
            — your team only reviews the remaining{" "}
            <span className="text-[#111827]">{100 - Number(stpPct)}%</span> where the model signals genuine uncertainty.
          </p>
          {data.fieldBreakdown.some((f) => f.isOverconfident) && (
            <p className="text-sm text-gray-500 leading-relaxed border-t border-gray-200 pt-3">
              <span className="text-amber-600 font-semibold">Caution: </span>
              {data.fieldBreakdown
                .filter((f) => f.isOverconfident)
                .map((f) => f.field)
                .join(", ")}{" "}
              {data.fieldBreakdown.filter((f) => f.isOverconfident).length === 1
                ? "is overconfident"
                : "are overconfident"}{" "}
              — the model reports high confidence but accuracy is lower than expected.
              Exclude these fields from auto-accept or apply a higher threshold for them specifically.
            </p>
          )}
        </div>

        <CalibrationCurve data={data.calibrationCurve} />
        <PerFieldCurves fieldResults={data.fieldResults} fieldBreakdown={data.fieldBreakdown} />
        <FieldBreakdown rows={data.fieldBreakdown} />
        <STPCalculator
          stpThreshold={data.stpThreshold}
          fieldResults={data.fieldResults}
          stpTarget={stpTarget}
          onTargetChange={handleTargetChange}
        />

        {/* Per-document breakdown */}
        {(() => {
          const docIndices = Array.from(new Set(data.fieldResults.map((r) => r.docIndex))).sort((a, b) => a - b);
          if (docIndices.length < 2) return null;
          const docRows = docIndices.map((idx) => {
            const docFields = data.fieldResults.filter((r) => r.docIndex === idx);
            const correct = docFields.filter((r) => r.isCorrect).length;
            const accuracy = correct / docFields.length;
            const avgConf = docFields.reduce((s, r) => s + r.confidence, 0) / docFields.length;
            return { idx, fields: docFields.length, accuracy, avgConf };
          });
          return (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-[#111827] text-lg font-semibold mb-1">Per-Document Results</h2>
              <p className="text-gray-500 text-sm mb-4">
                Which documents extracted cleanly — useful for spotting outlier layouts or scan quality issues.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-200 text-left">
                      <th className="pb-3 pr-6 font-medium">Document</th>
                      <th className="pb-3 pr-6 font-medium">Fields Evaluated</th>
                      <th className="pb-3 pr-6 font-medium">Avg Confidence</th>
                      <th className="pb-3 font-medium">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docRows.map(({ idx, fields, accuracy, avgConf }) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 pr-6 text-[#111827] font-mono text-xs">
                          {docNames[idx] ?? `doc_${idx + 1}.pdf`}
                        </td>
                        <td className="py-3 pr-6 text-gray-500">{fields}</td>
                        <td className="py-3 pr-6 text-gray-500">{(avgConf * 100).toFixed(1)}%</td>
                        <td className="py-3">
                          <span
                            className={
                              accuracy >= 0.9
                                ? "text-green-600"
                                : accuracy >= 0.7
                                ? "text-amber-600"
                                : "text-red-600"
                            }
                          >
                            {(accuracy * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

    </main>
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateReport(data: CalibrationResult, docType: string, isDemo: boolean, docNames: string[]): string {
  const rows = data.fieldBreakdown.map((r) => `
    <tr>
      <td>${escapeHtml(r.field)}</td>
      <td>${(r.avgConfidence * 100).toFixed(1)}%</td>
      <td>${(r.actualAccuracy * 100).toFixed(1)}%</td>
      <td>${r.gap > 0 ? "+" : ""}${(r.gap * 100).toFixed(1)}%</td>
      <td>${r.status === "calibrated" ? "✅ Well-calibrated" : r.status === "overconfident" ? "⚠️ Overconfident" : "🔴 Unreliable"}</td>
    </tr>`).join("");

  const curveRows = data.calibrationCurve.map((b) => `
    <tr>
      <td>${b.bucket}</td>
      <td>${b.count}</td>
      <td>${(b.accuracy * 100).toFixed(1)}%</td>
      <td>${(b.midpoint * 100).toFixed(1)}%</td>
    </tr>`).join("");

  const docRows = (() => {
    const indices = Array.from(new Set(data.fieldResults.map((r) => r.docIndex))).sort((a, b) => a - b);
    if (indices.length < 2) return "";
    const rows = indices.map((idx) => {
      const docFields = data.fieldResults.filter((r) => r.docIndex === idx);
      const correct = docFields.filter((r) => r.isCorrect).length;
      const accuracy = correct / docFields.length;
      const avgConf = docFields.reduce((s, r) => s + r.confidence, 0) / docFields.length;
      const name = docNames[idx] ?? `doc_${idx + 1}.pdf`;
      return `<tr><td>${escapeHtml(name)}</td><td>${docFields.length}</td><td>${(avgConf * 100).toFixed(1)}%</td><td>${(accuracy * 100).toFixed(0)}%</td></tr>`;
    }).join("");
    return `
  <h2 style="color:#6B7280;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;margin:32px 0 16px">Per-Document Results</h2>
  <table>
    <thead><tr><th>Document</th><th>Fields</th><th>Avg Confidence</th><th>Accuracy</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  })();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Unsiloed Calibration Report</title>
  <style>
    body { background: #ffffff; color: #111827; font-family: "Geist", "General Sans", Inter, system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #6B7280; font-size: 14px; margin-bottom: 32px; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; }
    .stat-label { color: #9CA3AF; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .stat-value { font-size: 28px; font-weight: 700; color: #111827; }
    .green { color: #16a34a; }
    table { width: 100%; border-collapse: collapse; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; margin-bottom: 8px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #F3F4F6; font-size: 13px; color: #374151; }
    th { color: #9CA3AF; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; background: #F9FAFB; }
    .insight { background: #F9FAFB; border: 1px solid #E5E7EB; border-left: 3px solid #FA82B9; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0; }
    .demo-tag { background: #fffbeb; border: 1px solid #fde68a; color: #d97706; padding: 4px 12px; border-radius: 100px; font-size: 12px; display: inline-block; margin-bottom: 16px; }
    .section-note { color: #9CA3AF; font-size: 12px; margin-bottom: 16px; }
    footer { color: #D1D5DB; font-size: 12px; text-align: center; margin-top: 48px; }
  </style>
</head>
<body>
  <h1>Unsiloed Calibration Report</h1>
  ${isDemo ? '<span class="demo-tag">Demo — sample financial documents</span>' : ""}
  <div class="subtitle">${escapeHtml(docType)} · ${data.totalFields} fields evaluated</div>

  <div class="stats">
    <div class="stat"><div class="stat-label">Fields Evaluated</div><div class="stat-value">${data.totalFields}</div></div>
    <div class="stat"><div class="stat-label">Overall Accuracy</div><div class="stat-value green">${(data.overallAccuracy * 100).toFixed(1)}%</div></div>
    <div class="stat"><div class="stat-label">STP Threshold</div><div class="stat-value">${data.stpThreshold.toFixed(2)}</div></div>
    <div class="stat"><div class="stat-label">STP Rate (fields)</div><div class="stat-value green">${(data.stpRate * 100).toFixed(0)}%</div></div>
    <div class="stat"><div class="stat-label">STP Rate (docs)</div><div class="stat-value green">${(data.documentStpRate * 100).toFixed(0)}%</div></div>
  </div>

  <div class="insight">
    At a confidence threshold of <strong>${data.stpThreshold.toFixed(2)}</strong>,
    Unsiloed achieves <strong style="color:#16a34a">${((data.thresholdAccuracy ?? data.overallAccuracy) * 100).toFixed(1)}%</strong> accuracy
    on the <strong>${(data.stpRate * 100).toFixed(0)}%</strong> of ${escapeHtml(docType.toLowerCase())} fields above this threshold
    — your team only reviews the remaining ${(100 - data.stpRate * 100).toFixed(0)}%.
  </div>

  <h2 style="color:#9CA3AF;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px">Field Breakdown</h2>
  <table>
    <thead><tr><th>Field</th><th>Avg Confidence</th><th>Actual Accuracy</th><th>Gap</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2 style="color:#9CA3AF;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;margin:32px 0 8px">Calibration Curve</h2>
  <p class="section-note">A well-calibrated model follows the diagonal (confidence = accuracy). Points below = overconfident.</p>
  <table>
    <thead><tr><th>Confidence Band</th><th>Sample Count</th><th>Actual Accuracy</th><th>Perfect Calibration</th></tr></thead>
    <tbody>${curveRows}</tbody>
  </table>

  ${docRows}

  <footer>Generated by Unsiloed Calibration Validator</footer>
</body>
</html>`;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
