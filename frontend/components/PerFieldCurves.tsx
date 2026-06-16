"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { FieldResult, BucketData, FieldBreakdownRow } from "@/lib/calibration";
import { BUCKETS } from "@/lib/calibration";
import { poolAdjacentViolators } from "@/lib/isotonic";
import { wilsonCI } from "@/lib/statistics";

interface Props {
  fieldResults: FieldResult[];
  fieldBreakdown: FieldBreakdownRow[];
}

function computeFieldBuckets(results: FieldResult[]): BucketData[] {
  const rawBuckets = BUCKETS.map(({ label, min, max, midpoint }) => {
    const inBucket = results.filter((r) => r.confidence >= min && r.confidence < max);
    const correct = inBucket.filter((r) => r.isCorrect).length;
    return { label, midpoint, count: inBucket.length, correct };
  }).filter((b) => b.count > 0);

  if (rawBuckets.length === 0) return [];

  const rawAccuracies = rawBuckets.map((b) => b.correct / b.count);
  const counts = rawBuckets.map((b) => b.count);
  const smoothed = poolAdjacentViolators(rawAccuracies, counts);

  return rawBuckets.map((b, i) => {
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
}

const STATUS_STYLES = {
  calibrated: {
    border: "border-green-200",
    badge: "text-green-700 bg-green-50",
    label: "Calibrated",
  },
  overconfident: {
    border: "border-amber-200",
    badge: "text-amber-700 bg-amber-50",
    label: "Overconfident",
  },
  unreliable: {
    border: "border-red-200",
    badge: "text-red-700 bg-red-50",
    label: "Unreliable",
  },
};

function SmallTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BucketData & { perfectAccuracy: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded px-2 py-1.5 text-xs shadow-sm">
      <div className="text-gray-400 mb-0.5">{d.bucket}</div>
      <div className="text-[#111827]">
        Smoothed: {(d.smoothedAccuracy * 100).toFixed(1)}%
      </div>
      <div className="text-gray-400">Raw: {(d.accuracy * 100).toFixed(1)}%</div>
      <div className="text-gray-400">n = {d.count}</div>
    </div>
  );
}

function FieldChart({
  fieldName,
  results,
  breakdown,
}: {
  fieldName: string;
  results: FieldResult[];
  breakdown: FieldBreakdownRow | undefined;
}) {
  const buckets = computeFieldBuckets(results);
  const chartData = buckets.map((b) => ({ ...b, perfectAccuracy: b.midpoint }));
  const status = breakdown?.status ?? "calibrated";
  const styles = STATUS_STYLES[status];
  const ece = breakdown ? (breakdown.ece * 100).toFixed(1) : "—";
  const accuracyPct = breakdown
    ? (breakdown.actualAccuracy * 100).toFixed(0)
    : "—";
  const avgConfPct = breakdown
    ? (breakdown.avgConfidence * 100).toFixed(1)
    : "—";
  const n = results.length;

  return (
    <div className={`bg-white border rounded-lg p-4 ${styles.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-sm text-[#111827]">{fieldName}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400" title="Expected Calibration Error">
            ECE {ece}%
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}
          >
            {styles.label}
          </span>
        </div>
      </div>

      {buckets.length < 2 ? (
        <div className="h-[180px] flex items-center justify-center text-gray-300 text-xs text-center px-4">
          Not enough spread across confidence bands to plot a curve
          <br />
          (n = {n})
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="midpoint"
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => (v as number).toFixed(1)}
              tick={{ fill: "#9CA3AF", fontSize: 10 }}
              stroke="#E5E7EB"
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${((v as number) * 100).toFixed(0)}%`}
              tick={{ fill: "#9CA3AF", fontSize: 10 }}
              stroke="#E5E7EB"
            />
            <Tooltip content={<SmallTooltip />} />
            <Line
              type="monotone"
              dataKey="perfectAccuracy"
              stroke="#E5E7EB"
              strokeDasharray="4 2"
              strokeWidth={1}
              dot={false}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#D1D5DB"
              strokeDasharray="3 2"
              strokeWidth={1.5}
              dot={false}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="smoothedAccuracy"
              stroke="#191919"
              strokeWidth={2}
              dot={{ r: 3, fill: "#191919", stroke: "#fff", strokeWidth: 1.5 }}
              legendType="none"
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <p className="text-gray-400 text-xs mt-2">
        n = {n} · {accuracyPct}% accuracy · avg conf {avgConfPct}%
      </p>
    </div>
  );
}

export default function PerFieldCurves({ fieldResults, fieldBreakdown }: Props) {
  const fieldNames = Array.from(new Set(fieldResults.map((r) => r.field)));

  if (fieldNames.length < 2) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-[#111827] text-lg font-semibold">
          Per-Field Calibration Curves
        </h2>
        <p className="text-gray-400 text-xs mt-1">
          Each field gets its own curve — a field can be overconfident even when
          the aggregate looks fine. Dark line = isotonic-smoothed. Grey dashed = raw.
          Diagonal = perfect calibration.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fieldNames.map((field) => (
          <FieldChart
            key={field}
            fieldName={field}
            results={fieldResults.filter((r) => r.field === field)}
            breakdown={fieldBreakdown.find((b) => b.field === field)}
          />
        ))}
      </div>
    </div>
  );
}
