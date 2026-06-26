"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { CalibrationResult } from "@/lib/calibration";

interface ProviderResult {
  label: string;
  color: string;
  result: CalibrationResult;
}

interface Props {
  providers: ProviderResult[];
}

const BUCKET_LABELS = ["0.0–0.6", "0.6–0.7", "0.7–0.8", "0.8–0.9", "0.9–0.95", "0.95–1.0"];
const MIDPOINTS = [0.3, 0.65, 0.75, 0.85, 0.925, 0.975];

export default function ProviderComparisonChart({ providers }: Props) {
  const chartData = BUCKET_LABELS.map((bucket, i) => {
    const row: Record<string, number | string> = { bucket, midpoint: MIDPOINTS[i] };
    for (const prov of providers) {
      const b = prov.result.calibrationCurve.find((c) => c.bucket === bucket);
      if (b) row[prov.label] = parseFloat((b.smoothedAccuracy * 100).toFixed(1));
    }
    return row;
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-[#111827] text-lg font-semibold mb-1">Calibration Curves — All Providers</h2>
      <p className="text-gray-400 text-sm mb-6">
        A well-calibrated provider follows the diagonal. Below the line = overconfident.
      </p>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v) => [`${v}%`]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
          {/* Perfect calibration diagonal */}
          <ReferenceLine
            stroke="#E5E7EB"
            strokeDasharray="4 4"
            segment={[
              { x: "0.0–0.6", y: 30 },
              { x: "0.95–1.0", y: 97.5 },
            ]}
            label={{ value: "Perfect", position: "insideTopRight", fontSize: 10, fill: "#D1D5DB" }}
          />
          {providers.map((prov) => (
            <Line
              key={prov.label}
              type="monotone"
              dataKey={prov.label}
              stroke={prov.color}
              strokeWidth={2}
              dot={{ r: 4, fill: prov.color }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
