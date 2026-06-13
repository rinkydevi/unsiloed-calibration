"use client";

import type { FieldBreakdownRow } from "@/lib/calibration";

interface Props {
  rows: FieldBreakdownRow[];
}

function StatusBadge({ row }: { row: FieldBreakdownRow }) {
  if (row.status === "calibrated") {
    return <span className="text-green-600">✅ Well-calibrated</span>;
  }
  if (row.status === "overconfident") {
    return (
      <span className="text-amber-600" title={`ECE: ${(row.ece * 100).toFixed(1)}% — model signals more certainty than it delivers`}>
        ⚠️ Overconfident
      </span>
    );
  }
  return (
    <span
      className="text-red-600"
      title={`p = ${row.pValueUnreliable.toFixed(3)} — statistically below 90% accuracy (α = 0.05)`}
    >
      🔴 Unreliable
    </span>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm tabular-nums">{(value * 100).toFixed(1)}%</span>
    </div>
  );
}

function ECEBadge({ ece }: { ece: number }) {
  const pct = (ece * 100).toFixed(1);
  const color =
    ece < 0.03
      ? "text-green-600"
      : ece < 0.05
      ? "text-amber-600"
      : "text-red-600";
  return (
    <span className={`font-mono text-xs tabular-nums ${color}`} title="Expected Calibration Error — lower is better. <3% excellent, <5% acceptable, >5% overconfident.">
      {pct}%
    </span>
  );
}

export default function FieldBreakdown({ rows }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-[#111827] text-lg font-semibold mb-1">Field-Level Breakdown</h2>
      <p className="text-gray-400 text-xs mb-4">
        ECE = Expected Calibration Error per field (lower is better). Status uses
        statistical tests, not hardcoded thresholds &mdash; &ldquo;Unreliable&rdquo; requires
        p&nbsp;&lt;&nbsp;0.05 binomial evidence that accuracy&nbsp;&lt;&nbsp;90%.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-200 text-left">
              <th className="pb-3 pr-4 font-medium">Field</th>
              <th className="pb-3 pr-4 font-medium">Avg Confidence</th>
              <th className="pb-3 pr-4 font-medium">Actual Accuracy</th>
              <th className="pb-3 pr-4 font-medium" title="Avg Confidence − Actual Accuracy">Gap</th>
              <th className="pb-3 pr-4 font-medium" title="Expected Calibration Error — weighted mean |confidence − accuracy| across buckets">ECE</th>
              <th className="pb-3 pr-4 font-medium">n</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.field} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pr-4 text-[#111827] font-mono text-xs">{row.field}</td>
                <td className="py-3 pr-4 text-gray-500">
                  <Bar value={row.avgConfidence} color="#6366F1" />
                </td>
                <td className="py-3 pr-4">
                  <Bar
                    value={row.actualAccuracy}
                    color={
                      row.actualAccuracy >= 0.9
                        ? "#16a34a"
                        : row.actualAccuracy >= 0.7
                        ? "#d97706"
                        : "#dc2626"
                    }
                  />
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`tabular-nums text-sm ${
                      row.gap > 0.08
                        ? "text-amber-600"
                        : row.gap < -0.05
                        ? "text-blue-600"
                        : "text-gray-400"
                    }`}
                  >
                    {row.gap > 0 ? "+" : ""}
                    {(row.gap * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <ECEBadge ece={row.ece} />
                </td>
                <td className="py-3 pr-4 text-gray-400 text-xs tabular-nums">
                  {row.sampleCount}
                </td>
                <td className="py-3">
                  <StatusBadge row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-gray-400 text-xs">
          Gap = Avg Confidence − Actual Accuracy. Positive = model is overconfident on that field.
        </p>
        <p className="text-gray-400 text-xs">
          Overconfident: ECE &gt; 5% and net gap is positive. Unreliable: statistically below 90% accuracy (binomial test, &#945; = 0.05). Hover status badge for details.
        </p>
      </div>
    </div>
  );
}
