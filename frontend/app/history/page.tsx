"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRuns,
  getLocalRuns,
  deleteRun,
  deleteLocalRun,
  type RunSummary,
} from "@/lib/api-client";
import { BACKEND_ENABLED } from "@/lib/config";

interface LocalSummary {
  id: string;
  createdAt: string;
  docType: string;
  totalFields: number;
  overallAccuracy: number;
  stpThreshold: number;
  stpRate: number;
  stpTarget: number;
  notes?: string;
}

function mapLocalRuns() {
  return getLocalRuns().map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    docType: r.docType,
    totalFields: r.calibrationResult.totalFields,
    overallAccuracy: r.calibrationResult.overallAccuracy,
    stpThreshold: r.calibrationResult.stpThreshold,
    stpRate: r.calibrationResult.stpRate,
    stpTarget: r.calibrationResult.stpTarget ?? 0.95,
    notes: r.notes,
  }));
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<(RunSummary | LocalSummary)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localFallback, setLocalFallback] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (BACKEND_ENABLED) {
        const data = await getRuns();
        setRuns(data);
      } else {
        setRuns(mapLocalRuns());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load history";
      if (msg === "Not authenticated") {
        setLocalFallback(true);
        setRuns(mapLocalRuns());
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      if (BACKEND_ENABLED && !localFallback) {
        await deleteRun(id);
      } else {
        deleteLocalRun(id);
      }
      setRuns((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between bg-white sticky top-0 z-10">
        <Link href="/" className="text-[#111827] font-semibold tracking-tight">
          Unsiloed <span className="text-[#FA82B9]">Calibration</span> Validator
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/schemas" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">Schemas</Link>
          <Link href="/calibrate" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">Run Calibration →</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Calibration History</h1>
            <p className="text-gray-400 text-sm mt-1">
              {BACKEND_ENABLED && !localFallback
                ? "Saved to your account."
                : "Stored locally in this browser."}
            </p>
          </div>
          <Link
            href="/calibrate"
            className="bg-[#191919] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-black transition-colors text-sm"
          >
            New Run →
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-400 text-sm">No calibration runs yet.</p>
            <Link href="/calibrate" className="mt-3 inline-block text-[#FA82B9] text-sm hover:underline">
              Run your first calibration →
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-200 text-left bg-gray-50">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Document Type</th>
                  <th className="px-5 py-3 font-medium">Fields</th>
                  <th className="px-5 py-3 font-medium">Accuracy</th>
                  <th className="px-5 py-3 font-medium">STP Threshold</th>
                  <th className="px-5 py-3 font-medium">STP Rate</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(run.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3 text-[#111827]">{run.docType}</td>
                    <td className="px-5 py-3 text-gray-500">{run.totalFields}</td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          run.overallAccuracy >= 0.9
                            ? "text-green-600"
                            : run.overallAccuracy >= 0.7
                            ? "text-amber-600"
                            : "text-red-600"
                        }
                      >
                        {(run.overallAccuracy * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono">
                      {run.stpThreshold.toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-green-600">
                        {(run.stpRate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <Link
                          href={`/results?runId=${run.id}`}
                          className="text-xs text-gray-500 border border-gray-200 px-3 py-1 rounded hover:border-gray-400 hover:text-[#111827] transition-colors"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDelete(run.id)}
                          disabled={deleting === run.id}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          {deleting === run.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer className="border-t border-gray-100 px-8 py-6 text-center text-gray-300 text-xs mt-10">
        Built by Rinky Devi · Applying for Founding Engineer at Unsiloed AI
      </footer>
    </main>
  );
}
