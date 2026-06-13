import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { MultipartFile, MultipartValue } from "@fastify/multipart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedRow {
  filename: string;
  originalFilename: string;
  fields: Record<string, string>;
  rowIndex: number;
}

interface CSVParseResult {
  rows: ParsedRow[];
  headers: string[];
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// CSV parsing utilities — mirrors frontend lib/csv-import.ts exactly
// ---------------------------------------------------------------------------

function normalizeFilename(name: string): string {
  return name.trim().toLowerCase().replace(/\.pdf$/i, "");
}

/**
 * Minimal RFC 4180-compatible CSV parser — handles quoted fields with
 * embedded commas or double-quote escapes.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++; // skip opening quote
      let field = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i).trim());
        break;
      }
      fields.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return fields;
}

function parseGroundTruthCSV(
  content: string,
  schemaFieldKeys: string[]
): CSVParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawLines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (rawLines.length < 2) {
    return {
      rows: [],
      headers: [],
      warnings,
      errors: ["CSV must have a header row and at least one data row."],
    };
  }

  const headers = parseCSVLine(rawLines[0]).map((h) => h.toLowerCase().trim());

  if (!headers.includes("filename")) {
    errors.push('CSV must have a "filename" column as the first column.');
    return { rows: [], headers, warnings, errors };
  }

  const filenameIdx = headers.indexOf("filename");
  const lowerKeys = schemaFieldKeys.map((k) => k.toLowerCase());
  const fieldIndices: Record<string, number> = {};

  for (const key of schemaFieldKeys) {
    const idx = headers.indexOf(key.toLowerCase());
    if (idx !== -1) fieldIndices[key] = idx;
  }

  const unknownHeaders = headers.filter(
    (h) => h !== "filename" && !lowerKeys.includes(h)
  );
  if (unknownHeaders.length > 0) {
    warnings.push(`Unknown columns ignored: ${unknownHeaders.join(", ")}`);
  }

  if (Object.keys(fieldIndices).length === 0) {
    errors.push(
      `No matching field columns found. Expected one or more of: ${schemaFieldKeys.join(", ")}`
    );
    return { rows: [], headers, warnings, errors };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const cells = parseCSVLine(rawLines[i]);
    const originalFilename = cells[filenameIdx]?.trim() ?? "";
    if (!originalFilename) {
      warnings.push(`Row ${i + 1} skipped — missing filename.`);
      continue;
    }
    const fields: Record<string, string> = {};
    for (const [key, idx] of Object.entries(fieldIndices)) {
      const val = cells[idx]?.trim() ?? "";
      if (val) fields[key] = val;
    }
    rows.push({
      filename: normalizeFilename(originalFilename),
      originalFilename,
      fields,
      rowIndex: i,
    });
  }

  return { rows, headers, warnings, errors };
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function groundTruthRoutes(app: FastifyInstance) {
  /**
   * POST /api/ground-truth/parse-csv
   *
   * Accepts multipart/form-data with:
   *   - csv  (file field): UTF-8 CSV text
   *   - schemaFieldKeys (field): JSON-serialised string[]
   */
  app.post(
    "/parse-csv",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let csvContent: string | undefined;
      let schemaFieldKeysRaw: string | undefined;

      // Iterate all parts so we can pick up both the file and text fields
      for await (const part of request.parts()) {
        if (part.type === "file") {
          const filepart = part as MultipartFile;
          const chunks: Buffer[] = [];
          for await (const chunk of filepart.file) {
            chunks.push(chunk as Buffer);
          }
          csvContent = Buffer.concat(chunks).toString("utf-8");
        } else {
          // text field — MultipartValue<string>
          const field = part as MultipartValue<string>;
          if (field.fieldname === "schemaFieldKeys") {
            schemaFieldKeysRaw = field.value;
          }
        }
      }

      if (!csvContent) {
        return reply.status(400).send({ error: "No CSV content uploaded" });
      }

      if (!schemaFieldKeysRaw) {
        return reply
          .status(400)
          .send({ error: "schemaFieldKeys field is required" });
      }

      let schemaFieldKeys: string[];
      try {
        schemaFieldKeys = JSON.parse(schemaFieldKeysRaw) as string[];
      } catch {
        return reply
          .status(400)
          .send({ error: "Invalid schemaFieldKeys JSON" });
      }

      if (!Array.isArray(schemaFieldKeys) || schemaFieldKeys.length === 0) {
        return reply
          .status(400)
          .send({ error: "schemaFieldKeys must be a non-empty JSON array" });
      }

      const result = parseGroundTruthCSV(csvContent, schemaFieldKeys);
      return reply.send(result);
    }
  );

  /**
   * GET /api/ground-truth/template/:schemaLabel
   *
   * Query params:
   *   - schemaFieldKeys: JSON string of string[]
   *
   * Returns a CSV template with the header row and one example row.
   */
  app.get(
    "/template/:schemaLabel",
    async (
      request: FastifyRequest<{
        Params: { schemaLabel: string };
        Querystring: { schemaFieldKeys?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { schemaLabel } = request.params;
      const rawKeys = request.query.schemaFieldKeys;

      if (!rawKeys) {
        return reply
          .status(400)
          .send({ error: "schemaFieldKeys query parameter is required" });
      }

      let schemaFieldKeys: string[];
      try {
        schemaFieldKeys = JSON.parse(rawKeys) as string[];
      } catch {
        return reply
          .status(400)
          .send({ error: "Invalid schemaFieldKeys JSON" });
      }

      if (!Array.isArray(schemaFieldKeys) || schemaFieldKeys.length === 0) {
        return reply
          .status(400)
          .send({ error: "schemaFieldKeys must be a non-empty array" });
      }

      const safeLabel = schemaLabel.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      const header = ["filename", ...schemaFieldKeys].join(",");
      const exampleRow = [
        `example_${safeLabel}.pdf`,
        ...schemaFieldKeys.map(() => ""),
      ].join(",");
      const csv = `${header}\n${exampleRow}\n`;

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="ground_truth_template_${safeLabel}.csv"`
        );
      return reply.send(csv);
    }
  );
}
