"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ProviderComparisonChart from "@/components/ProviderComparisonChart";
import ProviderRankingTable from "@/components/ProviderRankingTable";
import FieldBreakdown from "@/components/FieldBreakdown";
import { computeCalibration } from "@/lib/calibration";
import type { CalibrationResult } from "@/lib/calibration";
import { getAllDemoProviders } from "@/lib/demo-data";

const PROVIDER_COLORS: Record<string, string> = {
  "unsiloed":              "#FA82B9",
  "aws-textract":          "#FF9900",
  "google-docai":          "#4285F4",
  "azure-form-recognizer": "#0078D4",
  "modelled":              "#FA82B9",
  "aws":                   "#FF9900",
  "google":                "#4285F4",
};

const DEMO_LABEL_MAP: Record<string, string> = {
  "modelled": "Unsiloed",
  "aws":      "AWS Textract",
  "google":   "Google Document AI",
};

interface ProviderEntry {
  label: string;
  color: string;
  result: CalibrationResult;
}

function CompareResultsContent() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [stpTarget] = useState(0.95);

  useEffect(() => {
    if (isDemo) {
      const demoProviders = getAllDemoProviders();
      const entries: ProviderEntry[] = demoProviders.map(({ provider, label, fieldResults }) => ({
        label,
        color: PROVIDER_COLORS[provider] ?? "#6B7280",
        result: computeCalibration(fieldResults, 0.95),
      }));
      setProviders(entries);
      setLoading(false);
      return;
    }

    const raw = localStorage.getItem("comparison_results");
    if (raw) {
      try {
        setProviders(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, [isDemo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-500">No comparison data found.</p>
          <Link href="/compare" className="text-[#FA82B9] text-sm hover:underline">
            ← Set up a comparison
          </Link>
        </div>
      </div>
    );
  }

  const allFields = Array.from(
    new Set(providers.flatMap((p) => p.result.fieldBreakdown.map((f) => f.field)))
  );

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between bg-white sticky top-0 z-10">
        <Link href="/" className="text-[#111827] font-semibold tracking-tight">
          Unsiloed <span className="text-[#FA82B9]">Calibration</span> Validator
        </Link>
        <div className="flex items-center gap-4">
          {isDemo && (
            <span className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-1 rounded-full">
              Demo · 12 invoices · 3 providers
            </span>
          )}
          <Link href="/compare" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">
            ← Back to Setup
          </Link>
          <Link href="/calibrate" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">
            Single Provider →
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Provider Comparison</h1>
          <p className="text-gray-400 text-sm mt-1">
            {providers.map((p) => p.label).join(" · ")} · calibration quality on same document set
            {isDemo ? " · Demo dataset" : ""}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {providers.map((prov) => (
            <div key={prov.label} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: prov.color }} />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {prov.label}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Overall accuracy</span>
                  <span className="font-mono font-semibold text-[#111827]">
                    {(prov.result.overallAccuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Docs auto-accepted</span>
                  <span className={`font-mono font-semibold ${prov.result.documentStpRate >= 0.5 ? "text-green-600" : "text-amber-600"}`}>
                    {(prov.result.documentStpRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">STP threshold</span>
                  <span className="font-mono text-gray-600">
                    {prov.result.stpThreshold >= 1.0 ? "—" : prov.result.stpThreshold.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Overlay chart */}
        <ProviderComparisonChart providers={providers} />

        {/* Ranking table */}
        <ProviderRankingTable providers={providers} stpTarget={stpTarget} />

        {/* Per-field breakdown per provider */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-[#111827] text-lg font-semibold mb-1">Per-Field Breakdown by Provider</h2>
          <p className="text-gray-400 text-sm mb-5">
            Select a field to see which provider extracts it most reliably.
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {allFields.map((field) => (
              <button
                key={field}
                onClick={() => setActiveField(activeField === field ? null : field)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeField === field
                    ? "bg-[#111827] text-white border-[#111827]"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}
              >
                {field}
              </button>
            ))}
          </div>

          {activeField && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-200 text-left">
                    <th className="pb-3 pr-6 font-medium">Provider</th>
                    <th className="pb-3 pr-6 font-medium">Avg Confidence</th>
                    <th className="pb-3 pr-6 font-medium">Accuracy</th>
                    <th className="pb-3 pr-6 font-medium">Gap</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((prov) => {
                    const row = prov.result.fieldBreakdown.find((f) => f.field === activeField);
                    if (!row) return null;
                    return (
                      <tr key={prov.label} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 pr-6">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: prov.color }} />
                            <span className="font-medium text-[#111827]">{prov.label}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-6 font-mono text-gray-600">{(row.avgConfidence * 100).toFixed(1)}%</td>
                        <td className="py-3 pr-6">
                          <span className={row.actualAccuracy >= 0.9 ? "text-green-600 font-mono" : row.actualAccuracy >= 0.7 ? "text-amber-600 font-mono" : "text-red-600 font-mono"}>
                            {(row.actualAccuracy * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 pr-6 font-mono text-gray-500">
                          {row.gap > 0 ? "+" : ""}{(row.gap * 100).toFixed(1)}pp
                        </td>
                        <td className="py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.status === "calibrated"
                              ? "bg-green-50 text-green-700"
                              : row.status === "overconfident"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!activeField && (
            <p className="text-gray-300 text-sm text-center py-6">
              Select a field above to compare providers
            </p>
          )}
        </div>

        {/* Methodology note */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Methodology</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            All providers were run on identical PDFs with identical ground truth labels.
            Calibration is computed with isotonic regression (PAV) to ensure monotone confidence→accuracy curves,
            Wilson 95% confidence intervals per bucket, and ECE per field.
            STP threshold is the lowest confidence at which smoothed accuracy ≥ {(stpTarget * 100).toFixed(0)}%.
            Doc auto-accept rate counts documents where <em>every</em> field clears the threshold.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function CompareResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <CompareResultsContent />
    </Suspense>
  );
}
