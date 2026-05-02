import { z } from 'zod';

/**
 * Validation schema for the CXP payment execution form.
 * Account selection and payment method are handled by the PaymentEngine component.
 */
export const payablePaymentSchema = z.object({
  monto_pago: z
    .number({ invalid_type_error: 'Ingrese un monto válido' })
    .min(0.01, 'El monto debe ser mayor a 0'),
  referencia: z.string().optional(),
});

export type PayablePaymentFormValues = z.infer<typeof payablePaymentSchema>;

/**
 * Normalized row shape used to unify debt from different Firestore collections
 * into a single table in the CXP dashboard.
 */
export type PayableRow = {
  id: string;
  origen: 'compra_factura' | 'compra_nota_entrega' | 'consignacion' | 'nota_debito' | 'gasto';
  // Source document IDs for atomic transaction writes
  compra_id?: string;
  consignacion_id?: string;
  nota_id?: string;
  gasto_id?: string;
  // Display info
  proveedor_nombre: string;
  descripcion: string;
  // Fiscal gate — controls IGTF calculation in PayablePaymentDialog
  is_fiscal: boolean;
  // Amounts (USD)
  monto_original: number;
  saldo_pendiente: number;
  moneda_original?: 'usd' | 'bs';
  tasa_cambio?: number;
  // Dates
  fecha_emision: Date;
  fecha_vencimiento?: Date;
  // Status
  estado: 'pendiente' | 'parcial' | 'pagada';
};
