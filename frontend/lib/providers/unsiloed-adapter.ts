import { submitExtraction, pollResult } from "@/lib/unsiloed";
import type { IProviderAdapter, ExtractionJob, ProviderCredentials } from "./types";
import type { FieldResult } from "@/lib/calibration";

export const unsiloedAdapter: IProviderAdapter = {
  id: "unsiloed",
  label: "Unsiloed",
  credentialFields: [
    { key: "apiKey", label: "Unsiloed API Key", placeholder: "us-..." },
  ],

  async submit(file, schema, creds): Promise<ExtractionJob> {
    const jobId = await submitExtraction(creds.apiKey, file, schema);
    return { jobId };
  },

  async poll(job, _schema, creds, onStatus): Promise<FieldResult[]> {
    const result = await pollResult(creds.apiKey, job.jobId, onStatus);
    if (!result.result) return [];
    return Object.entries(result.result).map(([field, val], i) => ({
      field,
      groundTruth: "",
      extracted: String(val.value),
      confidence: val.score,
      isCorrect: false,
      docIndex: 0,
    }));
  },
};
