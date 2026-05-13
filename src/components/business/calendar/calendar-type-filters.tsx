'use client';

import { cn } from '@/lib/utils';
import { Handshake, Receipt, Bell, HandCoins } from 'lucide-react';
import type { CalendarEventSource } from '@/lib/calendar-schemas';

type CalendarTypeFiltersProps = {
  visibleSources: CalendarEventSource[];
  active: Set<CalendarEventSource>;
  onToggle: (source: CalendarEventSource) => void;
};

const FILTER_DEFS: Record<CalendarEventSource, { label: string; icon: typeof Handshake; activeClass: string; inactiveClass: string }> = {
  cita: {
    label: 'Citas',
    icon: Handshake,
    activeClass: 'bg-primary text-primary-foreground border-primary shadow-sm',
    inactiveClass: 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10',
  },
  cxp: {
    label: 'Vencimientos CxP',
    icon: Receipt,
    activeClass: 'bg-amber-500 text-white border-amber-500 shadow-sm',
    inactiveClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  },
  cxc: {
    label: 'Cobros CxC',
    icon: HandCoins,
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    inactiveClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  },
  manual: {
    label: 'Eventos manuales',
    icon: Bell,
    activeClass: 'bg-slate-700 text-white border-slate-700 shadow-sm',
    inactiveClass: 'bg-muted/40 text-muted-foreground border-border hover:bg-muted',
  },
};

export function CalendarTypeFilters({ visibleSources, active, onToggle }: CalendarTypeFiltersProps) {
  if (visibleSources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground self-center mr-1">
        Filtrar
      </span>
      {visibleSources.map((src) => {
        const def = FILTER_DEFS[src];
        const Icon = def.icon;
        const isActive = active.has(src);
        return (
          <button
            key={src}
            type="button"
            onClick={() => onToggle(src)}
            className={cn(
              'rounded-xl h-10 px-4 inline-flex items-center gap-2 border text-xs font-bold transition-all',
              isActive ? def.activeClass : def.inactiveClass
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {def.label}
          </button>
        );
      })}
    </div>
  );
}
