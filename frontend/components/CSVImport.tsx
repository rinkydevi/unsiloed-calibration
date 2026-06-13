"use client";

import { useCallback, useState } from "react";
import {
  parseGroundTruthCSV,
  matchCSVToFiles,
  generateCSVTemplate,
  type CSVParseResult,
} from "@/lib/csv-import";
import type { DocSchema } from "@/lib/schemas";

interface Props {
  files: File[];
  schema: DocSchema;
  onImport: (groundTruth: Record<number, Record<string, string>>) => void;
}

export default function CSVImport({ files, schema, onImport }: Props) {
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [matchInfo, setMatchInfo] = useState<{
    matched: number;
    unmatchedFiles: number[];
    unmatchedRows: number[];
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const fieldKeys = schema.fields.map((f) => f.key);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const result = parseGroundTruthCSV(content, fieldKeys);
        setParseResult(result);

        if (result.errors.length === 0) {
          const { groundTruth, unmatchedFiles, unmatchedCSVRows } =
            matchCSVToFiles(result.rows, files);
          const matched = Object.keys(groundTruth).length;
          setMatchInfo({ matched, unmatchedFiles, unmatchedRows: unmatchedCSVRows });
          if (matched > 0) onImport(groundTruth);
        }
      };
      reader.readAsText(file);
    },
    [files, fieldKeys, onImport]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith(".csv")) processFile(file);
    },
    [processFile]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const downloadTemplate = () => {
    const csv = generateCSVTemplate(fieldKeys, schema.label);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ground_truth_template_${schema.label.toLowerCase().replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">
          Upload a CSV with one row per document and correct field values.
        </p>
        <button
          onClick={downloadTemplate}
          className="text-xs text-[#191919] border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors"
        >
          Download Template
        </button>
      </div>

      <label
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
          dragging ? "border-[#191919] bg-gray-50" : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleInput}
        />
        <div className="text-gray-400 text-2xl mb-2">📄</div>
        <div className="text-[#111827] text-sm font-medium">Drop CSV here or click to browse</div>
        <div className="text-gray-400 text-xs mt-1">
          Required columns: filename, {fieldKeys.join(", ")}
        </div>
      </label>

      {parseResult?.errors.map((err, i) => (
        <div
          key={i}
          className="bg-red-50 border border-red-200 rounded px-4 py-3 text-red-700 text-sm"
        >
          {err}
        </div>
      ))}

      {parseResult?.warnings.map((w, i) => (
        <div
          key={i}
          className="bg-amber-50 border border-amber-200 rounded px-4 py-3 text-amber-700 text-sm"
        >
          {w}
        </div>
      ))}

      {matchInfo && parseResult && parseResult.errors.length === 0 && (
        <div className="space-y-3">
          <div
            className={`rounded px-4 py-3 text-sm ${
              matchInfo.matched > 0
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {matchInfo.matched} of {files.length} documents matched from CSV.
            {matchInfo.matched > 0 && " Ground truth pre-filled — review or edit below."}
          </div>

          {matchInfo.unmatchedFiles.length > 0 && (
            <div className="text-amber-600 text-xs">
              No CSV row matched:{" "}
              {matchInfo.unmatchedFiles.map((i) => files[i]?.name).join(", ")}
            </div>
          )}
          {matchInfo.unmatchedRows.length > 0 && (
            <div className="text-gray-400 text-xs">
              CSV rows not matched to any uploaded file (row numbers):{" "}
              {matchInfo.unmatchedRows.join(", ")}
            </div>
          )}

          {parseResult.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-200 text-left">
                    <th className="pb-2 pr-4 font-medium">File</th>
                    <th className="pb-2 pr-4 font-medium">Match</th>
                    {fieldKeys.map((k) => (
                      <th key={k} className="pb-2 pr-4 font-medium font-mono">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.rows.map((row) => {
                    const fileIdx = files.findIndex(
                      (f) =>
                        f.name.toLowerCase().replace(/\.pdf$/i, "") === row.filename
                    );
                    const matched = fileIdx !== -1;
                    return (
                      <tr
                        key={row.rowIndex}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 pr-4 text-[#111827] font-mono">
                          {row.originalFilename}
                        </td>
                        <td className="py-2 pr-4">
                          {matched ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-500">✗</span>
                          )}
                        </td>
                        {fieldKeys.map((k) => (
                          <td key={k} className="py-2 pr-4 text-gray-500">
                            {row.fields[k] ?? <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
