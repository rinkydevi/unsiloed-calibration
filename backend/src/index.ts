import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import fastifyMultipart from "@fastify/multipart";

import { authRoutes } from "./routes/auth.js";
import { runsRoutes } from "./routes/runs.js";
import { schemasRoutes } from "./routes/schemas.js";
import { groundTruthRoutes } from "./routes/ground-truth.js";

// ---------------------------------------------------------------------------
// JWT type augmentation
// ---------------------------------------------------------------------------

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; email: string };
    user: { id: string; email: string };
  }
}

// ---------------------------------------------------------------------------
// Build the Fastify app
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV !== "production";

const app = Fastify({
  logger: isDev
    ? { level: "debug", transport: { target: "pino-pretty", options: { colorize: true } } }
    : { level: "info" },
});

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

// CORS — must register before routes
await app.register(fastifyCors, {
  origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

// Cookie support — must register before JWT
await app.register(fastifyCookie);

// JWT — uses httpOnly cookie named "token"
await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret-change-in-prod",
  cookie: {
    cookieName: "token",
    signed: false,
  },
  sign: {
    expiresIn: "7d",
  },
});

// Multipart support (for CSV uploads)
await app.register(fastifyMultipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
    files: 1,
  },
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);

  const statusCode = error.statusCode ?? 500;
  const message =
    process.env.NODE_ENV === "production" && statusCode >= 500
      ? "Internal server error"
      : error.message;

  reply.status(statusCode).send({ error: message });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check
app.get("/api/health", async (_request, reply) => {
  return reply.send({ status: "ok", timestamp: new Date().toISOString() });
});

// Feature routes
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(runsRoutes, { prefix: "/api/runs" });
await app.register(schemasRoutes, { prefix: "/api/schemas" });
await app.register(groundTruthRoutes, { prefix: "/api/ground-truth" });

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const port = parseInt(process.env.PORT ?? "3001", 10);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`Server listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
