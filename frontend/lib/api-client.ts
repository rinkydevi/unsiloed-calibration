/**
 * Typed wrapper around the Fastify backend API.
 * All functions fall back gracefully when BACKEND_ENABLED is false.
 */

import { API_URL, BACKEND_ENABLED } from "./config";
import type { CalibrationResult, FieldResult } from "./calibration";
import { computeCalibration } from "./calibration";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface RunSummary {
  id: string;
  createdAt: string;
  docType: string;
  totalFields: number;
  overallAccuracy: number;
  stpThreshold: number;
  stpRate: number;
  stpTarget: number;
  notes: string | null;
}

export interface RunDetail extends RunSummary {
  calibrationResult: CalibrationResult;
  docNames: string[];
}

export interface BackendSchema {
  id: string;
  name: string;
  fields: unknown;
  jsonSchema: unknown;
  createdAt: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
  name?: string
): Promise<{ user: AuthUser }> {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function login(
  email: string,
  password: string
): Promise<{ user: AuthUser }> {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<AuthUser | null> {
  if (!BACKEND_ENABLED) return null;
  try {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/me");
    return user;
  } catch {
    return null;
  }
}

// ── Calibration Runs ───────────────────────────────────────────────────────

export async function saveRun(params: {
  docType: string;
  docNames: string[];
  calibrationResult: CalibrationResult;
  schemaId?: string;
  notes?: string;
}): Promise<{ id: string; createdAt: string }> {
  return apiFetch("/api/runs", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getRuns(): Promise<RunSummary[]> {
  return apiFetch("/api/runs");
}

export async function getRun(id: string): Promise<RunDetail> {
  return apiFetch(`/api/runs/${id}`);
}

export async function deleteRun(id: string): Promise<void> {
  await apiFetch(`/api/runs/${id}`, { method: "DELETE" });
}

// ── Local history helpers (when backend is off) ────────────────────────────

const LOCAL_RUNS_KEY = "unsiloed_run_history";

interface LocalRun {
  id: string;
  createdAt: string;
  docType: string;
  docNames: string[];
  calibrationResult: CalibrationResult;
  notes?: string;
}

export function saveRunLocally(params: {
  docType: string;
  docNames: string[];
  calibrationResult: CalibrationResult;
  notes?: string;
}): string {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const run: LocalRun = { id, createdAt: new Date().toISOString(), ...params };
  const existing: LocalRun[] = getLocalRuns();
  existing.unshift(run);
  // Keep last 50 runs
  localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(existing.slice(0, 50)));
  return id;
}

export function getLocalRuns(): LocalRun[] {
  try {
    const raw = localStorage.getItem(LOCAL_RUNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLocalRun(id: string): LocalRun | null {
  return getLocalRuns().find((r) => r.id === id) ?? null;
}

export function deleteLocalRun(id: string): void {
  const updated = getLocalRuns().filter((r) => r.id !== id);
  localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(updated));
}

// ── Calibration compute (server-side PAV + Wilson CI + ECE pipeline) ──────

export async function computeCalibrationAPI(
  fieldResults: FieldResult[],
  stpTarget: number = 0.95
): Promise<CalibrationResult> {
  if (BACKEND_ENABLED) {
    return apiFetch("/api/calibration/compute", {
      method: "POST",
      body: JSON.stringify({ fieldResults, stpTarget }),
    });
  }
  return computeCalibration(fieldResults, stpTarget);
}

// ── Unified helpers (backend OR local) ────────────────────────────────────

export async function saveRunAuto(params: {
  docType: string;
  docNames: string[];
  calibrationResult: CalibrationResult;
  notes?: string;
}): Promise<string> {
  if (BACKEND_ENABLED) {
    const { id } = await saveRun(params);
    return id;
  }
  return saveRunLocally(params);
}
