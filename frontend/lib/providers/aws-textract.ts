import type { IProviderAdapter, ExtractionJob, ProviderCredentials } from "./types";
import type { FieldResult } from "@/lib/calibration";

/**
 * AWS Textract adapter — AnalyzeDocument (FORMS feature) via a thin proxy.
 *
 * Because AWS SDK v3 cannot run in the browser (no SigV4 in edge runtime),
 * this adapter calls a /api/proxy/textract endpoint that the Next.js server
 * forwards with AWS credentials kept server-side.
 *
 * Textract returns key-value pairs with BlockType=KEY_VALUE_SET. We map the
 * schema field names against extracted keys using fuzzy matching (lowercase,
 * stripped punctuation).
 */
export const awsTextractAdapter: IProviderAdapter = {
  id: "aws-textract",
  label: "AWS Textract",
  credentialFields: [
    { key: "accessKeyId",     label: "AWS Access Key ID",     placeholder: "AKIA..." },
    { key: "secretAccessKey", label: "AWS Secret Access Key", placeholder: "wJalr..." },
    { key: "region",          label: "AWS Region",            placeholder: "us-east-1" },
  ],

  async submit(file, schema, creds): Promise<ExtractionJob> {
    const body = new FormData();
    body.append("pdf_file", file);
    body.append("schema", JSON.stringify(schema));
    body.append("access_key_id",     creds.accessKeyId);
    body.append("secret_access_key", creds.secretAccessKey);
    body.append("region",            creds.region ?? "us-east-1");

    const res = await fetch("/api/proxy/textract/submit", { method: "POST", body });
    if (!res.ok) throw new Error(`Textract submit failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { jobId: data.job_id };
  },

  async poll(job, schema, creds, onStatus): Promise<FieldResult[]> {
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      const res = await fetch(
        `/api/proxy/textract/result?job_id=${encodeURIComponent(job.jobId)}` +
        `&access_key_id=${encodeURIComponent(creds.accessKeyId)}` +
        `&secret_access_key=${encodeURIComponent(creds.secretAccessKey)}` +
        `&region=${encodeURIComponent(creds.region ?? "us-east-1")}`
      );
      if (!res.ok) throw new Error(`Textract poll failed: ${res.status}`);
      const data = await res.json();
      onStatus?.(data.status);
      if (data.status === "SUCCEEDED") return normalizeTextractResult(data.blocks, schema);
      if (data.status === "FAILED")    throw new Error(data.statusMessage ?? "Textract failed");
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error("Textract timed out");
  },
};

function normalizeTextractResult(
  blocks: Record<string, unknown>[],
  schema: object
): FieldResult[] {
  const schemaFields = extractSchemaFieldNames(schema);
  const kvPairs = extractKVPairs(blocks);

  return schemaFields.map((field) => {
    const match = kvPairs.find(([k]) => fuzzyMatch(k, field));
    return {
      field,
      groundTruth: "",
      extracted: match ? match[1] : null,
      confidence: match ? match[2] : 0,
      isCorrect: false,
      docIndex: 0,
    };
  });
}

function extractKVPairs(blocks: Record<string, unknown>[]): [string, string, number][] {
  const kvBlocks = blocks.filter((b) => b["BlockType"] === "KEY_VALUE_SET" && (b["EntityTypes"] as string[])?.includes("KEY"));
  return kvBlocks.map((kv) => {
    const key   = (kv["Text"] as string) ?? "";
    const value = (kv["Value"] as string) ?? "";
    const conf  = ((kv["Confidence"] as number) ?? 0) / 100;
    return [key, value, conf] as [string, string, number];
  });
}

function extractSchemaFieldNames(schema: object): string[] {
  const s = schema as { properties?: Record<string, unknown> };
  if (s.properties) return Object.keys(s.properties);
  const arr = schema as { fields?: { name: string }[] };
  if (arr.fields) return arr.fields.map((f) => f.name);
  return [];
}

function fuzzyMatch(textractKey: string, schemaField: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalize(textractKey).includes(normalize(schemaField)) ||
         normalize(schemaField).includes(normalize(textractKey));
}
