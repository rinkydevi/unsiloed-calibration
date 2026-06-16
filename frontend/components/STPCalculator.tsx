"use client";

import { useState, useMemo, useEffect } from "react";
import type { FieldResult } from "@/lib/calibration";

interface Props {
  stpThreshold: number;
  fieldResults: FieldResult[];
  stpTarget: number;
  onTargetChange: (target: number) => void;
}

const STP_TARGETS = [
  { label: "90% target", value: 0.90 },
  { label: "95% target", value: 0.95 },
  { label: "99% target", value: 0.99 },
];

export default function STPCalculator({ stpThreshold, fieldResults, stpTarget, onTargetChange }: Props) {
  const [threshold, setThreshold] = useState(stpThreshold);
  const [monthlyDocs, setMonthlyDocs] = useState(1000);
  const [fieldsPerDoc, setFieldsPerDoc] = useState(5);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [minutesPerField, setMinutesPerField] = useState(1.5);

  useEffect(() => {
    setThreshold(stpThreshold);
  }, [stpThreshold]);

  const stpRate = useMemo(() => {
    if (fieldResults.length === 0) {
      if (threshold >= 0.95) return 0.76;
      if (threshold >= 0.9) return 0.88;
      if (threshold >= 0.85) return 0.95;
      return 1.0;
    }
    const above = fieldResults.filter((r) => r.confidence >= threshold).length;
    return above / fieldResults.length;
  }, [threshold, fieldResults]);

  const documentStpRate = useMemo(() => {
    if (fieldResults.length === 0) return stpRate;
    const docIndices = Array.from(new Set(fieldResults.map((r) => r.docIndex)));
    const docsFullyAbove = docIndices.filter((idx) =>
      fieldResults.filter((r) => r.docIndex === idx).every((r) => r.confidence >= threshold)
    ).length;
    return docIndices.length > 0 ? docsFullyAbove / docIndices.length : 0;
  }, [threshold, fieldResults, stpRate]);

  const savings = useMemo(() => {
    const totalMonthlyFields = monthlyDocs * fieldsPerDoc;
    const autoAcceptedFields = totalMonthlyFields * stpRate;
    const manualFieldsWithoutTool = totalMonthlyFields;
    const manualFieldsWithTool = totalMonthlyFields - autoAcceptedFields;
    const hoursWithout = (manualFieldsWithoutTool * minutesPerField) / 60;
    const hoursWith = (manualFieldsWithTool * minutesPerField) / 60;
    const savedHours = hoursWithout - hoursWith;
    const savedDollars = savedHours * hourlyRate;
    return { autoAcceptedFields, stpRate, savedDollars, savedHours };
  }, [monthlyDocs, fieldsPerDoc, hourlyRate, minutesPerField, stpRate]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-[#111827] text-lg font-semibold mb-1">STP Rate Calculator</h2>
      <p className="text-gray-500 text-sm mb-6">
        Estimate manual review cost savings at any confidence threshold.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-5">
          <div>
            <label className="text-gray-500 text-xs uppercase tracking-wider block mb-2">
              Target Accuracy
            </label>
            <div className="flex gap-2">
              {STP_TARGETS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => onTargetChange(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    stpTarget === value
                      ? "bg-[#191919]/5 border-[#191919] text-[#191919]"
                      : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-[#111827]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-gray-500 text-xs uppercase tracking-wider block mb-2">
              Confidence Threshold: <span className="text-[#111827] font-mono">{threshold.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={1.0}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full accent-[#191919]"
            />
            <div className="flex justify-between text-gray-300 text-xs mt-1">
              <span>0.50</span><span>0.75</span><span>1.00</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Monthly Documents</label>
              <input
                type="number"
                value={monthlyDocs}
                onChange={(e) => setMonthlyDocs(Number(e.target.value))}
                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-[#111827] text-sm focus:border-[#191919] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Fields per Document</label>
              <input
                type="number"
                value={fieldsPerDoc}
                onChange={(e) => setFieldsPerDoc(Number(e.target.value))}
                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-[#111827] text-sm focus:border-[#191919] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Team Hourly Rate ($)</label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-[#111827] text-sm focus:border-[#191919] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Minutes per Field Review</label>
              <input
                type="number"
                step="0.5"
                value={minutesPerField}
                onChange={(e) => setMinutesPerField(Number(e.target.value))}
                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-[#111827] text-sm focus:border-[#191919] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">STP Rate at threshold</div>
            <div className="text-green-600 text-4xl font-bold tabular-nums">
              {(savings.stpRate * 100).toFixed(1)}%
            </div>
            <div className="text-gray-400 text-xs mt-1">
              fields auto-accepted ·{" "}
              <span className="tabular-nums">{(documentStpRate * 100).toFixed(1)}%</span> of docs fully auto-accepted
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Monthly Savings</div>
            <div className="text-[#111827] text-4xl font-bold tabular-nums">
              ${savings.savedDollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-gray-400 text-xs mt-1">
              {savings.savedHours.toFixed(0)} hours freed · {savings.autoAcceptedFields.toLocaleString()} fields auto-accepted
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
            <p className="text-gray-400 text-xs leading-relaxed">
              At threshold <span className="text-[#111827] font-mono">{threshold.toFixed(2)}</span>,{" "}
              <span className="text-green-600">{(savings.stpRate * 100).toFixed(1)}%</span> of fields
              are auto-accepted, but only{" "}
              <span className="text-green-600">{(documentStpRate * 100).toFixed(1)}%</span> of documents
              need zero human review. A single field below threshold sends the whole document to a human.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
