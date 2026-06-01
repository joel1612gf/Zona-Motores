/**
 * Pure analytics helpers for the Super Admin dashboard.
 *
 * Sources: the same Firestore reads the KPIs already need — `created_at` of each
 * Concesionario and `createdAt` of each marketplace Vehicle listing, plus the
 * current `precio_mensual_usd` / `plan_activo` for MRR.
 *
 * Growth model: COMPOUND (geometric), since SaaS tenant count and MRR grow
 * multiplicatively. The monthly rate is estimated via CMGR over the populated
 * window and clamped to avoid blow-ups from sparse early data.
 *
 * MRR caveat: there is no historical record of past fees (the price is editable),
 * so the MRR series retro-applies the CURRENT price from each active tenant's
 * creation month ("as-if-today pricing"). MRR projections are therefore approximate
 * and the UI must label them as such.
 *
 * No external date library: plain Date arithmetic. Months are bucketed in the
 * runtime's local timezone, which is acceptable for month-granularity trends.
 */

import type { Timestamp } from 'firebase/firestore';
import type { Concesionario } from './business-types';

export type DateInput =
  | Timestamp
  | Date
  | number
  | string
  | { seconds: number; nanoseconds?: number }
  | null
  | undefined;

export interface MonthPoint {
  /** 'YYYY-MM' */
  ym: string;
  value: number;
}

export interface ProjectionResult {
  /** Estimated monthly growth rate (e.g. 0.12 = +12%/month). */
  monthlyRate: number;
  model: 'compound' | 'flat';
  /** Projected values for months +1..+6 (length 6). */
  projected: number[];
  /** Most recent observed value (the projection's starting point). */
  lastValue: number;
  confidence: 'high' | 'medium' | 'low';
  /** True when the history is too thin to model growth (UI should warn). */
  insufficientData: boolean;
}

export interface AdminMetrics {
  totals: { dealerships: number; mrr: number; vehicles: number };
  growth: { dealerships: number | null; mrr: number | null; vehicles: number | null };
  projection: { dealerships: ProjectionResult; mrr: ProjectionResult; vehicles: ProjectionResult };
  series: { dealerships: MonthPoint[]; mrr: MonthPoint[]; vehicles: MonthPoint[] };
}

const HORIZON = 6; // months projected forward
const HISTORY_MONTHS = 12; // months of history bucketed
const R_MIN = -0.9;
const R_MAX = 2.0;

// ==================== DATE NORMALIZATION ====================

function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const anyInput = input as { toDate?: () => Date; seconds?: number };
  if (typeof anyInput.toDate === 'function') {
    try {
      const d = anyInput.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof anyInput.seconds === 'number') {
    const d = new Date(anyInput.seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toYearMonth(input: DateInput): string | null {
  const d = toDate(input);
  if (!d) return null;
  return monthKey(d.getFullYear(), d.getMonth());
}

function monthKey(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
}

/** Returns the last `n` month keys (oldest → newest), ending at `now`'s month. */
export function lastNMonthKeys(n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-based
  for (let i = 0; i < n; i++) {
    keys.push(monthKey(y, m));
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return keys.reverse();
}

/** First-ms timestamp of the month AFTER the given 'YYYY-MM' key. */
function endOfMonthExclusive(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 1).getTime(); // m is 1-based key → Date(y, m, 1) = first day of NEXT month
}

// ==================== SERIES BUILDERS ====================

/**
 * Cumulative count per month: for each of the last `months`, how many items had
 * been created on or before the end of that month.
 */
export function buildCumulativeMonthlySeries(
  createdAtList: DateInput[],
  months: number = HISTORY_MONTHS,
  now: Date = new Date(),
): MonthPoint[] {
  const times = createdAtList
    .map(toDate)
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  return lastNMonthKeys(months, now).map((ym) => {
    const cutoff = endOfMonthExclusive(ym);
    return { ym, value: times.filter((t) => t < cutoff).length };
  });
}

/**
 * Cumulative MRR per month using as-if-today pricing: a tenant contributes its
 * current `precio_mensual_usd` to every month on/after its creation month,
 * counting only currently-active tenants.
 */
export function buildMrrMonthlySeries(
  dealerships: Array<Pick<Concesionario, 'created_at' | 'precio_mensual_usd' | 'plan_activo'>>,
  months: number = HISTORY_MONTHS,
  now: Date = new Date(),
): MonthPoint[] {
  const active = dealerships
    .filter((d) => d.plan_activo === true)
    .map((d) => ({ t: toDate(d.created_at)?.getTime() ?? null, price: d.precio_mensual_usd ?? 0 }));
  return lastNMonthKeys(months, now).map((ym) => {
    const cutoff = endOfMonthExclusive(ym);
    const value = active.reduce((sum, d) => (d.t !== null && d.t < cutoff ? sum + d.price : sum), 0);
    return { ym, value };
  });
}

// ==================== GROWTH & PROJECTION ====================

/** Month-over-month growth between the last two points. null if no valid base. */
export function lastMonthGrowthRate(series: number[]): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev <= 0) return null;
  return (last - prev) / prev;
}

function clampRate(r: number): number {
  if (!Number.isFinite(r)) return 0;
  return Math.min(R_MAX, Math.max(R_MIN, r));
}

/**
 * Projects 6 months forward using compound growth: projected(k) = last * (1+r)^k.
 * `r` is the compound monthly growth rate (CMGR) over the populated window:
 *   r = (last / first)^(1/n) - 1
 * Falls back to flat (no growth) when data is too sparse.
 */
export function projectSixMonths(series: number[]): ProjectionResult {
  const clean = series.filter((v) => Number.isFinite(v));
  const last = clean.length ? clean[clean.length - 1] : 0;

  const flat = (confidence: ProjectionResult['confidence'], insufficient: boolean): ProjectionResult => ({
    monthlyRate: 0,
    model: 'flat',
    projected: Array.from({ length: HORIZON }, () => last),
    lastValue: last,
    confidence,
    insufficientData: insufficient,
  });

  if (clean.length < 2 || last <= 0) return flat('low', true);

  const firstIdx = clean.findIndex((v) => v > 0);
  const first = firstIdx >= 0 ? clean[firstIdx] : 0;
  const n = firstIdx >= 0 ? clean.length - 1 - firstIdx : 0;

  let r: number;
  if (firstIdx < 0 || first <= 0 || n <= 0) {
    const lm = lastMonthGrowthRate(clean);
    if (lm == null) return flat('low', false);
    r = clampRate(lm);
  } else {
    r = clampRate(Math.pow(last / first, 1 / n) - 1);
  }

  const projected = Array.from({ length: HORIZON }, (_, i) => last * Math.pow(1 + r, i + 1));

  const populated = clean.filter((v) => v > 0).length;
  const confidence: ProjectionResult['confidence'] = populated >= 6 ? 'high' : populated >= 3 ? 'medium' : 'low';

  return { monthlyRate: r, model: 'compound', projected, lastValue: last, confidence, insufficientData: false };
}

// ==================== AGGREGATOR ====================

export function computeAdminMetrics(
  dealerships: Array<Pick<Concesionario, 'created_at' | 'precio_mensual_usd' | 'plan_activo'>>,
  listings: Array<{ createdAt?: DateInput }>,
  now: Date = new Date(),
): AdminMetrics {
  const dealerSeries = buildCumulativeMonthlySeries(dealerships.map((d) => d.created_at), HISTORY_MONTHS, now);
  const mrrSeries = buildMrrMonthlySeries(dealerships, HISTORY_MONTHS, now);
  const vehicleSeries = buildCumulativeMonthlySeries(listings.map((l) => l.createdAt), HISTORY_MONTHS, now);

  return {
    totals: {
      dealerships: dealerships.length,
      mrr: dealerships
        .filter((d) => d.plan_activo === true)
        .reduce((s, d) => s + (d.precio_mensual_usd ?? 0), 0),
      vehicles: listings.length,
    },
    growth: {
      dealerships: lastMonthGrowthRate(dealerSeries.map((p) => p.value)),
      mrr: lastMonthGrowthRate(mrrSeries.map((p) => p.value)),
      vehicles: lastMonthGrowthRate(vehicleSeries.map((p) => p.value)),
    },
    projection: {
      dealerships: projectSixMonths(dealerSeries.map((p) => p.value)),
      mrr: projectSixMonths(mrrSeries.map((p) => p.value)),
      vehicles: projectSixMonths(vehicleSeries.map((p) => p.value)),
    },
    series: { dealerships: dealerSeries, mrr: mrrSeries, vehicles: vehicleSeries },
  };
}
