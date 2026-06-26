import type { FieldResult } from "@/lib/calibration";

export interface ProviderCredentials {
  [key: string]: string;
}

export interface ExtractionJob {
  jobId: string;
}

export interface IProviderAdapter {
  id: string;
  label: string;
  credentialFields: { key: string; label: string; placeholder: string }[];

  /** Submit a PDF for extraction, returns a job handle */
  submit(file: File, schema: object, creds: ProviderCredentials): Promise<ExtractionJob>;

  /** Poll until complete, then return normalized FieldResults */
  poll(
    job: ExtractionJob,
    schema: object,
    creds: ProviderCredentials,
    onStatus?: (msg: string) => void
  ): Promise<FieldResult[]>;
}
