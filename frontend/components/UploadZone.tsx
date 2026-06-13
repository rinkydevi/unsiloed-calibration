"use client";

import { useCallback, useState } from "react";

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export default function UploadZone({ files, onFilesChange }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type === "application/pdf");
      onFilesChange([...files, ...dropped]);
    },
    [files, onFilesChange]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files || []).filter((f) => f.type === "application/pdf");
      onFilesChange([...files, ...selected]);
    },
    [files, onFilesChange]
  );

  const remove = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
          dragging ? "border-[#191919] bg-gray-50" : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input type="file" multiple accept=".pdf" className="hidden" onChange={handleInput} />
        <div className="text-gray-400 text-3xl mb-3">⬆</div>
        <div className="text-[#111827] text-sm font-medium">Drop PDFs here or click to browse</div>
        <div className="text-gray-400 text-xs mt-1">Multiple files supported</div>
      </label>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, i) => (
            <li key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="text-[#c2410c] text-xs font-medium">PDF</span>
                <span className="text-[#111827] text-sm truncate max-w-xs">{file.name}</span>
                <span className="text-gray-400 text-xs">{(file.size / 1024).toFixed(0)} KB</span>
              </div>
              <button
                onClick={() => remove(i)}
                className="text-gray-400 hover:text-red-500 text-sm transition-colors ml-4"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
