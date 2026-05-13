'use client';

import { useMemo } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import {
  getVisibleSourcesForRole,
  canViewManualEvent,
  CATEGORIA_TONES,
  CATEGORIA_ICONS,
  SOURCE_TONES,
  SOURCE_ICONS,
  type UnifiedCalendarEvent,
  type CalendarEventSource,
  type EventoCalendario,
} from '@/lib/calendar-schemas';
import type { Compra } from '@/lib/business-types';

type Cita = {
  id: string;
  fecha_cita?: any;
  vehicle_id?: string;
  vehicle_nombre?: string;
  publicador_nombre?: string;
  publicador_telefono?: string;
  vendedor_nombre?: string;
  estado?: 'agendada' | 'completada' | 'cancelada';
};

type UseCalendarEventsResult = {
  events: UnifiedCalendarEvent[];
  visibleSources: CalendarEventSource[];
  isLoading: boolean;
};

/**
 * Realtime fetch + normalization of calendar events from 3 sources:
 * - citas_consignacion
 * - compras (CxP) with fecha_vencimiento
 * - eventos_calendario (manual)
 *
 * Filters by role visibility and returns a unified array.
 */
export function useCalendarEvents(activeFilters?: Set<CalendarEventSource>): UseCalendarEventsResult {
  const { concesionario, staff, currentRole } = useBusinessAuth();
  const firestore = useFirestore();

  const visibleSources = useMemo(() => getVisibleSourcesForRole(currentRole), [currentRole]);

  const showCitas = visibleSources.includes('cita') && (activeFilters?.has('cita') ?? true);
  const showCxp = visibleSources.includes('cxp') && (activeFilters?.has('cxp') ?? true);
  const showCxc = visibleSources.includes('cxc') && (activeFilters?.has('cxc') ?? true);
  const showManual = visibleSources.includes('manual') && (activeFilters?.has('manual') ?? true);

  // ── Citas
  const citasQuery = useMemoFirebase(() => {
    if (!concesionario?.id || !showCitas) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'citas_consignacion'),
      orderBy('fecha_cita', 'asc')
    );
  }, [concesionario?.id, firestore, showCitas]);

  // ── Compras (CxP)
  const comprasQuery = useMemoFirebase(() => {
    if (!concesionario?.id || !showCxp) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'compras'),
      where('estado', '==', 'pendiente')
    );
  }, [concesionario?.id, firestore, showCxp]);

  // ── Eventos en la colección eventos_calendario (manual + cxc share the same store)
  const eventosQuery = useMemoFirebase(() => {
    if (!concesionario?.id || (!showManual && !showCxc)) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'eventos_calendario'),
      where('estado', '!=', 'cancelado')
    );
  }, [concesionario?.id, firestore, showManual, showCxc]);

  const { data: citas, isLoading: citasLoading } = useCollection<Cita>(citasQuery);
  const { data: compras, isLoading: comprasLoading } = useCollection<Compra>(comprasQuery);
  const { data: eventos, isLoading: eventosLoading } = useCollection<EventoCalendario>(eventosQuery);

  const events = useMemo<UnifiedCalendarEvent[]>(() => {
    const out: UnifiedCalendarEvent[] = [];
    const now = new Date();

    if (showCitas && citas) {
      citas.forEach((c) => {
        const start = c.fecha_cita?.toDate?.();
        if (!start) return;
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        out.push({
          id: `cita-${c.id}`,
          source: 'cita',
          title: `${c.vehicle_nombre || 'Vehículo'} · ${c.publicador_nombre || 'Cliente'}`,
          start,
          end,
          allDay: false,
          tone: SOURCE_TONES.cita,
          icon: SOURCE_ICONS.cita,
          raw: c,
          meta: { estado: c.estado },
        });
      });
    }

    if (showCxp && compras) {
      compras.forEach((c) => {
        const start = c.fecha_vencimiento?.toDate?.();
        if (!start) return;
        const end = new Date(start);
        const overdue = start.getTime() < now.getTime();
        out.push({
          id: `cxp-${c.id}`,
          source: 'cxp',
          title: `Pago ${c.proveedor_nombre || 'Proveedor'}`,
          start,
          end,
          allDay: true,
          tone: overdue
            ? {
                ...SOURCE_TONES.cxp,
                bg: '#ef4444',
                chipBg: 'bg-red-50',
                chipText: 'text-red-700',
                borderLeft: 'border-l-red-500',
                iconColor: 'text-red-600',
              }
            : SOURCE_TONES.cxp,
          icon: SOURCE_ICONS.cxp,
          raw: c,
          meta: { monto: c.total_usd ?? c.saldo_pendiente, overdue },
        });
      });
    }

    if (eventos) {
      eventos.forEach((e) => {
        const isCxc = (e as any).source === 'cxc';
        // Filter: CXC entries follow showCxc; manual entries follow showManual + role view.
        if (isCxc) {
          if (!showCxc) return;
        } else {
          if (!showManual) return;
          if (!canViewManualEvent(e, currentRole, staff?.id ?? null)) return;
        }
        const start = e.inicio?.toDate?.();
        const end = e.fin?.toDate?.();
        if (!start || !end) return;
        if (isCxc) {
          const overdue = start.getTime() < now.getTime() && (e as any).estado !== 'completado';
          out.push({
            id: `cxc-${e.id}`,
            source: 'cxc',
            title: e.titulo,
            start,
            end,
            allDay: e.todo_el_dia,
            tone: overdue
              ? {
                  ...SOURCE_TONES.cxc,
                  bg: '#ef4444',
                  chipBg: 'bg-red-50',
                  chipText: 'text-red-700',
                  borderLeft: 'border-l-red-500',
                  iconColor: 'text-red-600',
                }
              : SOURCE_TONES.cxc,
            icon: SOURCE_ICONS.cxc,
            raw: e,
            meta: { estado: e.estado, overdue },
          });
        } else {
          out.push({
            id: `manual-${e.id}`,
            source: 'manual',
            categoria: e.categoria,
            title: e.titulo,
            start,
            end,
            allDay: e.todo_el_dia,
            tone: CATEGORIA_TONES[e.categoria],
            icon: CATEGORIA_ICONS[e.categoria],
            raw: e,
            meta: { estado: e.estado },
          });
        }
      });
    }

    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [citas, compras, eventos, showCitas, showCxp, showCxc, showManual, currentRole, staff?.id]);

  const isLoading = (showCitas && citasLoading) || (showCxp && comprasLoading) || ((showManual || showCxc) && eventosLoading);

  return { events, visibleSources, isLoading };
}
