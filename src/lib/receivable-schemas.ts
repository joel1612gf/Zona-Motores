import { z } from 'zod';
import type { Cuota, CuotaEstado, CreditFrequency, ReceivableOrigen } from './business-types';

/**
 * Validation schema for the CXC collection execution form.
 * Account selection and payment method are handled by the PaymentEngine component.
 */
export const receivablePaymentSchema = z.object({
  monto_pago: z
    .number({ invalid_type_error: 'Ingrese un monto válido' })
    .min(0.01, 'El monto debe ser mayor a 0'),
  referencia: z.string().optional(),
});

export type ReceivablePaymentFormValues = z.infer<typeof receivablePaymentSchema>;

/**
 * Validation schema for the credit terms wizard within sale-form-dialog.
 * The vendor configures: number of instalments, frequency, annual rate, down payment, first due date.
 */
export const creditTermsSchema = z
  .object({
    cuotas: z
      .number({ invalid_type_error: 'Número de cuotas inválido' })
      .int('Debe ser entero')
      .min(1, 'Mínimo 1 cuota')
      .max(60, 'Máximo 60 cuotas'),
    frecuencia: z.enum(['semanal', 'quincenal', 'mensual']),
    tasa_interes_anual: z
      .number({ invalid_type_error: 'Tasa inválida' })
      .min(0, 'Tasa mínima 0%')
      .max(100, 'Tasa máxima 100%'),
    inicial_usd: z
      .number({ invalid_type_error: 'Inicial inválida' })
      .min(0, 'No puede ser negativa'),
    fecha_primera_cuota: z.date({ invalid_type_error: 'Fecha inválida' }),
    total_venta_usd: z.number().min(0.01),
  })
  .refine((d) => d.inicial_usd < d.total_venta_usd, {
    message: 'La inicial no puede ser mayor o igual al total',
    path: ['inicial_usd'],
  });

export type CreditTermsFormValues = z.infer<typeof creditTermsSchema>;

/**
 * Normalized row shape used to unify receivables from different Firestore collections
 * into a single table in the CXC dashboard (mirror of PayableRow).
 */
export type ReceivableRow = {
  id: string;
  origen: ReceivableOrigen;
  // Source document IDs for atomic transaction writes
  cuenta_cobrar_id?: string;
  cuota_id?: string;
  venta_id?: string;
  nota_id?: string;
  // Client info
  cliente_id?: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  // Display
  descripcion: string;
  numero_cuota?: number;
  cuotas_total?: number;
  // Fiscal gate — controls IGTF retention when collecting in divisa from special-taxpayer fiscal invoice
  is_fiscal: boolean;
  // Amounts (USD)
  monto_original: number;
  saldo_pendiente: number;
  // Dates
  fecha_emision: Date;
  fecha_vencimiento?: Date;
  // Status
  estado: CuotaEstado;
  // For grouping: instalments belonging to a CuentaPorCobrar
  parentCuentaId?: string;
};

// ==================== HELPERS ====================

const FREQUENCY_DAYS: Record<CreditFrequency, number> = {
  semanal: 7,
  quincenal: 15,
  mensual: 30,
};

/**
 * Generates an array of instalment plans using simple interest distributed evenly.
 *
 * Formula: total_interes = saldo_financiado * tasa_anual * total_dias / 365
 * Each cuota carries an equal share of (capital + interés).
 *
 * Returns plain objects suitable for transaction.set (no Firestore Timestamps yet — caller
 * converts fecha_vencimiento to Timestamp before persisting).
 */
export type GeneratedCuota = Omit<Cuota, 'id' | 'fecha_vencimiento' | 'concesionario_id' | 'cuenta_cobrar_id'> & {
  fecha_vencimiento: Date;
};

export function generarCuotas(
  saldoFinanciadoUsd: number,
  tasaAnual: number,
  cuotasTotal: number,
  frecuencia: CreditFrequency,
  primeraFecha: Date
): GeneratedCuota[] {
  if (saldoFinanciadoUsd <= 0 || cuotasTotal <= 0) return [];

  const daysPerInstallment = FREQUENCY_DAYS[frecuencia];
  const totalDays = daysPerInstallment * cuotasTotal;
  const totalInterest = saldoFinanciadoUsd * (tasaAnual / 100) * (totalDays / 365);
  const totalConInteres = saldoFinanciadoUsd + totalInterest;
  const montoCuotaBase = roundUsd(totalConInteres / cuotasTotal);

  const capitalPorCuota = roundUsd(saldoFinanciadoUsd / cuotasTotal);
  const interesPorCuota = roundUsd(totalInterest / cuotasTotal);

  const cuotas: GeneratedCuota[] = [];
  let sumaCapital = 0;
  let sumaInteres = 0;
  let sumaMonto = 0;

  for (let i = 0; i < cuotasTotal; i++) {
    const numero = i + 1;
    const fecha = new Date(primeraFecha);
    fecha.setDate(fecha.getDate() + daysPerInstallment * i);

    let capital = capitalPorCuota;
    let interes = interesPorCuota;
    let monto = montoCuotaBase;

    // Last installment absorbs rounding remainders so totals match exactly.
    if (numero === cuotasTotal) {
      capital = roundUsd(saldoFinanciadoUsd - sumaCapital);
      interes = roundUsd(totalInterest - sumaInteres);
      monto = roundUsd(totalConInteres - sumaMonto);
    }

    sumaCapital += capital;
    sumaInteres += interes;
    sumaMonto += monto;

    cuotas.push({
      numero,
      monto_usd: monto,
      capital,
      interes,
      saldo_usd: monto,
      paid_usd: 0,
      fecha_vencimiento: fecha,
      estado: 'pendiente',
    });
  }

  return cuotas;
}

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Re-derives the estado of an installment based on its saldo and due date.
 * Use this on read paths (the dashboard) — Firestore doesn't auto-update past-due flags.
 */
export function deriveCuotaEstado(cuota: Pick<Cuota, 'saldo_usd' | 'paid_usd' | 'fecha_vencimiento'>, now: Date = new Date()): CuotaEstado {
  if (cuota.saldo_usd <= 0.009) return 'pagada';
  const vencimiento = cuota.fecha_vencimiento.toDate();
  if (vencimiento < now) return 'vencida';
  if (cuota.paid_usd > 0) return 'parcial';
  return 'pendiente';
}
