import { z } from 'zod';

// ==================== BANK ACCOUNT SCHEMA ====================

const bankEntryMethodSchema = z.enum([
  'pago_movil',
  'transferencia',
  'punto_de_venta',
  'efectivo_fisico',
  'zelle',
  'crypto',
]);

const bankExitMethodSchema = z.enum([
  'pago_movil',
  'transferencia',
  'efectivo_fisico',
  'zelle',
  'crypto',
]);

export const bankAccountSchema = z.object({
  tipo: z.enum(['banco_nacional', 'efectivo_bs', 'efectivo_usd', 'zelle', 'crypto', 'otro']),
  nombre: z.string().min(1, 'El nombre es requerido').max(60),
  banco: z.string().max(60).optional(),
  numero_cuenta: z.string().max(30).optional(),
  titular: z.string().max(100).optional(),
  cedula_rif_titular: z.string().max(20).optional(),
  telefono_pago_movil: z.string().max(15).optional(),
  moneda: z.enum(['USD', 'VES']),
  saldo_inicial: z.number().min(0, 'El saldo inicial no puede ser negativo'),
  saldo_actual: z.number(),
  metodos_entrada: z.record(bankEntryMethodSchema, z.boolean()).optional().default({}),
  metodos_salida: z.record(bankExitMethodSchema, z.boolean()).optional().default({}),
  es_divisa: z.boolean().default(false),
  activa: z.boolean().default(true),
  orden: z.number().int().min(0).default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  notas: z.string().max(300).optional(),
});

export type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

// ==================== BALANCE ADJUSTMENT SCHEMA ====================

export const balanceAdjustmentSchema = z.object({
  monto_ajuste: z
    .number()
    .refine((v) => v !== 0, { message: 'El monto de ajuste no puede ser cero' }),
  concepto: z.string().min(3, 'Indique el motivo del ajuste').max(200),
  referencia: z.string().max(60).optional(),
});

export type BalanceAdjustmentFormValues = z.infer<typeof balanceAdjustmentSchema>;

// ==================== BANK TRANSACTION SCHEMA ====================

export const bankTransactionSchema = z.object({
  cuenta_id: z.string().min(1),
  tipo: z.enum([
    'ingreso_venta',
    'egreso_compra',
    'ajuste_manual',
    'ingreso_manual',
    'egreso_manual',
  ]),
  flujo: z.enum(['entrada', 'salida']),
  monto: z.number().positive('El monto debe ser positivo'),
  metodo_pago: z
    .union([bankEntryMethodSchema, bankExitMethodSchema])
    .optional(),
  concepto: z.string().min(1).max(300),
  referencia: z.string().max(60).optional(),
  venta_id: z.string().optional(),
  compra_id: z.string().optional(),
  registrado_por_id: z.string().min(1),
  registrado_por_nombre: z.string().min(1),
  saldo_anterior: z.number(),
  saldo_posterior: z.number(),
});

export type BankTransactionValues = z.infer<typeof bankTransactionSchema>;
