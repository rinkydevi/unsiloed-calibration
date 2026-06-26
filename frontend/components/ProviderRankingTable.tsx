"use client";

import type { CalibrationResult } from "@/lib/calibration";

interface ProviderResult {
  label: string;
  color: string;
  result: CalibrationResult;
}

interface Props {
  providers: ProviderResult[];
  stpTarget?: number;
}

function ECEBadge({ ece }: { ece: number }) {
  const pct = (ece * 100).toFixed(1);
  if (ece <= 0.03) return <span className="text-green-600 font-mono">{pct}%</span>;
  if (ece <= 0.06) return <span className="text-amber-600 font-mono">{pct}%</span>;
  return <span className="text-red-600 font-mono">{pct}%</span>;
}

function AccuracyBar({ value }: { value: number }) {
  const pct = value * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 90 ? "bg-green-500" : pct >= 75 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-mono text-sm tabular-nums ${pct >= 90 ? "text-green-600" : pct >= 75 ? "text-amber-600" : "text-red-600"}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function ProviderRankingTable({ providers, stpTarget = 0.95 }: Props) {
  const ranked = [...providers].sort(
    (a, b) => b.result.documentStpRate - a.result.documentStpRate
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-[#111827] text-lg font-semibold mb-1">Provider Ranking</h2>
      <p className="text-gray-400 text-sm mb-5">
        Ranked by doc auto-accept rate at {(stpTarget * 100).toFixed(0)}% accuracy target.
        Lower ECE = better-calibrated confidence scores.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-200 text-left">
              <th className="pb-3 pr-4 font-medium">#</th>
              <th className="pb-3 pr-6 font-medium">Provider</th>
              <th className="pb-3 pr-6 font-medium">Overall Accuracy</th>
              <th className="pb-3 pr-6 font-medium">ECE</th>
              <th className="pb-3 pr-6 font-medium">STP Threshold</th>
              <th className="pb-3 pr-6 font-medium">Fields Auto-Accepted</th>
              <th className="pb-3 font-medium">Docs Auto-Accepted</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((prov, i) => {
              const r = prov.result;
              const overallECE =
                r.fieldBreakdown.reduce((s, f) => s + f.ece * f.sampleCount, 0) /
                Math.max(r.totalFields, 1);
              const isWinner = i === 0;
              return (
                <tr
                  key={prov.label}
                  className={`border-b border-gray-100 ${isWinner ? "bg-green-50" : "hover:bg-gray-50"}`}
                >
                  <td className="py-3 pr-4">
                    <span className={`font-bold ${isWinner ? "text-green-600" : "text-gray-400"}`}>
                      {isWinner ? "★" : i + 1}
                    </span>
                  </td>
                  <td className="py-3 pr-6">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: prov.color }}
                      />
                      <span className={`font-medium ${isWinner ? "text-green-700" : "text-[#111827]"}`}>
                        {prov.label}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-6">
                    <AccuracyBar value={r.overallAccuracy} />
                  </td>
                  <td className="py-3 pr-6">
                    <ECEBadge ece={overallECE} />
                  </td>
                  <td className="py-3 pr-6 font-mono text-gray-600 tabular-nums">
                    {r.stpThreshold >= 1.0 ? "—" : r.stpThreshold.toFixed(2)}
                  </td>
                  <td className="py-3 pr-6 tabular-nums">
                    <span className={r.stpRate >= 0.7 ? "text-green-600" : "text-gray-500"}>
                      {(r.stpRate * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 tabular-nums">
                    <span className={r.documentStpRate >= 0.5 ? "text-green-600 font-semibold" : "text-gray-500"}>
                      {(r.documentStpRate * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Winner callout */}
      {ranked.length > 1 && (
        <div className="mt-5 bg-green-50 border border-green-200 rounded-lg px-5 py-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            <span className="font-semibold text-green-700">{ranked[0].label}</span> leads on document auto-accept rate at{" "}
            <span className="font-mono text-green-700">{(ranked[0].result.documentStpRate * 100).toFixed(0)}%</span>{" "}
            ({(ranked[0].result.documentStpRate * 100 - ranked[ranked.length - 1].result.documentStpRate * 100).toFixed(0)}pp
            ahead of {ranked[ranked.length - 1].label}).
            {ranked[0].result.stpThreshold < 1.0 && (
              <> At a threshold of <span className="font-mono">{ranked[0].result.stpThreshold.toFixed(2)}</span>,
              it achieves <span className="text-green-700">{(ranked[0].result.thresholdAccuracy * 100).toFixed(1)}%</span> accuracy
              on auto-accepted fields.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
