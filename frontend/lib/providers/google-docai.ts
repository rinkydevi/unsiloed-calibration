import type { IProviderAdapter, ExtractionJob, ProviderCredentials } from "./types";
import type { FieldResult } from "@/lib/calibration";

/**
 * Google Document AI adapter — Form Parser processor.
 *
 * Google DocAI requires OAuth 2.0 or a service-account key. We accept a
 * service-account JSON (base64-encoded) and proxy the call server-side at
 * /api/proxy/google-docai to keep credentials off the client.
 *
 * DocAI returns FormField entities with fieldName / fieldValue / confidence.
 * We map schema field names against fieldName using the same fuzzy matcher
 * used for the Textract adapter.
 */
export const googleDocAIAdapter: IProviderAdapter = {
  id: "google-docai",
  label: "Google Document AI",
  credentialFields: [
    { key: "serviceAccountB64", label: "Service Account JSON (base64)", placeholder: "eyJhbGci..." },
    { key: "projectId",         label: "GCP Project ID",                placeholder: "my-project-123" },
    { key: "processorId",       label: "Processor ID",                  placeholder: "abc1234567890" },
    { key: "location",          label: "Location",                      placeholder: "us" },
  ],

  async submit(file, schema, creds): Promise<ExtractionJob> {
    const body = new FormData();
    body.append("pdf_file",             file);
    body.append("schema",               JSON.stringify(schema));
    body.append("service_account_b64",  creds.serviceAccountB64);
    body.append("project_id",           creds.projectId);
    body.append("processor_id",         creds.processorId);
    body.append("location",             creds.location ?? "us");

    const res = await fetch("/api/proxy/google-docai/submit", { method: "POST", body });
    if (!res.ok) throw new Error(`DocAI submit failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { jobId: data.operation_name };
  },

  async poll(job, schema, creds, onStatus): Promise<FieldResult[]> {
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      const res = await fetch("/api/proxy/google-docai/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_name:     job.jobId,
          service_account_b64: creds.serviceAccountB64,
          project_id:         creds.projectId,
          location:           creds.location ?? "us",
        }),
      });
      if (!res.ok) throw new Error(`DocAI poll failed: ${res.status}`);
      const data = await res.json();
      onStatus?.(data.status);
      if (data.done)  return normalizeDocAIResult(data.document, schema);
      if (data.error) throw new Error(data.error.message ?? "DocAI failed");
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error("Google DocAI timed out");
  },
};

function normalizeDocAIResult(
  document: Record<string, unknown>,
  schema: object
): FieldResult[] {
  const schemaFields = extractSchemaFieldNames(schema);
  const formFields = (document["pages"] as Record<string, unknown>[] ?? [])
    .flatMap((page) => (page["formFields"] as Record<string, unknown>[] ?? []));

  return schemaFields.map((field) => {
    const match = formFields.find((ff) => {
      const name = getTextFromAnchor(ff["fieldName"] as Record<string, unknown>);
      return fuzzyMatch(name, field);
    });
    const value = match
      ? getTextFromAnchor(match["fieldValue"] as Record<string, unknown>)
      : null;
    const conf = match
      ? ((match["fieldValue"] as Record<string, unknown>)?.["confidence"] as number ?? 0)
      : 0;
    return { field, groundTruth: "", extracted: value, confidence: conf, isCorrect: false, docIndex: 0 };
  });
}

function getTextFromAnchor(anchor: Record<string, unknown>): string {
  return (anchor?.["textAnchor"] as Record<string, unknown>)?.["content"] as string ?? "";
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
