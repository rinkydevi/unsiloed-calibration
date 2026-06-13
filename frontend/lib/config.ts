/** URL of the Fastify backend API. Set NEXT_PUBLIC_API_URL to enable cloud persistence. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** True when the backend is configured — enables cloud save, history, and team features. */
export const BACKEND_ENABLED = API_URL !== "";
