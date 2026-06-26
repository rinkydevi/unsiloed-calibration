import type { IProviderAdapter, ExtractionJob, ProviderCredentials } from "./types";
import type { FieldResult } from "@/lib/calibration";

/**
 * Azure AI Document Intelligence (Form Recognizer) adapter.
 *
 * Uses the prebuilt-invoice model or a custom model. Auth is a Cognitive
 * Services API key — safe to send server-side via /api/proxy/azure-docai.
 *
 * Azure returns analyzeResult.documents[].fields, where each field has
 * { type, content, confidence }. We map schema field names against the
 * field keys returned by the model (exact match first, then fuzzy).
 */
export const azureFormRecognizerAdapter: IProviderAdapter = {
  id: "azure-form-recognizer",
  label: "Azure Document Intelligence",
  credentialFields: [
    { key: "endpoint", label: "Azure Endpoint", placeholder: "https://myresource.cognitiveservices.azure.com/" },
    { key: "apiKey",   label: "API Key",        placeholder: "3a4b5c..." },
    { key: "modelId",  label: "Model ID",       placeholder: "prebuilt-invoice" },
  ],

  async submit(file, schema, creds): Promise<ExtractionJob> {
    const body = new FormData();
    body.append("pdf_file", file);
    body.append("schema",   JSON.stringify(schema));
    body.append("endpoint", creds.endpoint);
    body.append("api_key",  creds.apiKey);
    body.append("model_id", creds.modelId ?? "prebuilt-invoice");

    const res = await fetch("/api/proxy/azure-docai/submit", { method: "POST", body });
    if (!res.ok) throw new Error(`Azure submit failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { jobId: data.operation_location };
  },

  async poll(job, schema, creds, onStatus): Promise<FieldResult[]> {
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      const res = await fetch("/api/proxy/azure-docai/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_location: job.jobId,
          api_key: creds.apiKey,
        }),
      });
      if (!res.ok) throw new Error(`Azure poll failed: ${res.status}`);
      const data = await res.json();
      onStatus?.(data.status);
      if (data.status === "succeeded") return normalizeAzureResult(data.analyzeResult, schema);
      if (data.status === "failed")    throw new Error(data.error?.message ?? "Azure analysis failed");
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error("Azure Document Intelligence timed out");
  },
};

function normalizeAzureResult(
  analyzeResult: Record<string, unknown>,
  schema: object
): FieldResult[] {
  const schemaFields = extractSchemaFieldNames(schema);
  const documents = (analyzeResult?.["documents"] as Record<string, unknown>[] ?? []);
  const fields: Record<string, { content: string; confidence: number }> = {};

  for (const doc of documents) {
    const docFields = doc["fields"] as Record<string, { content?: string; confidence?: number }> ?? {};
    for (const [k, v] of Object.entries(docFields)) {
      fields[k.toLowerCase()] = { content: v.content ?? "", confidence: v.confidence ?? 0 };
    }
  }

  return schemaFields.map((field) => {
    const exactKey = field.toLowerCase();
    const match = fields[exactKey] ??
      Object.entries(fields).find(([k]) => fuzzyMatch(k, field))?.[1];
    return {
      field,
      groundTruth: "",
      extracted: match?.content ?? null,
      confidence: match?.confidence ?? 0,
      isCorrect: false,
      docIndex: 0,
    };
  });
}

function extractSchemaFieldNames(schema: object): string[] {
  const s = schema as { properties?: Record<string, unknown> };
  if (s.properties) return Object.keys(s.properties);
  const arr = schema as { fields?: { name: string }[] };
  if (arr.fields) return arr.fields.map((f) => f.name);
  return [];
}

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a));
}
