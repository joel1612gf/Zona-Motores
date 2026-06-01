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
 * Create a blank tenant (concesionario) from /admin/dealerships. The admin only
 * sets the slug (URL + doc ID), the monthly fee and the billing day; the client
 * configures everything else through the onboarding wizard.
 */
export const createDealershipSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Mínimo 3 caracteres')
    .max(40, 'Máximo 40 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  precio_mensual_usd: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .min(0, 'No puede ser negativo')
    .max(100000, 'Valor demasiado alto'),
  dia_cobro_mensual: z.coerce
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser un día entero')
    .min(1, 'El día debe estar entre 1 y 31')
    .max(31, 'El día debe estar entre 1 y 31'),
});

export type CreateDealershipFormValues = z.infer<typeof createDealershipSchema>;

/**
 * Hard-confirmation guard for destructive tenant deletion: the user must type
 * the exact word ELIMINAR before deleteTenant can be invoked.
 */
export const deleteConfirmSchema = z.object({
  confirmText: z.literal('ELIMINAR', {
    errorMap: () => ({ message: 'Escriba ELIMINAR para confirmar' }),
  }),
});
