# Unsiloed Calibration Validator

A full-stack tool that answers the question Aman Mishra posed in his April 2026 blog post: **does a confidence score actually predict accuracy on *your* documents?**

Upload PDFs, provide ground truth, and the tool runs them through Unsiloed's `/v2/extract` API, computes a statistically rigorous calibration curve, and tells you the exact confidence threshold where straight-through processing (STP) becomes safe.

Live demo (frontend only, no backend required): [unsiloed-calibration.vercel.app](https://unsiloed-calibration.vercel.app)

---

## Architecture

```
Browser
  │
  ├── Next.js (Vercel / Docker port 3000)
  │     └── calls Unsiloed /v2/extract directly with user's API key
  │     └── calls Fastify API for auth + persistence
  │
  └── Fastify API (Docker port 3001)
        ├── JWT auth  (httpOnly cookie, 7-day expiry)
        ├── Prisma ORM → PostgreSQL (port 5432)
        └── REST routes: /api/auth  /api/runs  /api/schemas  /api/ground-truth
```

The frontend degrades gracefully to `localStorage` when `NEXT_PUBLIC_API_URL` is unset — this is how the Vercel deployment works without a backend. Setting the env var enables cloud persistence, run history, and account-scoped schemas.

---

## Stack

| Layer | Choices |
|---|---|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| **Backend** | Fastify 4, TypeScript (ESM / NodeNext), Pino structured logging |
| **Database** | PostgreSQL 16, Prisma ORM, Prisma Migrate |
| **Auth** | JWT in httpOnly cookies (`@fastify/jwt`), bcryptjs (cost 12) |
| **Validation** | Zod at every API boundary |
| **Infra** | Docker (multi-stage builds), docker-compose, PostgreSQL healthchecks |
| **Calibration** | Isotonic regression (PAV), Wilson 95% CI, ECE, binomial p-value |

Fastify over Express: ~2× the throughput on the same hardware, built-in JSON schema serialization, and a plugin system that keeps concerns separated cleanly.

---

## Calibration Algorithm

The core question is whether a vendor's stated confidence score is *calibrated* — i.e., whether `score = 0.95` actually corresponds to ~95% accuracy in practice. Miscalibrated scores mean you cannot set a safe automation threshold and end up reviewing everything manually.

### Steps

1. **Bucket** field results into 6 confidence ranges (0–0.6, 0.6–0.7, 0.7–0.8, 0.8–0.9, 0.9–0.95, 0.95–1.0).

2. **Isotonic regression** (Pool Adjacent Violators algorithm) smooths raw bucket accuracies into a monotonically non-decreasing sequence. A single noisy low-confidence bucket cannot collapse the STP threshold recommendation. Weighted by bucket size.

3. **Wilson score 95% CI** per bucket. More accurate than normal approximation for small n or extreme p — critical when a high-confidence bucket has few samples.

4. **STP threshold**: the lowest confidence boundary where smoothed accuracy ≥ target (default 95%). Isotonic monotonicity guarantees all higher-confidence buckets also qualify.

5. **Expected Calibration Error (ECE)** per field: `Σ (|avg_confidence − accuracy|) × bucket_weight`. Standard ML calibration metric. ECE > 5% flags overconfidence.

6. **Binomial p-value** per field: one-sided test of H₀: accuracy ≥ 90%, with continuity correction. p < 0.05 flags a field as statistically unreliable regardless of ECE.

7. **Sample size warnings**: triggered when total fields < 50 or any bucket has < 5 samples. A calibration curve from 8 documents is not actionable.

8. **Threshold CI**: Wilson interval on the subset of fields *above* the STP threshold — this is what an enterprise buyer needs to trust automation.

---

## API Reference

All routes return JSON. Auth routes set/clear an `httpOnly` cookie named `token`.

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password, name?}` | Create account |
| POST | `/api/auth/login` | `{email, password}` | Sign in |
| POST | `/api/auth/logout` | — | Clear cookie |
| GET  | `/api/auth/me` | — | Current user |

### Calibration Runs

| Method | Path | Description |
|---|---|---|
| GET    | `/api/runs` | List run summaries for authenticated user |
| POST   | `/api/runs` | Save a calibration run |
| GET    | `/api/runs/:id` | Full run detail + calibration result |
| PATCH  | `/api/runs/:id` | Update notes |
| DELETE | `/api/runs/:id` | Delete run |
| GET    | `/api/runs/:id/export` | Download self-contained HTML report |

### Schemas

| Method | Path | Description |
|---|---|---|
| GET    | `/api/schemas` | List custom schemas |
| POST   | `/api/schemas` | Create schema |
| GET    | `/api/schemas/:id` | Get schema |
| PUT    | `/api/schemas/:id` | Update schema |
| DELETE | `/api/schemas/:id` | Soft-delete (sets `deletedAt`) |

### Ground Truth

| Method | Path | Description |
|---|---|---|
| POST | `/api/ground-truth/parse-csv` | Parse uploaded CSV; returns rows + warnings |
| GET  | `/api/ground-truth/template/:label` | Download CSV template for a schema |

### Health

```
GET /api/health  →  { status: "ok", timestamp: "..." }
```

---

## Local Development

### Prerequisites

- Docker + Docker Compose
- Node 20+ (for running without Docker)

### With Docker (recommended)

```bash
# 1. Copy env file and set JWT_SECRET
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# 2. Build images and start all services
docker compose up --build

# Services:
#   Frontend  → http://localhost:3000
#   API       → http://localhost:3001
#   Postgres  → localhost:5432
```

Migrations run automatically on API startup (`prisma migrate deploy`).

### Without Docker (backend only)

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL to point at a running PostgreSQL instance

npm install
npm run db:migrate   # applies migrations + generates Prisma client
npm run dev          # tsx watch — hot reload
```

Run the frontend separately:

```bash
cd frontend
npm install
# Set NEXT_PUBLIC_API_URL=http://localhost:3001 in frontend/.env.local
npm run dev
```

### Makefile shortcuts

```
make dev        # docker compose up (attached)
make build      # rebuild images
make start      # detached
make stop       # tear down
make logs       # tail all logs
make migrate    # run pending migrations in running container
make shell-api  # sh into api container
make shell-db   # psql into postgres
make clean      # remove containers, volumes, images
```

---

## Production Deployment

### Railway (recommended for quick deploy)

1. Push to GitHub.
2. Create a Railway project → **New Service → GitHub repo** → select `backend/` as root.
3. Add a **PostgreSQL** plugin — Railway injects `DATABASE_URL` automatically.
4. Set environment variables: `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`.
5. Railway detects the `Dockerfile` and builds automatically.
6. Deploy the frontend to Vercel; set `NEXT_PUBLIC_API_URL` to the Railway API URL.

### Render

Same flow — create a **Web Service** pointed at `backend/`, add a **PostgreSQL** database, connect via `DATABASE_URL`.

### On-premise / air-gapped

```bash
# Build and push to your registry
docker build -t your-registry/calibration-api:latest ./backend
docker push your-registry/calibration-api:latest

# Deploy with your Helm chart or docker compose on the target host
# Required env vars: DATABASE_URL, JWT_SECRET, FRONTEND_URL, NODE_ENV=production
```

The API image is distroless-friendly (Alpine base, non-root user in frontend image). Adapt as needed for your security policy.

---

## Security Notes

- Passwords: bcrypt, cost factor 12 (~300ms on commodity hardware — adequate for auth, not so slow it hurts UX).
- JWT stored in `httpOnly; SameSite=Lax; Secure` cookie — inaccessible to JavaScript, XSS-resistant.
- CORS origin locked to `FRONTEND_URL` env var.
- HTML report export passes all user data through `escapeHtml()` before injection.
- Production error handler strips stack traces from 5xx responses.
- API key for Unsiloed is stored in `localStorage` only and sent **directly** from the browser to Unsiloed's API — it never passes through this backend.

---

## Project Structure

```
unsiloed-calibration/
├── backend/
│   ├── src/
│   │   ├── index.ts               # Fastify app bootstrap
│   │   ├── db.ts                  # Prisma singleton
│   │   ├── middleware/
│   │   │   └── authenticate.ts    # JWT cookie verification
│   │   └── routes/
│   │       ├── auth.ts            # register / login / logout / me
│   │       ├── runs.ts            # calibration run CRUD + HTML export
│   │       ├── schemas.ts         # custom schema CRUD (soft delete)
│   │       └── ground-truth.ts    # CSV parse + template download
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── Dockerfile                 # multi-stage Node 20 build
│   └── package.json
├── frontend/
│   ├── app/                       # Next.js App Router pages
│   ├── components/                # UploadZone, CalibrationCurve, etc.
│   ├── lib/
│   │   ├── calibration.ts         # core calibration engine
│   │   ├── isotonic.ts            # PAV algorithm (weighted isotonic regression)
│   │   ├── statistics.ts          # Wilson CI, ECE, binomial p-value
│   │   ├── api-client.ts          # typed Fastify API wrapper
│   │   └── unsiloed.ts            # Unsiloed /v2/extract + poll
│   ├── Dockerfile                 # multi-stage Next.js standalone build
│   └── package.json
├── docker-compose.yml             # postgres + api + frontend
├── Makefile                       # dev shortcuts
└── .env.example
```

---

Built by Rinky Devi — applying for Founding Software Engineer (Backend & Infrastructure) at Unsiloed AI.
Contact: rinkysiwach@gmail.com
