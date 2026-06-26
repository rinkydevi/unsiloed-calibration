"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ALL_PROVIDERS } from "@/lib/providers";
import type { IProviderAdapter } from "@/lib/providers";

const PROVIDER_COLORS: Record<string, string> = {
  "unsiloed":              "#FA82B9",
  "aws-textract":          "#FF9900",
  "google-docai":          "#4285F4",
  "azure-form-recognizer": "#0078D4",
};

export default function ComparePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creds, setCreds] = useState<Record<string, Record<string, string>>>({});

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const setField = (providerId: string, fieldKey: string, value: string) => {
    setCreds((prev) => ({
      ...prev,
      [providerId]: { ...(prev[providerId] ?? {}), [fieldKey]: value },
    }));
  };

  const canCompare = selected.size >= 2;

  const goToDemo = () => {
    router.push("/compare/results?demo=true");
  };

  const goToLive = () => {
    const params = new URLSearchParams();
    for (const id of Array.from(selected)) {
      params.set(`provider_${id}`, "1");
      const provCreds = creds[id] ?? {};
      for (const [k, v] of Object.entries(provCreds)) {
        params.set(`creds_${id}_${k}`, v);
      }
    }
    router.push(`/compare/results?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between bg-white sticky top-0 z-10">
        <Link href="/" className="text-[#111827] font-semibold tracking-tight">
          Unsiloed <span className="text-[#FA82B9]">Calibration</span> Validator
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/calibrate" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">
            Single Provider
          </Link>
          <Link href="/history" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">
            History
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Compare Document AI Providers</h1>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">
            Run the same documents through multiple providers and compare calibration quality —
            ECE, STP rates, and calibration curves side-by-side.
          </p>
        </div>

        {/* Demo shortcut */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800">Try the demo first</p>
            <p className="text-xs text-amber-600 mt-0.5">
              See Unsiloed vs. AWS Textract vs. Google Document AI on 12 sample invoices — no API keys needed.
            </p>
          </div>
          <button
            onClick={goToDemo}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap ml-4"
          >
            View Demo →
          </button>
        </div>

        {/* Provider selection */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Select providers to compare (pick 2+)
          </h2>
          {ALL_PROVIDERS.map((provider: IProviderAdapter) => {
            const isSelected = selected.has(provider.id);
            const color = PROVIDER_COLORS[provider.id] ?? "#6B7280";
            return (
              <div
                key={provider.id}
                className={`border rounded-lg transition-all ${
                  isSelected
                    ? "border-gray-300 bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <button
                  onClick={() => toggle(provider.id)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors`}
                    style={{
                      borderColor: isSelected ? color : "#D1D5DB",
                      background: isSelected ? color : "transparent",
                    }}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="font-medium text-[#111827]">{provider.label}</span>
                  </div>
                </button>

                {isSelected && (
                  <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-200 mt-0">
                    <p className="text-xs text-gray-400 pt-3">API credentials (never sent to our server)</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {provider.credentialFields.map((cf) => (
                        <div key={cf.key}>
                          <label className="block text-xs text-gray-500 mb-1">{cf.label}</label>
                          <input
                            type={cf.key.toLowerCase().includes("secret") || cf.key.toLowerCase().includes("key") ? "password" : "text"}
                            placeholder={cf.placeholder}
                            value={creds[provider.id]?.[cf.key] ?? ""}
                            onChange={(e) => setField(provider.id, cf.key, e.target.value)}
                            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm text-[#111827] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FA82B9] focus:border-transparent font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={goToLive}
            disabled={!canCompare}
            className="bg-[#111827] hover:bg-gray-800 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Compare Providers →
          </button>
          {!canCompare && (
            <p className="text-xs text-gray-400">Select at least 2 providers to compare</p>
          )}
        </div>
      </div>
    </main>
  );
}
