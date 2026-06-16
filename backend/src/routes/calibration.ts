import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { computeCalibration } from "../lib/calibration.js";

const FieldResultSchema = z.object({
  field: z.string(),
  groundTruth: z.union([z.string(), z.number()]),
  extracted: z.union([z.string(), z.number(), z.null()]),
  confidence: z.number().min(0).max(1),
  isCorrect: z.boolean(),
  docIndex: z.number().int().min(0),
});

const ComputeBodySchema = z.object({
  fieldResults: z.array(FieldResultSchema).min(1, "fieldResults must not be empty"),
  stpTarget: z.number().min(0).max(1).default(0.95),
});

export const calibrationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/compute", async (request, reply) => {
    const parsed = ComputeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }
    const { fieldResults, stpTarget } = parsed.data;
    const result = computeCalibration(fieldResults, stpTarget);
    return reply.send(result);
  });
};
