import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate } from "../middleware/authenticate.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const SchemaFieldZ = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["string", "number", "date"]),
  description: z.string(),
});

const CreateSchemaBody = z.object({
  name: z.string().min(1, "Schema name is required"),
  fields: z.array(SchemaFieldZ).min(1, "At least one field is required"),
  jsonSchema: z.record(z.unknown()),
});

const UpdateSchemaBody = z.object({
  name: z.string().min(1).optional(),
  fields: z.array(SchemaFieldZ).optional(),
  jsonSchema: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function schemasRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authenticate);

  // GET /api/schemas — list all non-deleted schemas for user
  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const schemas = await prisma.customSchema.findMany({
      where: { userId: request.user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(
      schemas.map((s) => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
        fields: JSON.parse(s.fieldsJson) as unknown,
        jsonSchema: JSON.parse(s.jsonSchema) as unknown,
      }))
    );
  });

  // POST /api/schemas — create a new custom schema
  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateSchemaBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { name, fields, jsonSchema } = parsed.data;

    const schema = await prisma.customSchema.create({
      data: {
        userId: request.user.id,
        name,
        fieldsJson: JSON.stringify(fields),
        jsonSchema: JSON.stringify(jsonSchema),
      },
    });

    return reply.status(201).send({
      id: schema.id,
      name: schema.name,
      createdAt: schema.createdAt,
      fields: JSON.parse(schema.fieldsJson) as unknown,
      jsonSchema: JSON.parse(schema.jsonSchema) as unknown,
    });
  });

  // GET /api/schemas/:id
  app.get(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const schema = await prisma.customSchema.findUnique({
        where: { id: request.params.id },
      });

      if (!schema || schema.userId !== request.user.id || schema.deletedAt !== null) {
        return reply.status(404).send({ error: "Schema not found" });
      }

      return reply.send({
        id: schema.id,
        name: schema.name,
        createdAt: schema.createdAt,
        fields: JSON.parse(schema.fieldsJson) as unknown,
        jsonSchema: JSON.parse(schema.jsonSchema) as unknown,
      });
    }
  );

  // PUT /api/schemas/:id — update
  app.put(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const parsed = UpdateSchemaBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }

      const existing = await prisma.customSchema.findUnique({
        where: { id: request.params.id },
      });

      if (
        !existing ||
        existing.userId !== request.user.id ||
        existing.deletedAt !== null
      ) {
        return reply.status(404).send({ error: "Schema not found" });
      }

      const { name, fields, jsonSchema } = parsed.data;

      const updated = await prisma.customSchema.update({
        where: { id: request.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(fields !== undefined && { fieldsJson: JSON.stringify(fields) }),
          ...(jsonSchema !== undefined && { jsonSchema: JSON.stringify(jsonSchema) }),
        },
      });

      return reply.send({
        id: updated.id,
        name: updated.name,
        createdAt: updated.createdAt,
        fields: JSON.parse(updated.fieldsJson) as unknown,
        jsonSchema: JSON.parse(updated.jsonSchema) as unknown,
      });
    }
  );

  // DELETE /api/schemas/:id — soft delete
  app.delete(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const schema = await prisma.customSchema.findUnique({
        where: { id: request.params.id },
        select: { userId: true, deletedAt: true },
      });

      if (!schema || schema.userId !== request.user.id || schema.deletedAt !== null) {
        return reply.status(404).send({ error: "Schema not found" });
      }

      await prisma.customSchema.update({
        where: { id: request.params.id },
        data: { deletedAt: new Date() },
      });

      return reply.status(204).send();
    }
  );
}
