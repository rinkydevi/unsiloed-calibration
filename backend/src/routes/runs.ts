import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate } from "../middleware/authenticate.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const CreateRunBody = z.object({
  docType: z.string().min(1, "docType is required"),
  docNames: z.array(z.string()).default([]),
  schemaId: z.string().optional(),
  notes: z.string().optional(),
  calibrationResult: z.record(z.unknown()),
});

const UpdateRunBody = z.object({
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Types mirroring frontend CalibrationResult for the HTML export
// ---------------------------------------------------------------------------

interface BucketData {
  bucket: string;
  midpoint: number;
  accuracy: number;
  count: number;
  smoothedAccuracy: number;
  ciLower: number;
  ciUpper: number;
}

interface FieldBreakdownRow {
  field: string;
  avgConfidence: number;
  actualAccuracy: number;
  gap: number;
  status: "calibrated" | "overconfident" | "unreliable";
  ece: number;
  sampleCount: number;
  pValueUnreliable: number;
}

interface CalibrationResult {
  totalFields: number;
  overallAccuracy: number;
  stpThreshold: number;
  stpRate: number;
  stpTarget?: number;
  sampleSizeWarning: boolean;
  thresholdCILower?: number;
  thresholdCIUpper?: number;
  calibrationCurve: BucketData[];
  fieldBreakdown: FieldBreakdownRow[];
}

// ---------------------------------------------------------------------------
// Helper: extract summary scalars from a CalibrationResult payload
// ---------------------------------------------------------------------------

function extractSummary(result: Record<string, unknown>) {
  const r = result as Partial<CalibrationResult>;
  return {
    totalFields: typeof r.totalFields === "number" ? r.totalFields : 0,
    overallAccuracy: typeof r.overallAccuracy === "number" ? r.overallAccuracy : 0,
    stpThreshold: typeof r.stpThreshold === "number" ? r.stpThreshold : 1,
    stpRate: typeof r.stpRate === "number" ? r.stpRate : 0,
    stpTarget: typeof r.stpTarget === "number" ? r.stpTarget : 0.95,
    sampleSizeWarning: typeof r.sampleSizeWarning === "boolean" ? r.sampleSizeWarning : false,
    thresholdCILower: typeof r.thresholdCILower === "number" ? r.thresholdCILower : 0,
    thresholdCIUpper: typeof r.thresholdCIUpper === "number" ? r.thresholdCIUpper : 1,
  };
}

// ---------------------------------------------------------------------------
// Helper: generate a minimal HTML report
// ---------------------------------------------------------------------------

function generateRunReport(
  run: {
    id: string;
    docType: string;
    createdAt: Date;
    overallAccuracy: number;
    stpThreshold: number;
    stpRate: number;
    stpTarget: number;
    thresholdCILower: number;
    thresholdCIUpper: number;
    sampleSizeWarning: boolean;
    totalFields: number;
    notes: string | null;
  },
  result: CalibrationResult,
  docNames: string[]
): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const fmt = (n: number) => n.toFixed(4);

  const fieldRows = (result.fieldBreakdown ?? [])
    .map(
      (f) => `
        <tr>
          <td>${escapeHtml(f.field)}</td>
          <td>${pct(f.avgConfidence)}</td>
          <td>${pct(f.actualAccuracy)}</td>
          <td style="color:${f.gap > 0.05 ? "#f87171" : f.gap < -0.05 ? "#34d399" : "#a3a3a3"}">${f.gap > 0 ? "+" : ""}${pct(f.gap)}</td>
          <td>
            <span style="padding:2px 8px;border-radius:4px;font-size:0.75rem;background:${
              f.status === "calibrated"
                ? "#14532d"
                : f.status === "overconfident"
                ? "#7c2d12"
                : "#1e1b4b"
            };color:${
              f.status === "calibrated"
                ? "#4ade80"
                : f.status === "overconfident"
                ? "#fb923c"
                : "#a5b4fc"
            }">${f.status}</span>
          </td>
          <td>${pct(f.ece)}</td>
          <td>${f.sampleCount}</td>
        </tr>`
    )
    .join("");

  const curveRows = (result.calibrationCurve ?? [])
    .map(
      (b) => `
        <tr>
          <td>${escapeHtml(b.bucket)}</td>
          <td>${pct(b.midpoint)}</td>
          <td>${pct(b.accuracy)}</td>
          <td>${pct(b.smoothedAccuracy)}</td>
          <td>${pct(b.ciLower)} – ${pct(b.ciUpper)}</td>
          <td>${b.count}</td>
        </tr>`
    )
    .join("");

  const docList =
    docNames.length > 0
      ? `<ul>${docNames.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
      : "<p style='color:#737373'>No document names recorded.</p>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Calibration Report — ${escapeHtml(run.docType)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0a;
      color: #e5e5e5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }
    h2 { font-size: 1.125rem; font-weight: 600; margin: 2rem 0 0.75rem; color: #a3a3a3; text-transform: uppercase; letter-spacing: 0.05em; }
    .meta { color: #737373; font-size: 0.875rem; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .card {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 8px;
      padding: 1rem;
    }
    .card-label { font-size: 0.75rem; color: #737373; text-transform: uppercase; letter-spacing: 0.05em; }
    .card-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
    .warning {
      background: #431407;
      border: 1px solid #78350f;
      color: #fdba74;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    thead tr { border-bottom: 1px solid #262626; }
    th { text-align: left; padding: 0.5rem 0.75rem; color: #737373; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #1a1a1a; }
    tr:last-child td { border-bottom: none; }
    ul { list-style: disc; padding-left: 1.25rem; color: #a3a3a3; font-size: 0.875rem; }
    li { margin-bottom: 0.25rem; }
    .notes {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 8px;
      padding: 1rem;
      color: #a3a3a3;
      font-size: 0.875rem;
      white-space: pre-wrap;
    }
    footer { margin-top: 3rem; color: #525252; font-size: 0.75rem; }
  </style>
</head>
<body>
  <h1>Calibration Report</h1>
  <p class="meta">
    Document type: <strong>${escapeHtml(run.docType)}</strong> &nbsp;|&nbsp;
    Run ID: <code>${escapeHtml(run.id)}</code> &nbsp;|&nbsp;
    Generated: ${new Date(run.createdAt).toUTCString()}
  </p>

  ${
    run.sampleSizeWarning
      ? `<div class="warning">Sample size warning: fewer than 50 total fields or fewer than 5 fields in at least one confidence bucket. Results may be unreliable.</div>`
      : ""
  }

  <h2>Summary</h2>
  <div class="grid">
    <div class="card">
      <div class="card-label">Overall Accuracy</div>
      <div class="card-value">${pct(run.overallAccuracy)}</div>
    </div>
    <div class="card">
      <div class="card-label">STP Threshold</div>
      <div class="card-value">${fmt(run.stpThreshold)}</div>
    </div>
    <div class="card">
      <div class="card-label">STP Rate</div>
      <div class="card-value">${pct(run.stpRate)}</div>
    </div>
    <div class="card">
      <div class="card-label">STP Target</div>
      <div class="card-value">${pct(run.stpTarget)}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Fields</div>
      <div class="card-value">${run.totalFields}</div>
    </div>
    <div class="card">
      <div class="card-label">Threshold CI</div>
      <div class="card-value" style="font-size:1rem">${pct(run.thresholdCILower)} – ${pct(run.thresholdCIUpper)}</div>
    </div>
  </div>

  ${
    run.notes
      ? `<h2>Notes</h2><div class="notes">${escapeHtml(run.notes)}</div>`
      : ""
  }

  <h2>Field Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Field</th>
        <th>Avg Confidence</th>
        <th>Accuracy</th>
        <th>Gap</th>
        <th>Status</th>
        <th>ECE</th>
        <th>Samples</th>
      </tr>
    </thead>
    <tbody>${fieldRows || "<tr><td colspan='7' style='color:#737373;text-align:center'>No field data</td></tr>"}</tbody>
  </table>

  <h2>Calibration Curve</h2>
  <table>
    <thead>
      <tr>
        <th>Bucket</th>
        <th>Midpoint</th>
        <th>Raw Accuracy</th>
        <th>Smoothed</th>
        <th>95% CI</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>${curveRows || "<tr><td colspan='6' style='color:#737373;text-align:center'>No curve data</td></tr>"}</tbody>
  </table>

  <h2>Documents Evaluated</h2>
  ${docList}

  <footer>Generated by Unsiloed Calibration Validator &bull; ${new Date().toUTCString()}</footer>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function runsRoutes(app: FastifyInstance) {
  // All runs routes require authentication
  app.addHook("onRequest", authenticate);

  // GET /api/runs — list summaries for current user
  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const runs = await prisma.calibrationRun.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        docType: true,
        totalFields: true,
        overallAccuracy: true,
        stpThreshold: true,
        stpRate: true,
        stpTarget: true,
        sampleSizeWarning: true,
        thresholdCILower: true,
        thresholdCIUpper: true,
        notes: true,
        schemaId: true,
      },
    });
    return reply.send(runs);
  });

  // POST /api/runs — create a new calibration run
  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateRunBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { docType, docNames, schemaId, notes, calibrationResult } = parsed.data;

    const summary = extractSummary(calibrationResult);

    const run = await prisma.calibrationRun.create({
      data: {
        userId: request.user.id,
        docType,
        schemaId: schemaId ?? null,
        notes: notes ?? null,
        ...summary,
        resultJson: JSON.stringify(calibrationResult),
        docNamesJson: JSON.stringify(docNames),
      },
      select: { id: true, createdAt: true },
    });

    return reply.status(201).send(run);
  });

  // GET /api/runs/:id — full run detail
  app.get(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const run = await prisma.calibrationRun.findUnique({
        where: { id: request.params.id },
      });

      if (!run || run.userId !== request.user.id) {
        return reply.status(404).send({ error: "Run not found" });
      }

      return reply.send({
        id: run.id,
        createdAt: run.createdAt,
        docType: run.docType,
        totalFields: run.totalFields,
        overallAccuracy: run.overallAccuracy,
        stpThreshold: run.stpThreshold,
        stpRate: run.stpRate,
        stpTarget: run.stpTarget,
        sampleSizeWarning: run.sampleSizeWarning,
        thresholdCILower: run.thresholdCILower,
        thresholdCIUpper: run.thresholdCIUpper,
        notes: run.notes,
        schemaId: run.schemaId,
        calibrationResult: JSON.parse(run.resultJson) as unknown,
        docNames: JSON.parse(run.docNamesJson) as string[],
      });
    }
  );

  // DELETE /api/runs/:id
  app.delete(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const run = await prisma.calibrationRun.findUnique({
        where: { id: request.params.id },
        select: { userId: true },
      });

      if (!run || run.userId !== request.user.id) {
        return reply.status(404).send({ error: "Run not found" });
      }

      await prisma.calibrationRun.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    }
  );

  // PATCH /api/runs/:id — update notes
  app.patch(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const parsed = UpdateRunBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }

      const run = await prisma.calibrationRun.findUnique({
        where: { id: request.params.id },
        select: { userId: true },
      });

      if (!run || run.userId !== request.user.id) {
        return reply.status(404).send({ error: "Run not found" });
      }

      const updated = await prisma.calibrationRun.update({
        where: { id: request.params.id },
        data: { notes: parsed.data.notes },
        select: { id: true, notes: true, createdAt: true },
      });

      return reply.send(updated);
    }
  );

  // GET /api/runs/:id/export — HTML report
  app.get(
    "/:id/export",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const run = await prisma.calibrationRun.findUnique({
        where: { id: request.params.id },
      });

      if (!run || run.userId !== request.user.id) {
        return reply.status(404).send({ error: "Run not found" });
      }

      const result = JSON.parse(run.resultJson) as CalibrationResult;
      const docNames = JSON.parse(run.docNamesJson) as string[];

      const html = generateRunReport(
        {
          id: run.id,
          docType: run.docType,
          createdAt: run.createdAt,
          overallAccuracy: run.overallAccuracy,
          stpThreshold: run.stpThreshold,
          stpRate: run.stpRate,
          stpTarget: run.stpTarget,
          thresholdCILower: run.thresholdCILower,
          thresholdCIUpper: run.thresholdCIUpper,
          sampleSizeWarning: run.sampleSizeWarning,
          totalFields: run.totalFields,
          notes: run.notes,
        },
        result,
        docNames
      );

      reply.header("Content-Type", "text/html; charset=utf-8");
      return reply.send(html);
    }
  );
}
