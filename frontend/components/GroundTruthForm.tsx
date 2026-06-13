"use client";

import type { DocSchema } from "@/lib/schemas";

interface Props {
  files: File[];
  schema: DocSchema;
  groundTruth: Record<number, Record<string, string>>;
  onChange: (docIndex: number, field: string, value: string) => void;
}

export default function GroundTruthForm({ files, schema, groundTruth, onChange }: Props) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-6">
      {files.map((file, docIdx) => (
        <div key={docIdx} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-[#c2410c]/10 text-[#c2410c] text-xs px-2 py-0.5 rounded font-mono">
              Doc {docIdx + 1}
            </span>
            <span className="text-gray-500 text-sm truncate">{file.name}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schema.fields.map((field) => (
              <div key={field.key}>
                <label className="text-gray-500 text-xs block mb-1">
                  {field.label}
                  <span className="text-gray-400 ml-2">({field.type})</span>
                </label>
                <input
                  type="text"
                  placeholder={field.description}
                  value={groundTruth[docIdx]?.[field.key] ?? ""}
                  onChange={(e) => onChange(docIdx, field.key, e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-[#111827] text-sm placeholder-gray-400 focus:border-[#191919] focus:outline-none transition-colors"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
