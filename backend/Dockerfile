# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (dev included — needed for tsc + prisma generate)
RUN npm ci

# Generate Prisma client targeting the correct binary (linux-musl for alpine)
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

# Production deps only
RUN npm ci --omit=dev

# Re-generate Prisma client so it matches the runner's glibc/musl
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Apply pending migrations then start; fails fast if DB is unreachable
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
