export interface ParsedRow {
  filename: string; // normalized: lowercase, no extension
  originalFilename: string;
  fields: Record<string, string>;
  rowIndex: number;
}

export interface CSVParseResult {
  rows: ParsedRow[];
  headers: string[];
  warnings: string[];
  errors: string[];
}

function normalizeFilename(name: string): string {
  return name.trim().toLowerCase().replace(/\.pdf$/i, "");
}

// Minimal RFC 4180-compatible CSV parser — handles quoted fields with commas/newlines inside
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

export function parseGroundTruthCSV(
  content: string,
  schemaFieldKeys: string[]
): CSVParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawLines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (rawLines.length < 2) {
    return { rows: [], headers: [], warnings, errors: ["CSV must have a header row and at least one data row."] };
  }

  const headers = parseCSVLine(rawLines[0]).map((h) => h.toLowerCase().trim());

  if (!headers.includes("filename")) {
    errors.push('CSV must have a "filename" column as the first column.');
    return { rows: [], headers, warnings, errors };
  }

  const filenameIdx = headers.indexOf("filename");
  const fieldIndices: Record<string, number> = {};
  for (const key of schemaFieldKeys) {
    const idx = headers.indexOf(key.toLowerCase());
    if (idx !== -1) fieldIndices[key] = idx;
  }

  const unknownHeaders = headers.filter(
    (h) => h !== "filename" && !schemaFieldKeys.includes(h)
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

/**
 * Match parsed CSV rows to an uploaded File array by filename.
 * Returns a groundTruth map (docIndex → field values) and any unmatched items.
 */
export function matchCSVToFiles(
  rows: ParsedRow[],
  files: File[]
): {
  groundTruth: Record<number, Record<string, string>>;
  unmatchedFiles: number[];
  unmatchedCSVRows: number[];
} {
  const groundTruth: Record<number, Record<string, string>> = {};
  const matchedCSVRowIndices = new Set<number>();

  files.forEach((file, fileIdx) => {
    const normalized = normalizeFilename(file.name);
    const match = rows.find((r) => r.filename === normalized);
    if (match) {
      groundTruth[fileIdx] = { ...match.fields };
      matchedCSVRowIndices.add(match.rowIndex);
    }
  });

  const unmatchedFiles = files
    .map((_, i) => i)
    .filter((i) => !groundTruth[i]);

  const unmatchedCSVRows = rows
    .filter((r) => !matchedCSVRowIndices.has(r.rowIndex))
    .map((r) => r.rowIndex);

  return { groundTruth, unmatchedFiles, unmatchedCSVRows };
}

export function generateCSVTemplate(
  schemaFieldKeys: string[],
  schemaLabel: string
): string {
  const header = ["filename", ...schemaFieldKeys].join(",");
  const example = [`example_${schemaLabel.toLowerCase().replace(/\s+/g, "_")}.pdf`, ...schemaFieldKeys.map(() => "")].join(",");
  return `${header}\n${example}\n`;
}
