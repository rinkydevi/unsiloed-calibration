import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";

const RegisterBody = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

const LoginBody = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const COOKIE_NAME = "token";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
};

function userPublic(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post("/register", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = RegisterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: name ?? null },
    });

    const token = app.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: "7d" }
    );

    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    return reply.status(201).send({ user: userPublic(user) });
  });

  // POST /api/auth/login
  app.post("/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const token = app.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: "7d" }
    );

    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    return reply.send({ user: userPublic(user) });
  });

  // POST /api/auth/logout
  app.post("/logout", async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return reply.send({ message: "Logged out" });
  });

  // GET /api/auth/me
  app.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
    });
    if (!user) {
      return reply.status(401).send({ error: "User not found" });
    }

    return reply.send({ user: userPublic(user) });
  });
}
