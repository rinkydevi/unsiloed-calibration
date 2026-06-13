"use client";

import { useState, useCallback } from "react";
import {
  saveCustomSchema,
  labelToKey,
  generateJsonSchema,
  validateSchemaFields,
  type DocSchema,
  type SchemaField,
} from "@/lib/schemas";

interface Props {
  initial?: DocSchema;
  onSave: (schema: DocSchema) => void;
  onCancel: () => void;
}

const EMPTY_FIELD: SchemaField = { key: "", label: "", type: "string", description: "" };

export default function SchemaEditor({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.label ?? "");
  const [fields, setFields] = useState<SchemaField[]>(
    initial?.fields.length ? initial.fields : [{ ...EMPTY_FIELD }]
  );
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateField = useCallback(
    (idx: number, patch: Partial<SchemaField>) => {
      setFields((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        if (patch.label !== undefined && next[idx].key === labelToKey(prev[idx].label)) {
          next[idx].key = labelToKey(patch.label);
        }
        return next;
      });
    },
    []
  );

  const addField = () => setFields((prev) => [...prev, { ...EMPTY_FIELD }]);

  const removeField = (idx: number) =>
    setFields((prev) => prev.filter((_, i) => i !== idx));

  const moveField = (idx: number, dir: -1 | 1) => {
    setFields((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const handleSave = () => {
    const errs = validateSchemaFields(name, fields);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    const saved = saveCustomSchema({
      id: initial?.id,
      label: name.trim(),
      fields,
      jsonSchema: generateJsonSchema(fields),
    });
    onSave(saved);
  };

  const preview = generateJsonSchema(fields);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[#111827] text-lg font-semibold">
          {initial ? "Edit Schema" : "New Schema"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-[#111827] text-sm transition-colors"
        >
          ✕ Cancel
        </button>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-red-700 text-sm">
              {e}
            </p>
          ))}
        </div>
      )}

      <div>
        <label className="text-gray-500 text-xs uppercase tracking-wider block mb-2">
          Schema Name
        </label>
        <input
          type="text"
          placeholder="e.g. Medical Claim, Lease Agreement, Purchase Order"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-4 py-3 text-[#111827] text-sm placeholder-gray-400 focus:border-[#191919] focus:outline-none transition-colors"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-gray-500 text-xs uppercase tracking-wider">
            Fields ({fields.length}/20)
          </label>
          <button
            onClick={addField}
            disabled={fields.length >= 20}
            className="text-xs text-[#191919] border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            + Add Field
          </button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_100px_1fr_60px] gap-2 text-gray-400 text-xs px-2">
            <span>Key (API name)</span>
            <span>Label (display)</span>
            <span>Type</span>
            <span>Description</span>
            <span></span>
          </div>

          {fields.map((field, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_1fr_100px_1fr_60px] gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2 items-center"
            >
              <input
                type="text"
                value={field.key}
                onChange={(e) => updateField(idx, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                placeholder="field_key"
                className="bg-white border border-gray-300 rounded px-2 py-1.5 text-[#111827] text-xs font-mono placeholder-gray-400 focus:border-[#191919] focus:outline-none"
              />
              <input
                type="text"
                value={field.label}
                onChange={(e) => updateField(idx, { label: e.target.value })}
                placeholder="Field Label"
                className="bg-white border border-gray-300 rounded px-2 py-1.5 text-[#111827] text-xs placeholder-gray-400 focus:border-[#191919] focus:outline-none"
              />
              <select
                value={field.type}
                onChange={(e) =>
                  updateField(idx, { type: e.target.value as SchemaField["type"] })
                }
                className="bg-white border border-gray-300 rounded px-2 py-1.5 text-[#111827] text-xs focus:border-[#191919] focus:outline-none"
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="date">date</option>
              </select>
              <input
                type="text"
                value={field.description}
                onChange={(e) => updateField(idx, { description: e.target.value })}
                placeholder="Hint for extraction model"
                className="bg-white border border-gray-300 rounded px-2 py-1.5 text-[#111827] text-xs placeholder-gray-400 focus:border-[#191919] focus:outline-none"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveField(idx, -1)}
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-[#111827] text-xs disabled:opacity-20 px-1"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveField(idx, 1)}
                  disabled={idx === fields.length - 1}
                  className="text-gray-400 hover:text-[#111827] text-xs disabled:opacity-20 px-1"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeField(idx)}
                  disabled={fields.length === 1}
                  className="text-gray-400 hover:text-red-500 text-xs disabled:opacity-20 px-1"
                  title="Remove field"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="text-gray-400 text-xs hover:text-gray-600 transition-colors flex items-center gap-1"
        >
          <span>{showPreview ? "▼" : "▶"}</span>
          Preview JSON Schema (sent to Unsiloed /v2/extract)
        </button>
        {showPreview && (
          <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-500 overflow-x-auto leading-relaxed">
            {JSON.stringify(preview, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={handleSave}
          className="bg-[#191919] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-black transition-colors text-sm"
        >
          Save Schema
        </button>
        <button
          onClick={onCancel}
          className="border border-gray-300 text-gray-500 px-6 py-2.5 rounded-lg hover:border-gray-400 hover:text-[#111827] transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
