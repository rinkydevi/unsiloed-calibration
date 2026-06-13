"use client";

import { useState } from "react";
import Link from "next/link";
import SchemaEditor from "@/components/SchemaEditor";
import {
  deleteCustomSchema,
  BUILTIN_SCHEMAS,
  type DocSchema,
} from "@/lib/schemas";
import { useSchemas } from "@/hooks/use-schemas";

export default function SchemasPage() {
  const schemas = useSchemas();
  const [editing, setEditing] = useState<DocSchema | null | "new">(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const customSchemas = schemas.filter((s) => s.source === "custom");
  const builtinList = Object.values(BUILTIN_SCHEMAS);

  const handleDelete = (id: string) => {
    deleteCustomSchema(id);
    setDeleteConfirm(null);
    if (editing && typeof editing !== "string" && editing.id === id) {
      setEditing(null);
    }
  };

  if (editing !== null) {
    return (
      <main className="min-h-screen bg-white">
        <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between bg-white sticky top-0 z-10">
          <Link href="/" className="text-[#111827] font-semibold tracking-tight">
            Unsiloed <span className="text-[#FA82B9]">Calibration</span> Validator
          </Link>
          <span className="text-gray-500 text-sm">Schema Editor</span>
        </nav>
        <div className="max-w-3xl mx-auto px-6 py-12">
          <SchemaEditor
            initial={typeof editing === "string" ? undefined : editing}
            onSave={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between bg-white sticky top-0 z-10">
        <Link href="/" className="text-[#111827] font-semibold tracking-tight">
          Unsiloed <span className="text-[#FA82B9]">Calibration</span> Validator
        </Link>
        <Link
          href="/calibrate"
          className="text-gray-500 text-sm hover:text-[#111827] transition-colors"
        >
          Run Calibration →
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Document Schemas</h1>
            <p className="text-gray-500 text-sm mt-1">
              Custom schemas let you calibrate on any document type — not just the
              three built-in ones.
            </p>
          </div>
          <button
            onClick={() => setEditing("new")}
            className="bg-[#191919] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-black transition-colors text-sm"
          >
            + New Schema
          </button>
        </div>

        {/* Custom schemas */}
        <section className="mb-10">
          <h2 className="text-gray-400 text-xs uppercase tracking-widest mb-4">
            Your Schemas ({customSchemas.length})
          </h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 flex items-start gap-3">
            <span className="text-amber-600 mt-0.5 shrink-0">⚠</span>
            <p className="text-gray-500 text-xs leading-relaxed">
              Custom schemas are stored in your browser&apos;s local storage. They will be lost if you clear site data or switch browsers.
              Export your schema JSON from the editor before clearing browser storage.
            </p>
          </div>
          {customSchemas.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-sm">No custom schemas yet.</p>
              <button
                onClick={() => setEditing("new")}
                className="mt-3 text-[#FA82B9] text-sm hover:underline"
              >
                Create your first schema →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {customSchemas.map((schema) => (
                <div
                  key={schema.id}
                  className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between hover:border-gray-300 transition-colors"
                >
                  <div>
                    <div className="text-[#111827] font-medium">{schema.label}</div>
                    <div className="text-gray-400 text-xs mt-1">
                      {schema.fields.length} fields:{" "}
                      {schema.fields.map((f) => f.key).join(", ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/calibrate?schema=${schema.id}`}
                      className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:border-gray-400 hover:text-[#111827] transition-colors"
                    >
                      Use →
                    </Link>
                    <button
                      onClick={() => setEditing(schema)}
                      className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:border-gray-400 hover:text-[#111827] transition-colors"
                    >
                      Edit
                    </button>
                    {deleteConfirm === schema.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 text-xs">Sure?</span>
                        <button
                          onClick={() => handleDelete(schema.id)}
                          className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-gray-400 hover:text-[#111827]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(schema.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Built-in schemas (read-only) */}
        <section>
          <h2 className="text-gray-400 text-xs uppercase tracking-widest mb-4">
            Built-in Schemas (read-only)
          </h2>
          <div className="space-y-2">
            {builtinList.map((schema) => (
              <div
                key={schema.id}
                className="bg-gray-50 border border-gray-100 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <div className="text-gray-600 font-medium text-sm">{schema.label}</div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    {schema.fields.map((f) => f.key).join(", ")}
                  </div>
                </div>
                <Link
                  href={`/calibrate?schema=${schema.id}`}
                  className="text-xs text-gray-400 border border-gray-200 px-3 py-1.5 rounded hover:border-gray-300 hover:text-gray-600 transition-colors"
                >
                  Use →
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
