# Unsiloed Calibration Validator

Built by Rinky Devi as part of applying for the Founding Engineer role at Unsiloed AI.

## The Problem

Aman Mishra wrote about a mortgage CEO who said: "My problem is knowing which 95% doesn't
need review. If I can't tell that, my team reviews 100% anyway."

Most document AI vendors report field-level accuracy. Almost none give customers a way to
verify whether their confidence scores are actually calibrated on the customer's own
documents before committing to a deployment.

This tool does that.

## What It Does

Upload your documents, provide ground truth values for key fields, and the tool runs
them through Unsiloed's /v2/extract API. It then plots your actual confidence-vs-accuracy
curve and tells you exactly what confidence threshold gives you 95%+ accuracy on
auto-accepted fields — and what straight-through processing rate that enables.

## Live Demo

`/results?demo=true` — loads pre-computed calibration data for Financial Filing documents
without requiring an API key.

## Run Locally

```bash
# Frontend
cd frontend
npm install
npm run dev
```

Set your Unsiloed API key in the browser UI (never stored server-side).

## How It Works

1. User enters their Unsiloed API key (stored in `localStorage` only)
2. User uploads PDFs and selects document type (Invoice / Financial Filing / Contract)
3. User enters known-correct ground truth field values
4. Tool calls `POST /v2/extract` for each PDF, polls `GET /extract/{job_id}` until complete
5. Compares each extracted field to ground truth: strings (case-insensitive), numbers (±1% tolerance), dates (format-agnostic)
6. Groups results into confidence buckets and computes actual accuracy per bucket
7. Renders the calibration curve + recommends the STP threshold where accuracy ≥ 95%
8. STP Calculator shows monthly cost savings at any threshold

## Stack

Next.js 14 · TypeScript · Tailwind CSS · Recharts · Vercel

## Contact

rinkysiwach@gmail.com
