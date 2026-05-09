'use client';

import { useMemo } from 'react';
import { isSameDay, isWithinInterval, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { Calendar as CalIcon, AlertTriangle, Clock, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UnifiedCalendarEvent } from '@/lib/calendar-schemas';

type CalendarHeaderStatsProps = {
  events: UnifiedCalendarEvent[];
};

export function CalendarHeaderStats({ events }: CalendarHeaderStatsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const in30 = addDays(now, 30);

    let hoy = 0;
    let semana = 0;
    let vencidos = 0;
    let proximos30 = 0;

    for (const e of events) {
      if (isSameDay(e.start, now)) hoy++;
      if (isWithinInterval(e.start, { start: weekStart, end: weekEnd })) semana++;
      if (e.meta?.overdue) vencidos++;
      if (e.start.getTime() >= now.getTime() && e.start.getTime() <= in30.getTime()) proximos30++;
    }

    return { hoy, semana, vencidos, proximos30 };
  }, [events]);

  const items = [
    { label: 'Hoy', value: stats.hoy, icon: CalIcon, tone: 'primary' as const },
    { label: 'Esta semana', value: stats.semana, icon: CalendarRange, tone: 'neutral' as const },
    { label: 'Vencidos', value: stats.vencidos, icon: AlertTriangle, tone: stats.vencidos > 0 ? 'danger' as const : 'neutral' as const },
    { label: 'Próximos 30 días', value: stats.proximos30, icon: Clock, tone: 'neutral' as const },
  ];

  return (
    <div className="flex flex-wrap gap-3 overflow-x-auto pb-1">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className={cn(
              'rounded-2xl h-14 px-5 flex items-center gap-3 border ring-1 shrink-0',
              it.tone === 'primary'
                ? 'bg-primary text-primary-foreground border-primary ring-primary/40 shadow-lg shadow-primary/20'
                : it.tone === 'danger'
                ? 'bg-red-50 text-red-700 border-red-200 ring-red-200/40'
                : 'bg-card text-foreground border-border ring-border'
            )}
          >
            <div
              className={cn(
                'p-2 rounded-xl',
                it.tone === 'primary'
                  ? 'bg-white/15'
                  : it.tone === 'danger'
                  ? 'bg-red-100'
                  : 'bg-primary/5'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4',
                  it.tone === 'primary'
                    ? 'text-primary-foreground'
                    : it.tone === 'danger'
                    ? 'text-red-600'
                    : 'text-primary'
                )}
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span
                className={cn(
                  'text-[10px] font-black uppercase tracking-widest',
                  it.tone === 'primary'
                    ? 'text-primary-foreground/70'
                    : it.tone === 'danger'
                    ? 'text-red-700/70'
                    : 'text-muted-foreground'
                )}
              >
                {it.label}
              </span>
              <span className="font-headline text-lg font-bold tabular-nums">{it.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
