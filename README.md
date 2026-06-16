# Unsiloed Calibration Validator

Answers the question every document AI buyer eventually asks: **does a confidence score of 0.87 actually mean 87% right, on *my* documents?**

Upload PDFs → provide ground truth → get calibration curves, ECE scores, and a safe STP threshold.

**Live**
| | URL |
|---|---|
| App | [unsiloed-calibration.vercel.app](https://unsiloed-calibration.vercel.app) |
| Demo (no key needed) | [/results?demo=true](https://unsiloed-calibration.vercel.app/results?demo=true) |
| API health | [unsiloed-api-production.up.railway.app/api/health](https://unsiloed-api-production.up.railway.app/api/health) |

---

## How it works

1. User uploads PDFs and an API key — the frontend calls Unsiloed `/v2/extract` directly (key never hits this backend).
2. User enters ground truth values (manual or CSV import).
3. The backend runs the calibration pipeline and returns per-field curves + STP recommendation.
4. Results are saved to the user's run history (or `localStorage` if unauthenticated).

**Calibration pipeline** (server-side, `backend/src/lib/`):
- Isotonic regression (PAV) — smooths bucket accuracies into a monotone curve
- Wilson 95% CI per bucket — accurate at small sample sizes
- ECE per field — flags overconfidence when `>5%`
- Binomial p-value — marks fields statistically unreliable at `p < 0.05`
- `documentStpRate` — fraction of documents where *every* field clears the threshold (what maps to actual cost reduction)

---

## Stack

| | |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, Recharts — Vercel |
| Backend | Fastify 4, TypeScript, Zod, Pino — Railway |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | JWT in `httpOnly` cookies, bcrypt cost 12, rate-limited |
| Infra | Docker multi-stage builds, docker-compose |

---

## API

```
POST /api/calibration/compute   { fieldResults, stpTarget }  →  CalibrationResult
GET  /api/runs                  list saved runs
POST /api/runs                  save run
GET  /api/runs/:id              run detail
GET  /api/runs/:id/export       download HTML report
POST /api/auth/register         create account
POST /api/auth/login            sign in
GET  /api/schemas               list custom schemas
POST /api/ground-truth/parse-csv  parse CSV ground truth
```

---

## Quick start

```bash
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up --build
# App → http://localhost:3000  |  API → http://localhost:3001
```

---

Built by [Rinky Devi](https://github.com/rinkydevi) · [rinkysiwach@gmail.com](mailto:rinkysiwach@gmail.com)
