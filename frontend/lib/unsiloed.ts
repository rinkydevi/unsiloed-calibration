const BASE_URL = "https://prod.visionapi.unsiloed.ai";

export interface ExtractedField {
  value: string | number;
  score: number;
}

export interface ExtractionResult {
  job_id: string;
  status: "completed" | "failed" | "processing";
  result?: Record<string, ExtractedField>;
  error?: string;
}

export async function submitExtraction(
  apiKey: string,
  pdfFile: File,
  schema: object
): Promise<string> {
  const formData = new FormData();
  formData.append("pdf_file", pdfFile);
  formData.append("schema_data", JSON.stringify(schema));

  const res = await fetch(`${BASE_URL}/v2/extract`, {
    method: "POST",
    headers: { "api-key": apiKey },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Extraction failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.job_id as string;
}

export async function pollResult(
  apiKey: string,
  jobId: string,
  onStatus?: (status: string) => void
): Promise<ExtractionResult> {
  const deadline = Date.now() + 5 * 60 * 1000;

  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/extract/${jobId}`, {
      headers: { "api-key": apiKey },
    });

    if (!res.ok) {
      throw new Error(`Poll failed: ${res.status}`);
    }

    const data: ExtractionResult = await res.json();
    onStatus?.(data.status);

    if (data.status === "completed") return data;
    if (data.status === "failed") throw new Error(data.error || "Extraction failed");

    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new Error("Extraction timed out after 5 minutes");
}
