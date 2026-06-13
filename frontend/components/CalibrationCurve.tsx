"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { BucketData } from "@/lib/calibration";

interface Props {
  data: BucketData[];
}

interface TooltipPayload {
  payload: BucketData & { perfectAccuracy: number };
}

function reliability(count: number): { label: string; color: string } {
  if (count >= 15) return { label: "High reliability", color: "#16a34a" };
  if (count >= 5) return { label: "Moderate reliability", color: "#d97706" };
  return { label: "Low reliability — interpret with caution", color: "#dc2626" };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const rel = reliability(d.count);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm space-y-1 min-w-[200px] shadow-sm">
      <div className="text-gray-500 border-b border-gray-100 pb-1 mb-2">
        Confidence {d.bucket}
      </div>
      <div className="text-gray-500">
        Raw accuracy:{" "}
        <span className="text-[#111827]">{(d.accuracy * 100).toFixed(1)}%</span>
      </div>
      <div className="text-[#191919] font-medium">
        Smoothed (isotonic): {(d.smoothedAccuracy * 100).toFixed(1)}%
      </div>
      <div className="text-gray-400 text-xs">
        95% CI: {(d.ciLower * 100).toFixed(1)}% – {(d.ciUpper * 100).toFixed(1)}%
      </div>
      <div className="text-gray-400 text-xs">Perfect: {(d.midpoint * 100).toFixed(1)}%</div>
      <div className="border-t border-gray-100 pt-1 mt-1">
        <span className="text-gray-400 text-xs">n = {d.count} · </span>
        <span style={{ color: rel.color }} className="text-xs">{rel.label}</span>
      </div>
    </div>
  );
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: BucketData;
  dataKey?: string;
}) {
  const { cx, cy, payload, dataKey } = props;
  if (!cx || !cy || !payload) return null;
  const r = Math.max(4, Math.min(12, Math.sqrt(payload.count) * 2));
  const isSmoothed = dataKey === "smoothedAccuracy";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isSmoothed ? r : r * 0.6}
      fill={isSmoothed ? "#191919" : "#9CA3AF"}
      stroke="#FFFFFF"
      strokeWidth={2}
      opacity={isSmoothed ? 0.9 : 0.6}
    />
  );
}

export default function CalibrationCurve({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    perfectAccuracy: d.midpoint,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-[#111827] text-lg font-semibold">Calibration Curve</h2>
        <p className="text-gray-500 text-sm mt-1">
          Dark line (smoothed) uses isotonic regression — stable against noisy
          individual extractions. Grey dashed = raw bucket accuracy. Diagonal =
          perfect calibration. Hover for 95% CI and sample count.
        </p>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="midpoint"
            type="number"
            domain={[0, 1]}
            tickFormatter={(v) => v.toFixed(2)}
            stroke="#D1D5DB"
            tick={{ fill: "#6B7280", fontSize: 12 }}
            label={{
              value: "Confidence Score",
              position: "insideBottom",
              offset: -5,
              fill: "#6B7280",
              fontSize: 12,
            }}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            stroke="#D1D5DB"
            tick={{ fill: "#6B7280", fontSize: 12 }}
            label={{
              value: "Actual Accuracy",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fill: "#6B7280",
              fontSize: 12,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: "16px", fontSize: "12px", color: "#6B7280" }} />

          <Line
            type="monotone"
            dataKey="perfectAccuracy"
            name="Perfect Calibration"
            stroke="#D1D5DB"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            dot={false}
            legendType="line"
          />

          <Line
            type="monotone"
            dataKey="accuracy"
            name="Raw Accuracy"
            stroke="#9CA3AF"
            strokeDasharray="4 2"
            strokeWidth={1.5}
            dot={(props) => (
              <CustomDot key={props.index} {...props} dataKey="accuracy" />
            )}
            activeDot={{ r: 5, fill: "#9CA3AF" }}
          />

          <Line
            type="monotone"
            dataKey="smoothedAccuracy"
            name="Unsiloed (smoothed)"
            stroke="#191919"
            strokeWidth={2.5}
            dot={(props) => (
              <CustomDot key={props.index} {...props} dataKey="smoothedAccuracy" />
            )}
            activeDot={{ r: 6, fill: "#191919" }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-gray-400 text-xs mt-3">
        Smoothed line uses isotonic regression (Pool Adjacent Violators). A single
        wrong extraction can no longer collapse your STP threshold.
      </p>
    </div>
  );
}
