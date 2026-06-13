export type DocumentType = "invoice" | "financial_filing" | "contract";
export type SchemaSource = "builtin" | "custom";

export interface SchemaField {
  key: string;
  label: string;
  type: "string" | "number" | "date";
  description: string;
}

export interface DocSchema {
  id: string;
  label: string;
  source: SchemaSource;
  fields: SchemaField[];
  jsonSchema: object;
}

/** Builds the Unsiloed /v2/extract JSON Schema payload from a field list. */
export function generateJsonSchema(fields: SchemaField[]): object {
  const properties: Record<string, object> = {};
  const required: string[] = [];
  for (const field of fields) {
    properties[field.key] = {
      type: field.type === "date" ? "string" : field.type,
      description: field.description || field.label,
    };
    required.push(field.key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

/** Auto-slug a label into a valid field key. */
export function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Validate a schema before saving. Returns error strings (empty = valid). */
export function validateSchemaFields(
  name: string,
  fields: SchemaField[]
): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push("Schema name is required.");
  if (fields.length === 0) errors.push("Add at least one field.");
  if (fields.length > 20) errors.push("Maximum 20 fields allowed.");
  const keys = fields.map((f) => f.key);
  const dups = keys.filter((k, i) => k && keys.indexOf(k) !== i);
  if (dups.length > 0) errors.push(`Duplicate field keys: ${dups.join(", ")}`);
  fields.forEach((f, i) => {
    if (!f.key) {
      errors.push(`Field ${i + 1}: key is required.`);
    } else if (!/^[a-z][a-z0-9_]*$/.test(f.key)) {
      errors.push(
        `Field "${f.key}": must start with a letter and contain only lowercase letters, numbers, underscores.`
      );
    }
    if (!f.label.trim()) errors.push(`Field ${i + 1}: label is required.`);
  });
  return errors;
}

// ── Built-in schemas ────────────────────────────────────────────────────────

export const BUILTIN_SCHEMAS: Record<DocumentType, DocSchema> = {
  invoice: {
    id: "invoice",
    label: "Invoice",
    source: "builtin",
    fields: [
      { key: "vendor_name",    label: "Vendor Name",    type: "string", description: "Name of the company issuing the invoice" },
      { key: "invoice_number", label: "Invoice Number", type: "string", description: "Unique invoice identifier" },
      { key: "issue_date",     label: "Issue Date",     type: "date",   description: "Date the invoice was issued" },
      { key: "total_due",      label: "Total Due",      type: "number", description: "Final total amount due including tax" },
    ],
    jsonSchema: {
      type: "object",
      properties: {
        vendor_name:    { type: "string", description: "Name of the company issuing the invoice" },
        invoice_number: { type: "string", description: "Unique invoice identifier" },
        issue_date:     { type: "string", description: "Date the invoice was issued" },
        total_due:      { type: "number", description: "Final total amount due including tax" },
      },
      required: ["vendor_name", "invoice_number", "issue_date", "total_due"],
      additionalProperties: false,
    },
  },
  financial_filing: {
    id: "financial_filing",
    label: "Financial Filing",
    source: "builtin",
    fields: [
      { key: "company_name",    label: "Company Name",    type: "string", description: "Name of the company" },
      { key: "report_date",     label: "Report Date",     type: "date",   description: "Date of the financial report" },
      { key: "total_revenue",   label: "Total Revenue",   type: "number", description: "Total revenue in the reporting period" },
      { key: "total_expenses",  label: "Total Expenses",  type: "number", description: "Total expenses in the reporting period" },
      { key: "net_income",      label: "Net Income",      type: "number", description: "Net income or loss for the period" },
    ],
    jsonSchema: {
      type: "object",
      properties: {
        company_name:   { type: "string", description: "Name of the company" },
        report_date:    { type: "string", description: "Date of the financial report" },
        total_revenue:  { type: "number", description: "Total revenue in the reporting period" },
        total_expenses: { type: "number", description: "Total expenses in the reporting period" },
        net_income:     { type: "number", description: "Net income or loss for the period" },
      },
      required: ["company_name", "report_date", "total_revenue", "total_expenses", "net_income"],
      additionalProperties: false,
    },
  },
  contract: {
    id: "contract",
    label: "Contract",
    source: "builtin",
    fields: [
      { key: "party_1_name",    label: "Party 1 Name",    type: "string", description: "First party to the contract" },
      { key: "party_2_name",    label: "Party 2 Name",    type: "string", description: "Second party to the contract" },
      { key: "effective_date",  label: "Effective Date",  type: "date",   description: "Date the contract becomes effective" },
      { key: "contract_value",  label: "Contract Value",  type: "number", description: "Total monetary value of the contract" },
      { key: "jurisdiction",    label: "Jurisdiction",    type: "string", description: "Governing law jurisdiction" },
    ],
    jsonSchema: {
      type: "object",
      properties: {
        party_1_name:   { type: "string", description: "First party to the contract" },
        party_2_name:   { type: "string", description: "Second party to the contract" },
        effective_date: { type: "string", description: "Date the contract becomes effective" },
        contract_value: { type: "number", description: "Total monetary value of the contract" },
        jurisdiction:   { type: "string", description: "Governing law jurisdiction" },
      },
      required: ["party_1_name", "party_2_name", "effective_date"],
      additionalProperties: false,
    },
  },
};

// Keep for backward compat (calibrate page still uses SCHEMAS in some places)
export const SCHEMAS = BUILTIN_SCHEMAS;

// ── Custom schema storage ───────────────────────────────────────────────────

const STORAGE_KEY = "unsiloed_custom_schemas";

export function getCustomSchemas(): DocSchema[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DocSchema[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomSchema(
  schema: Omit<DocSchema, "id" | "source"> & { id?: string }
): DocSchema {
  const existing = getCustomSchemas();
  const id = schema.id ?? `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const saved: DocSchema = { ...schema, id, source: "custom" };
  const updated = [...existing.filter((s) => s.id !== id), saved];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("unsiloed-schemas-changed"));
  return saved;
}

export function deleteCustomSchema(id: string): void {
  const updated = getCustomSchemas().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("unsiloed-schemas-changed"));
}

export function getAllSchemas(): DocSchema[] {
  return [...Object.values(BUILTIN_SCHEMAS), ...getCustomSchemas()];
}
