import { z } from 'zod';

export const ISLR_CONCEPTS = [
  { label: 'Servicios (2%)', value: 0.02, code: 'SERV' },
  { label: 'Honorarios PN (3%)', value: 0.03, code: 'HPN' },
  { label: 'Honorarios PJ (5%)', value: 0.05, code: 'HPJ' },
  { label: 'Fletes (3%)', value: 0.03, code: 'FLET' },
  { label: 'Publicidad (5%)', value: 0.05, code: 'PUBL' },
] as const;

export const expenseSchema = z.object({
  provider_id: z.string().min(1, 'Debe seleccionar un proveedor'),
  provider_name: z.string().optional(),
  invoice_number: z.string().min(1, 'Número de factura requerido'),
  control_number: z.string().min(1, 'Número de control requerido'),
  date: z.string().min(1, 'Fecha requerida'),
  currency: z.enum(['USD', 'VES']),
  base_amount: z.number().min(0),
  exempt_amount: z.number().min(0),
  iva_amount: z.number().min(0),
  islr_concept: z.string().optional(),
  islr_percentage: z.number().optional(),
  retention_iva_rate: z.enum(['0', '75', '100']).default('75'),
  description: z.string().min(5, 'Descripción demasiado corta'),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

export const fiscalNoteSchema = z.object({
  invoice_id: z.string().min(1, 'Debe vincular una factura'),
  invoice_number: z.string(),
  type: z.enum(['DEBIT', 'CREDIT']),
  currency: z.enum(['USD', 'VES']).default('VES'),
  exchange_rate: z.number().min(1, 'La tasa debe ser mayor a 1'),
  reason: z.string().min(5, 'Indique el motivo de la nota'),
  taxable_amount: z.number().min(0),
  exempt_amount: z.number().min(0),
  iva_amount: z.number().min(0),
  igtf_amount: z.number().default(0),
}).refine(data => (data.taxable_amount + data.exempt_amount) > 0, {
  message: "El monto gravable o exento debe ser mayor a 0",
  path: ["taxable_amount"]
});

export type FiscalNoteFormValues = z.infer<typeof fiscalNoteSchema>;
