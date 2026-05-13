import { z } from 'zod';
import type { Timestamp } from 'firebase/firestore';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Car,
  PackageCheck,
  Users,
  Wallet,
  FileText,
  Circle,
  Handshake,
  Receipt,
  HandCoins,
} from 'lucide-react';
import type { BusinessRole } from './business-types';

// ==================== EVENT SOURCES ====================

export type CalendarEventSource = 'cita' | 'cxp' | 'cxc' | 'manual';

// ==================== MANUAL EVENT CATEGORIES ====================

export type EventoCategoria =
  | 'recordatorio'
  | 'prueba_manejo'
  | 'entrega'
  | 'reunion'
  | 'pago'
  | 'permiso_legal'
  | 'otro';

export const EVENTO_CATEGORIA_LABELS: Record<EventoCategoria, string> = {
  recordatorio: 'Recordatorio',
  prueba_manejo: 'Prueba de manejo',
  entrega: 'Entrega',
  reunion: 'Reunión interna',
  pago: 'Pago / comisión',
  permiso_legal: 'Permiso / legal',
  otro: 'Otro',
};

export type EventoVisibilidad = 'privada' | 'equipo' | 'todos';

export const EVENTO_VISIBILIDAD_LABELS: Record<EventoVisibilidad, string> = {
  privada: 'Solo yo',
  equipo: 'Mi equipo',
  todos: 'Todo el concesionario',
};

export type EventoEstado = 'pendiente' | 'completado' | 'cancelado';

export const EVENTO_ESTADO_LABELS: Record<EventoEstado, string> = {
  pendiente: 'Pendiente',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

// ==================== COLOR / ICON MAPS ====================

export type EventColorTone = {
  /** Hex used by react-big-calendar event renderer */
  bg: string;
  /** Tailwind class for chip background */
  chipBg: string;
  /** Tailwind class for chip text */
  chipText: string;
  /** Tailwind class for left border accent (mobile list) */
  borderLeft: string;
  /** Tailwind class for icon color */
  iconColor: string;
};

export const CATEGORIA_TONES: Record<EventoCategoria, EventColorTone> = {
  recordatorio: {
    bg: '#64748b',
    chipBg: 'bg-slate-100',
    chipText: 'text-slate-700',
    borderLeft: 'border-l-slate-500',
    iconColor: 'text-slate-500',
  },
  prueba_manejo: {
    bg: '#2563eb',
    chipBg: 'bg-primary/10',
    chipText: 'text-primary',
    borderLeft: 'border-l-primary',
    iconColor: 'text-primary',
  },
  entrega: {
    bg: '#10b981',
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-700',
    borderLeft: 'border-l-emerald-500',
    iconColor: 'text-emerald-600',
  },
  reunion: {
    bg: '#8b5cf6',
    chipBg: 'bg-violet-50',
    chipText: 'text-violet-700',
    borderLeft: 'border-l-violet-500',
    iconColor: 'text-violet-600',
  },
  pago: {
    bg: '#f59e0b',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
    borderLeft: 'border-l-amber-500',
    iconColor: 'text-amber-600',
  },
  permiso_legal: {
    bg: '#ef4444',
    chipBg: 'bg-red-50',
    chipText: 'text-red-700',
    borderLeft: 'border-l-red-500',
    iconColor: 'text-red-600',
  },
  otro: {
    bg: '#94a3b8',
    chipBg: 'bg-slate-50',
    chipText: 'text-slate-600',
    borderLeft: 'border-l-slate-400',
    iconColor: 'text-slate-400',
  },
};

export const CATEGORIA_ICONS: Record<EventoCategoria, LucideIcon> = {
  recordatorio: Bell,
  prueba_manejo: Car,
  entrega: PackageCheck,
  reunion: Users,
  pago: Wallet,
  permiso_legal: FileText,
  otro: Circle,
};

// Tones for derived sources
export const SOURCE_TONES: Record<Exclude<CalendarEventSource, 'manual'>, EventColorTone> = {
  cita: {
    bg: '#2563eb',
    chipBg: 'bg-primary/10',
    chipText: 'text-primary',
    borderLeft: 'border-l-primary',
    iconColor: 'text-primary',
  },
  cxp: {
    bg: '#f59e0b',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
    borderLeft: 'border-l-amber-500',
    iconColor: 'text-amber-600',
  },
  cxc: {
    bg: '#059669',
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-700',
    borderLeft: 'border-l-emerald-500',
    iconColor: 'text-emerald-600',
  },
};

export const SOURCE_ICONS: Record<Exclude<CalendarEventSource, 'manual'>, LucideIcon> = {
  cita: Handshake,
  cxp: Receipt,
  cxc: HandCoins,
};

export const SOURCE_LABELS: Record<CalendarEventSource, string> = {
  cita: 'Citas',
  cxp: 'Vencimientos',
  cxc: 'Cobros',
  manual: 'Eventos',
};

// ==================== ZOD SCHEMA ====================

export const eventoCalendarioFormSchema = z
  .object({
    titulo: z.string().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
    descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
    categoria: z.enum([
      'recordatorio',
      'prueba_manejo',
      'entrega',
      'reunion',
      'pago',
      'permiso_legal',
      'otro',
    ]),
    inicio: z.date(),
    fin: z.date(),
    todo_el_dia: z.boolean(),
    responsable_id: z.string().optional(),
    responsable_nombre: z.string().optional(),
    cliente_id: z.string().optional(),
    cliente_nombre: z.string().optional(),
    vehiculo_id: z.string().optional(),
    vehiculo_nombre: z.string().optional(),
    visibilidad: z.enum(['privada', 'equipo', 'todos']),
  })
  .refine((d) => d.fin >= d.inicio, {
    message: 'La fecha de fin debe ser posterior o igual a la de inicio',
    path: ['fin'],
  });

export type EventoCalendarioFormValues = z.infer<typeof eventoCalendarioFormSchema>;

// ==================== FIRESTORE DOCUMENT TYPE ====================

export type EventoCalendario = {
  id: string;
  titulo: string;
  descripcion?: string;
  categoria: EventoCategoria;
  inicio: Timestamp;
  fin: Timestamp;
  todo_el_dia: boolean;
  responsable_id?: string;
  responsable_nombre?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  vehiculo_id?: string;
  vehiculo_nombre?: string;
  visibilidad: EventoVisibilidad;
  estado: EventoEstado;
  creado_por_id: string;
  creado_por_nombre: string;
  creado_en: Timestamp;
  actualizado_en?: Timestamp;
};

// ==================== UNIFIED EVENT (consumed by react-big-calendar) ====================

export type UnifiedCalendarEvent = {
  id: string;
  source: CalendarEventSource;
  /** For manual events */
  categoria?: EventoCategoria;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  tone: EventColorTone;
  icon: LucideIcon;
  /** Original document data for detail dialog */
  raw: any;
  /** Optional metadata for filtering/sorting */
  meta?: {
    estado?: string;
    monto?: number;
    overdue?: boolean;
  };
};

// ==================== ROLE / PERMISSION HELPERS ====================

/** Returns the event sources a role is allowed to see in the calendar UI. */
export function getVisibleSourcesForRole(role: BusinessRole | null): CalendarEventSource[] {
  if (!role) return [];
  switch (role) {
    case 'dueno':
    case 'encargado':
      return ['cita', 'cxp', 'cxc', 'manual'];
    case 'vendedor':
      return ['cita', 'cxc', 'manual'];
    case 'secretario':
      return ['cita', 'cxp', 'cxc', 'manual'];
    case 'cajero':
      return ['cxp', 'cxc', 'manual'];
    default:
      return [];
  }
}

/** Whether the role can create any kind of manual event. */
export function canCreateEvents(role: BusinessRole | null): boolean {
  if (!role) return false;
  return role === 'dueno' || role === 'encargado' || role === 'vendedor' || role === 'secretario';
}

/**
 * Categories the role is allowed to create.
 * Granularity that the 4-level ROLE_PERMISSIONS matrix can't express.
 */
export function getCreatableCategoriesForRole(role: BusinessRole | null): EventoCategoria[] {
  if (!role) return [];
  switch (role) {
    case 'dueno':
    case 'encargado':
      return ['recordatorio', 'prueba_manejo', 'entrega', 'reunion', 'pago', 'permiso_legal', 'otro'];
    case 'vendedor':
      return ['recordatorio', 'prueba_manejo', 'entrega'];
    case 'secretario':
      return ['recordatorio', 'permiso_legal', 'reunion', 'pago'];
    case 'cajero':
    default:
      return [];
  }
}

export function canCreateCategory(role: BusinessRole | null, cat: EventoCategoria): boolean {
  return getCreatableCategoriesForRole(role).includes(cat);
}

/** Whether a manual event is visible to the given role/staff combo. */
export function canViewManualEvent(
  evento: Pick<EventoCalendario, 'visibilidad' | 'creado_por_id' | 'responsable_id' | 'categoria'>,
  role: BusinessRole | null,
  staffId: string | null
): boolean {
  if (!role) return false;
  // Cashier only sees manual events with categoria='pago' AND visibilidad='todos'
  if (role === 'cajero') {
    return evento.categoria === 'pago' && evento.visibilidad === 'todos';
  }
  // Owner / encargado see everything
  if (role === 'dueno' || role === 'encargado') return true;
  // Others: own events always visible, plus equipo/todos
  if (evento.creado_por_id === staffId || evento.responsable_id === staffId) return true;
  if (evento.visibilidad === 'todos') return true;
  if (evento.visibilidad === 'equipo') return true; // 'equipo' = same dealership; we already scope by concesionarioId
  return false;
}

/** Whether the role/staff can edit a given manual event. */
export function canEditManualEvent(
  evento: Pick<EventoCalendario, 'creado_por_id'>,
  role: BusinessRole | null,
  staffId: string | null
): boolean {
  if (!role) return false;
  if (role === 'dueno' || role === 'encargado') return true;
  return evento.creado_por_id === staffId;
}
