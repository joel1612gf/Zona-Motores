import { z } from 'zod';

/**
 * Invite a new platform administrator (super_admin). The owner CRUD on /admin/team
 * uses this. New invitees are created as 'moderator' by default; only an existing
 * owner can promote to 'owner'.
 */
export const inviteAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
  role: z.enum(['owner', 'moderator']).default('moderator'),
});

export type InviteAdminFormValues = z.infer<typeof inviteAdminSchema>;

/**
 * Edit the custom B2B monthly fee charged to a dealership (tenant). Drives the MRR.
 */
export const editPriceSchema = z.object({
  precio_mensual_usd: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .min(0, 'No puede ser negativo')
    .max(100000, 'Valor demasiado alto')
    .refine((v) => Number.isFinite(v), 'Valor inválido'),
});

export type EditPriceFormValues = z.infer<typeof editPriceSchema>;

/**
 * Hard-confirmation guard for destructive tenant deletion: the user must type
 * the exact word ELIMINAR before deleteTenant can be invoked.
 */
export const deleteConfirmSchema = z.object({
  confirmText: z.literal('ELIMINAR', {
    errorMap: () => ({ message: 'Escriba ELIMINAR para confirmar' }),
  }),
});
