import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Prehandler that verifies the JWT stored in the "token" httpOnly cookie.
 * On success it populates request.user with { id, email }.
 * On failure it returns a 401 JSON response.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: "Not authenticated" });
  }
}
