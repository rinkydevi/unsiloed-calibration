# Unsiloed Calibration Validator

Answers the question every document intelligence buyer eventually asks: **does a confidence score actually predict accuracy on *my* documents?**

Upload PDFs, provide ground truth, and the tool runs them through Unsiloed's `/v2/extract` API, computes a statistically rigorous calibration curve, and tells you the exact confidence threshold where straight-through processing (STP) becomes safe.

**Live deployment**
| Service | URL |
|---|---|
| Frontend | [unsiloed-calibration.vercel.app](https://unsiloed-calibration.vercel.app) |
| API | [unsiloed-api-production.up.railway.app](https://unsiloed-api-production.up.railway.app/api/health) |
| Demo (no API key needed) | [/results?demo=true](https://unsiloed-calibration.vercel.app/results?demo=true) |

---

## Architecture

```
Browser
  │
  ├── Next.js 14  (Vercel)
  │     ├── calls Unsiloed /v2/extract directly with the user's API key
  │     └── calls Fastify API for auth + run persistence
  │
  └── Fastify 4 API  (Railway + PostgreSQL)
        ├── JWT auth  (httpOnly cookie, 7-day expiry)
        ├── Prisma ORM → PostgreSQL 16
        └── REST: /api/auth  /api/runs  /api/schemas  /api/ground-truth
```

The frontend degrades gracefully to `localStorage` when `NEXT_PUBLIC_API_URL` is unset, so the calibration engine works fully offline without an account. Auth and run history require the backend.

---

## Stack

| Layer | Choices |
|---|---|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| **Backend** | Fastify 4, TypeScript (ESM / NodeNext), Pino structured logging |
| **Database** | PostgreSQL 16, Prisma ORM, Prisma Migrate |
| **Auth** | JWT in httpOnly cookies (`@fastify/jwt`), bcryptjs cost 12, rate-limited (10 req/min per IP) |
| **Validation** | Zod at every API boundary |
| **Infra** | Docker multi-stage builds, docker-compose, PostgreSQL healthchecks |
| **Calibration** | Isotonic regression (PAV), Wilson 95% CI, ECE, binomial p-value, per-field curves, document STP rate |

---

## Calibration Algorithm

The core question is whether a vendor's confidence score is *calibrated* — i.e., whether `score = 0.95` corresponds to ~95% accuracy in practice. Miscalibrated scores make it impossible to set a safe STP threshold; you end up reviewing everything manually.

### Pipeline

1. **Bucket** field results into 6 confidence ranges: 0–0.6, 0.6–0.7, 0.7–0.8, 0.8–0.9, 0.9–0.95, 0.95–1.0.

2. **Isotonic regression** (Pool Adjacent Violators) smooths raw bucket accuracies into a monotonically non-decreasing sequence, weighted by bucket size. A single noisy bucket cannot collapse the STP threshold.

3. **Wilson score 95% CI** per bucket — more accurate than the normal approximation when bucket counts are small, which they often are at the high-confidence end.

4. **STP threshold**: the lowest confidence boundary where smoothed accuracy ≥ target (default 95%). Monotonicity guarantees all higher-confidence buckets also qualify.

5. **Expected Calibration Error (ECE)** per field: `Σ |avg_confidence − accuracy| × bucket_weight`. ECE > 5% flags overconfidence.

6. **Binomial p-value** per field: one-sided test of H₀: accuracy ≥ 90% (continuity-corrected). p < 0.05 marks the field statistically unreliable regardless of ECE.

7. **Per-field calibration curves**: each field gets its own isotonic-smoothed reliability diagram. A field can be badly overconfident even when aggregate ECE looks fine — a 10% weight diluted by 90% well-calibrated fields hides the problem at the aggregate level.

8. **`documentStpRate`**: distinct from field-level STP rate. A reviewer opens a document, not a field — one low-confidence field anywhere sends the whole document to the queue. `documentStpRate` is the fraction of documents where every evaluated field clears the threshold; this is the metric that maps to actual processing cost reduction.

9. **Threshold CI**: Wilson interval on the above-threshold subset — the confidence interval on the accuracy claim that underpins the STP recommendation.

10. **Sample size warnings**: fired when total fields < 50 or any bucket has < 5 samples. Results below these thresholds are directional only.

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
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up --build
# Frontend  → http://localhost:3000
# API       → http://localhost:3001
# Postgres  → localhost:5432
```

Migrations run automatically on API startup (`prisma migrate deploy`).

### Without Docker

```bash
# Backend
cd backend
cp .env.example .env          # set DATABASE_URL to a running PostgreSQL instance
npm install
npm run db:migrate            # applies migrations + generates Prisma client
npm run dev                   # tsx watch, hot reload

# Frontend (separate terminal)
cd frontend
npm install
# NEXT_PUBLIC_API_URL=http://localhost:3001 in frontend/.env.local
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
make shell-api  # sh into API container
make shell-db   # psql into postgres
make clean      # remove containers, volumes, images
```

---

## Deployment

Currently deployed as:

- **Frontend** → Vercel (auto-deploys from `main`)
- **Backend + PostgreSQL** → Railway (Docker build from `backend/`, PostgreSQL plugin)

To deploy your own instance:

1. Fork the repo and connect to Railway. Add a PostgreSQL plugin — Railway injects `DATABASE_URL` automatically.
2. Set `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production` on the Railway service.
3. Connect the frontend to Vercel; set `NEXT_PUBLIC_API_URL` to the Railway service URL.

For air-gapped or on-premise deployments:

```bash
docker build -t your-registry/calibration-api:latest ./backend
docker push your-registry/calibration-api:latest
# Required env vars: DATABASE_URL, JWT_SECRET, FRONTEND_URL, NODE_ENV=production
```

---

## Security

- Passwords hashed with bcrypt, cost factor 12.
- JWT stored in `httpOnly; SameSite=Lax; Secure` cookie — inaccessible to JavaScript.
- CORS origin locked to `FRONTEND_URL`.
- Auth routes rate-limited to 10 requests per minute per IP.
- HTML report export escapes all user data before injection.
- Production error handler strips stack traces from 5xx responses.
- The Unsiloed API key is stored in `localStorage` only and sent directly from the browser to Unsiloed's API — it never passes through this backend.

---

## Project Structure

```
unsiloed-calibration/
├── backend/
│   ├── src/
│   │   ├── index.ts               # Fastify app + plugin registration
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
│   ├── Dockerfile                 # multi-stage Node 20 Alpine build
│   └── package.json
├── frontend/
│   ├── app/                       # Next.js App Router pages
│   ├── components/                # CalibrationCurve, PerFieldCurves, FieldBreakdown, STPCalculator, etc.
│   ├── lib/
│   │   ├── calibration.ts         # core calibration engine
│   │   ├── isotonic.ts            # PAV algorithm (weighted isotonic regression)
│   │   ├── statistics.ts          # Wilson CI, ECE, binomial p-value
│   │   ├── api-client.ts          # typed Fastify API wrapper
│   │   └── unsiloed.ts            # Unsiloed /v2/extract + poll
│   ├── Dockerfile                 # multi-stage Next.js standalone build
│   └── package.json
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

Built by [Rinky Devi](https://github.com/rinkydevi) · [rinkysiwach@gmail.com](mailto:rinkysiwach@gmail.com)
