# Unsiloed Calibration Validator

A tool for teams using Unsiloed's document extraction API to verify whether the model's confidence scores are actually calibrated on their own documents — before committing to a production deployment.

## The Problem

Most document AI vendors report field-level accuracy. Almost none give customers a way to verify whether their confidence scores are calibrated on the customer's own documents.

The result: a mortgage ops team that's told "95% accuracy" still reviews 100% of extractions, because they can't tell which 95% is safe to auto-accept.

This tool answers that question with data.

## What It Does

Upload your documents, provide known-correct ground truth values, and the tool runs them through Unsiloed's `/v2/extract` API. It then:

- Plots your actual confidence-vs-accuracy calibration curve
- Identifies the confidence threshold where accuracy ≥ 95% on your documents
- Shows exactly what straight-through processing (STP) rate that threshold enables
- Breaks down calibration quality per field with statistical confidence intervals
- Estimates monthly review cost savings at any threshold

## Live Demo

Visit `/results?demo=true` — loads pre-computed calibration data for Financial Filing documents without requiring an API key.

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

Enter your Unsiloed API key in the browser UI. It is stored in `localStorage` only and sent directly to Unsiloed's API — never through an intermediary server.

## How It Works

1. Enter your Unsiloed API key
2. Upload PDFs and select document type (Invoice / Financial Filing / Contract, or define a custom schema)
3. Enter known-correct ground truth values per document — or import via CSV template
4. Tool calls `POST /v2/extract` for each PDF and polls until complete
5. Compares extracted fields to ground truth: strings (case-insensitive), numbers (±1% tolerance), dates (format-agnostic)
6. Groups results into confidence buckets and computes actual accuracy per bucket using isotonic regression
7. Renders the calibration curve with Wilson 95% confidence intervals
8. Recommends the STP threshold where smoothed accuracy ≥ your target (90% / 95% / 99%)
9. STP Calculator shows monthly hours and cost savings at any threshold

## Stack

Next.js 14 · TypeScript · Tailwind CSS · Recharts · Fastify · Prisma · Vercel

## Contact

rinkysiwach@gmail.com
