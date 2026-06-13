"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import UploadZone from "@/components/UploadZone";
import GroundTruthForm from "@/components/GroundTruthForm";
import CSVImport from "@/components/CSVImport";
import { submitExtraction, pollResult } from "@/lib/unsiloed";
import { compareValues, computeCalibration, FieldResult } from "@/lib/calibration";
import { BUILTIN_SCHEMAS, getAllSchemas, type DocSchema } from "@/lib/schemas";
import { useSchemas } from "@/hooks/use-schemas";

type GTMode = "manual" | "csv";

function CalibrateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schemas = useSchemas();

  const [apiKey, setApiKey] = useState("");
  const [schemaId, setSchemaId] = useState<string>("invoice");
  const [files, setFiles] = useState<File[]>([]);
  const [groundTruth, setGroundTruth] = useState<Record<number, Record<string, string>>>({});
  const [gtMode, setGtMode] = useState<GTMode>("manual");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("unsiloed_api_key");
    if (saved) setApiKey(saved);

    const paramSchema = searchParams.get("schema");
    if (paramSchema) {
      const found = getAllSchemas().find((s) => s.id === paramSchema);
      if (found) setSchemaId(found.id);
    }
  }, [searchParams]);

  useEffect(() => {
    setGroundTruth({});
  }, [schemaId, files.length]);

  const handleApiKeyChange = (v: string) => {
    setApiKey(v);
    localStorage.setItem("unsiloed_api_key", v);
  };

  const handleGroundTruthChange = useCallback(
    (docIdx: number, field: string, value: string) => {
      setGroundTruth((prev) => ({
        ...prev,
        [docIdx]: { ...(prev[docIdx] ?? {}), [field]: value },
      }));
    },
    []
  );

  const handleCSVImport = useCallback(
    (imported: Record<number, Record<string, string>>) => {
      setGroundTruth((prev) => {
        const merged = { ...prev };
        for (const [idxStr, fields] of Object.entries(imported)) {
          const idx = Number(idxStr);
          merged[idx] = { ...fields, ...(prev[idx] ?? {}) };
        }
        return merged;
      });
    },
    []
  );

  const schema: DocSchema =
    schemas.find((s) => s.id === schemaId) ?? Object.values(BUILTIN_SCHEMAS)[0];

  const canRun =
    apiKey.trim() !== "" &&
    files.length > 0 &&
    files.every((_, i) => {
      const gt = groundTruth[i] ?? {};
      return schema.fields.some((f) => gt[f.key]?.trim());
    });

  const filledDocs = files.filter((_, i) => {
    const gt = groundTruth[i] ?? {};
    return schema.fields.some((f) => gt[f.key]?.trim());
  }).length;

  const log = (msg: string) => setProgress((p) => [...p, msg]);

  const runCalibration = async () => {
    setRunning(true);
    setError(null);
    setProgress([]);

    try {
      const allResults: FieldResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        log(`[${i + 1}/${files.length}] Submitting ${file.name}...`);
        const jobId = await submitExtraction(apiKey.trim(), file, schema.jsonSchema);
        log(`[${i + 1}/${files.length}] Job ${jobId} — polling...`);

        const result = await pollResult(apiKey.trim(), jobId, (status) => {
          log(`[${i + 1}/${files.length}] Status: ${status}`);
        });

        if (!result.result) {
          log(`[${i + 1}/${files.length}] No result fields returned.`);
          continue;
        }

        const gt = groundTruth[i] ?? {};
        for (const field of schema.fields) {
          const extracted = result.result[field.key];
          if (!extracted) continue;
          const truthVal = gt[field.key];
          if (!truthVal?.trim()) continue;

          const isCorrect = compareValues(extracted.value, truthVal.trim(), field.type);
          allResults.push({
            field: field.key,
            groundTruth: truthVal.trim(),
            extracted: extracted.value,
            confidence: extracted.score,
            isCorrect,
            docIndex: i,
          });
        }
        log(`[${i + 1}/${files.length}] Done.`);
      }

      if (allResults.length === 0) {
        throw new Error(
          "No comparable field results returned. Check that ground truth fields match the document type."
        );
      }

      const calibration = computeCalibration(allResults);
      localStorage.setItem("unsiloed_last_calibration", JSON.stringify(calibration));
      localStorage.setItem("unsiloed_last_calibration_doc_type", schema.label);
      localStorage.setItem(
        "unsiloed_last_calibration_doc_names",
        JSON.stringify(files.map((f) => f.name))
      );
      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const builtins = schemas.filter((s) => s.source === "builtin");
  const customs = schemas.filter((s) => s.source === "custom");

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between bg-white sticky top-0 z-10">
        <Link href="/" className="text-[#111827] font-semibold tracking-tight">
          Unsiloed <span className="text-[#FA82B9]">Calibration</span> Validator
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/schemas" className="text-gray-500 text-sm hover:text-[#111827] transition-colors">
            Schemas
          </Link>
          <Link
            href="/results?demo=true"
            className="text-gray-500 text-sm hover:text-[#111827] transition-colors"
          >
            View Demo
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-[#111827] mb-2">Run Calibration</h1>
        <p className="text-gray-500 text-sm mb-10">
          Upload your documents and ground truth to generate your calibration curve.
        </p>

        <div className="space-y-8">
          {/* Step 1: API Key */}
          <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-6 h-6 rounded-full bg-[#FA82B9]/10 text-[#FA82B9] text-xs font-bold flex items-center justify-center">1</span>
              <h2 className="text-[#111827] font-medium">Unsiloed API Key</h2>
            </div>
            <input
              type="password"
              placeholder="us-live-xxxxxxxxxxxxxxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded px-4 py-3 text-[#111827] text-sm placeholder-gray-400 focus:border-[#191919] focus:outline-none transition-colors font-mono"
            />
            <p className="text-gray-400 text-xs mt-2">
              Stored only in your browser. Sent directly to Unsiloed&apos;s API — never through an intermediary server.
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Note: your key will be visible in browser DevTools &rarr; Network during extraction. Use a scoped or test key where possible.
            </p>
          </section>

          {/* Step 2: Schema / Document Type */}
          <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#FA82B9]/10 text-[#FA82B9] text-xs font-bold flex items-center justify-center">2</span>
                <h2 className="text-[#111827] font-medium">Document Type</h2>
              </div>
              <Link
                href="/schemas"
                className="text-xs text-gray-400 hover:text-[#FA82B9] transition-colors"
              >
                + Add custom schema
              </Link>
            </div>

            <div className="flex gap-2 flex-wrap mb-3">
              {builtins.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSchemaId(s.id)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                    schemaId === s.id
                      ? "bg-[#191919]/5 border-[#191919] text-[#191919]"
                      : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-[#111827]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {customs.length > 0 && (
              <>
                <p className="text-gray-400 text-xs mb-2">Custom</p>
                <div className="flex gap-2 flex-wrap">
                  {customs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSchemaId(s.id)}
                      className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                        schemaId === s.id
                          ? "bg-[#191919]/5 border-[#191919] text-[#191919]"
                          : "border-blue-200 text-blue-600 hover:border-blue-400 hover:text-[#111827]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Step 3: Upload */}
          <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-6 h-6 rounded-full bg-[#FA82B9]/10 text-[#FA82B9] text-xs font-bold flex items-center justify-center">3</span>
              <h2 className="text-[#111827] font-medium">Upload PDFs</h2>
            </div>
            <UploadZone files={files} onFilesChange={setFiles} />
            {files.length > 0 && (
              <p className="text-xs mt-3">
                {files.length >= 10 ? (
                  <span className="text-green-600">
                    {files.length} documents — enough for reliable calibration curves.
                  </span>
                ) : (
                  <span className="text-amber-600">
                    Tip: Upload at least 10 documents ({10 - files.length} more
                    recommended) for statistically meaningful results.
                  </span>
                )}
              </p>
            )}
          </section>

          {/* Step 4: Ground Truth */}
          {files.length > 0 && (
            <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FA82B9]/10 text-[#FA82B9] text-xs font-bold flex items-center justify-center">4</span>
                  <h2 className="text-[#111827] font-medium">Ground Truth Values</h2>
                </div>
                {filledDocs > 0 && (
                  <span className="text-green-600 text-xs">
                    {filledDocs}/{files.length} docs ready
                  </span>
                )}
              </div>

              <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-5 w-fit">
                {(["manual", "csv"] as GTMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setGtMode(mode)}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      gtMode === mode
                        ? "bg-[#191919]/5 text-[#191919]"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {mode === "manual" ? "Manual Entry" : "Import CSV"}
                  </button>
                ))}
              </div>

              {gtMode === "csv" ? (
                <>
                  <CSVImport files={files} schema={schema} onImport={handleCSVImport} />
                  {filledDocs > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <button
                        onClick={() => setGtMode("manual")}
                        className="text-gray-500 text-xs hover:text-[#111827] transition-colors"
                      >
                        Review or edit individual fields →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-gray-500 text-sm mb-4">
                    Enter the correct values for each document. Fill at least one field per document.
                  </p>
                  <GroundTruthForm
                    files={files}
                    schema={schema}
                    groundTruth={groundTruth}
                    onChange={handleGroundTruthChange}
                  />
                </>
              )}
            </section>
          )}

          {/* Run */}
          <div className="flex flex-col gap-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                {error}
              </div>
            )}
            {running && progress.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs text-gray-500 space-y-1 max-h-40 overflow-y-auto">
                {progress.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
            <button
              onClick={runCalibration}
              disabled={!canRun || running}
              className={`w-full py-4 rounded-lg font-semibold text-base transition-colors ${
                canRun && !running
                  ? "bg-[#191919] text-white hover:bg-black"
                  : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
              }`}
            >
              {running ? "Running..." : "Run Calibration →"}
            </button>
            {!apiKey && (
              <p className="text-gray-400 text-xs text-center">Enter your API key to continue</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CalibratePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <CalibrateContent />
    </Suspense>
  );
}
