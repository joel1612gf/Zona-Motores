/**
 * Accounting helpers — SENIAT-grade fiscal & inventory math.
 *
 * Centralizes formulas referenced by the Accounting module:
 * - Weighted Average Cost (Costo Promedio Ponderado) for kardex
 * - SENIAT TXT line builder (16 columns, tab-separated)
 * - SENIAT comprobante number generator
 * - Exchange differential
 * - CSV builder (UTF-8 BOM for Excel)
 * - Inverse IVA extraction
 */

export const IVA_RATE = 0.16;
export const IGTF_RATE = 0.03;

// ==================== INVENTORY: WEIGHTED AVERAGE COST ====================

/**
 * Weighted Average Cost (Costo Promedio Ponderado).
 * Formula: ((qtyCurrent * costCurrent) + (qtyIn * costIn)) / (qtyCurrent + qtyIn)
 *
 * If denominator is zero or negative, falls back to incoming cost.
 */
export function weightedAverageCost(
  qtyCurrent: number,
  costCurrent: number,
  qtyIn: number,
  costIn: number
): number {
  const denom = qtyCurrent + qtyIn;
  if (denom <= 0) return costIn;
  return ((qtyCurrent * costCurrent) + (qtyIn * costIn)) / denom;
}

// ==================== SENIAT: COMPROBANTE NUMBER ====================

/**
 * Builds the SENIAT retention voucher number.
 * Format: YYYY + MM + 8-digit zero-padded sequential.
 * Example: buildComprobanteNumber(2026, 5, 1) → "20260500000001"
 */
export function buildComprobanteNumber(year: number, month: number, seq: number): string {
  return `${year}${String(month).padStart(2, '0')}${String(seq).padStart(8, '0')}`;
}

// ==================== SENIAT: TXT LINE ====================

export type SeniatRetentionRow = {
  rifAgente: string;          // J123456789 — company performing retention
  periodo: string;            // AAAAMM e.g. "202605"
  fechaFactura: string;       // AAAA-MM-DD
  tipoOperacion: 'C';         // "C" = compra
  tipoDocumento: '01' | '02' | '03'; // 01 factura, 02 nota débito, 03 nota crédito
  rifProveedor: string;
  numeroFactura: string;
  numeroControl: string;
  montoTotal: number;
  baseImponible: number;
  ivaRetenido: number;
  docAfectado: string;        // "0" if not applicable
  numeroComprobante: string;  // YYYYMM + 8 digits
  montoExento: number;
  alicuota: number;           // 16.00 default
  expediente: string;         // "0" default
};

function fmt(n: number): string {
  return n.toFixed(2);
}

/**
 * Builds one SENIAT TXT line: 16 fields, tab-separated, no headers.
 * Order matches the official SENIAT XML/TXT spec for IVA withholding declarations.
 */
export function buildSeniatTxtLine(r: SeniatRetentionRow): string {
  return [
    r.rifAgente,
    r.periodo,
    r.fechaFactura,
    r.tipoOperacion,
    r.tipoDocumento,
    r.rifProveedor,
    r.numeroFactura,
    r.numeroControl,
    fmt(r.montoTotal),
    fmt(r.baseImponible),
    fmt(r.ivaRetenido),
    r.docAfectado,
    r.numeroComprobante,
    fmt(r.montoExento),
    r.alicuota.toFixed(2),
    r.expediente,
  ].join('\t');
}

/** Joins multiple rows into the final TXT body (LF newlines, SENIAT-compatible). */
export function buildSeniatTxt(rows: SeniatRetentionRow[]): string {
  return rows.map(buildSeniatTxtLine).join('\n');
}

// ==================== EXCHANGE DIFFERENTIAL ====================

/**
 * Currency differential on a USD-denominated balance.
 * Positive result = utilidad cambiaria (gain when rate rises on assets).
 */
export function exchangeDifferential(
  balanceUsd: number,
  rateNow: number,
  rateOrigin: number
): number {
  return balanceUsd * (rateNow - rateOrigin);
}

// ==================== INVERSE IVA EXTRACTION ====================

/**
 * Extracts base & IVA from a total that already includes IVA.
 * baseImponible = total / (1 + rate)
 */
export function extractIVA(total: number, rate: number = IVA_RATE): { base: number; iva: number } {
  const base = total / (1 + rate);
  return { base, iva: total - base };
}

// ==================== CSV BUILDER ====================

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // If contains comma, quote, newline → wrap in quotes and escape internal quotes
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Builds a CSV Blob with UTF-8 BOM (﻿) so Excel renders tildes correctly.
 * Numeric values are emitted unquoted so Excel treats them as numbers.
 */
export function rowsToCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): Blob {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  const body = '﻿' + lines.join('\r\n');
  return new Blob([body], { type: 'text/csv;charset=utf-8;' });
}

// ==================== DOWNLOAD HELPER (browser) ====================

/**
 * Triggers a browser download of any Blob with the given filename.
 * No-op on server (guards `window`).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==================== PERIOD UTILITIES ====================

/** Returns true if an ISO date string (YYYY-MM-DD) falls within the given year/month. */
export function isInPeriod(isoDate: string | undefined, year: number, month: number): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return false;
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
}

/** Formats year+month as SENIAT period: "AAAAMM". */
export function formatSeniatPeriod(year: number, month: number): string {
  return `${year}${String(month).padStart(2, '0')}`;
}

// ==================== FISCAL PERIOD LOCK (CIERRE FISCAL) ====================

/** Alias of formatSeniatPeriod — used by fiscal close logic. */
export function buildPeriodCode(year: number, month: number): string {
  return `${year}${String(month).padStart(2, '0')}`;
}

/** Converts a Date or ISO date string (YYYY-MM-DD / YYYY-MM-DDTHH:mm:ss) to YYYYMM. */
export function dateToPeriod(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) {
    // Fallback: if the string looks like YYYY-MM-..., slice it manually.
    if (typeof d === 'string' && /^\d{4}-\d{2}/.test(d)) {
      return d.slice(0, 4) + d.slice(5, 7);
    }
    return '000000';
  }
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** True if a YYYYMM period is locked given the persisted ultimo_periodo_cerrado. */
export function isPeriodClosed(periodYYYYMM: string, ultimoPeriodoCerrado?: string | null): boolean {
  if (!ultimoPeriodoCerrado) return false;
  return periodYYYYMM <= ultimoPeriodoCerrado;
}

/**
 * Throws a Spanish error if `docDate` falls inside a locked fiscal period.
 * Use inside runTransaction or before addDoc/updateDoc/deleteDoc on
 * compras / ventas / notas_fiscales.
 */
export function assertPeriodOpen(
  docDate: Date | string,
  ultimoPeriodoCerrado?: string | null,
  action: 'crear' | 'editar' | 'anular' = 'crear',
): void {
  const period = dateToPeriod(docDate);
  if (isPeriodClosed(period, ultimoPeriodoCerrado)) {
    const human = `${period.slice(0, 4)}-${period.slice(4)}`;
    throw new Error(
      `No se puede ${action} este documento: el período ${human} está cerrado fiscalmente. Solo el dueño puede reabrirlo desde Contabilidad.`,
    );
  }
}

/** Returns the previous YYYYMM period (e.g. '202405' → '202404', '202401' → '202312'). */
export function previousPeriod(periodYYYYMM: string): string | null {
  if (!/^\d{6}$/.test(periodYYYYMM)) return null;
  const year = parseInt(periodYYYYMM.slice(0, 4), 10);
  const month = parseInt(periodYYYYMM.slice(4), 10);
  if (month === 1) return `${year - 1}12`;
  return `${year}${String(month - 1).padStart(2, '0')}`;
}
