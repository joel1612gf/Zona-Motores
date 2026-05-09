'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, ChevronRight } from 'lucide-react';
import {
  format,
  isSameDay,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CalendarEmptyState } from './calendar-empty-state';
import type { UnifiedCalendarEvent } from '@/lib/calendar-schemas';

type CalendarMobileListProps = {
  events: UnifiedCalendarEvent[];
  onSelectEvent: (event: UnifiedCalendarEvent) => void;
  canCreate?: boolean;
  onCreate?: () => void;
};

type Range = 'hoy' | 'semana' | 'mes';

export function CalendarMobileList({ events, onSelectEvent, canCreate, onCreate }: CalendarMobileListProps) {
  return (
    <>
      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-muted/30 border-b pb-5">
          <p className="font-headline text-xl tracking-tight">Agenda</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Eventos en lista
          </p>
        </CardHeader>
        <CardContent className="p-4">
          <Tabs defaultValue="hoy">
            <TabsList className="bg-slate-100 p-1 rounded-2xl h-12 border border-slate-200/60 shadow-inner w-full">
              {(['hoy', 'semana', 'mes'] as Range[]).map((r) => (
                <TabsTrigger
                  key={r}
                  value={r}
                  className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold capitalize"
                >
                  {r}
                </TabsTrigger>
              ))}
            </TabsList>
            {(['hoy', 'semana', 'mes'] as Range[]).map((r) => (
              <TabsContent key={r} value={r} className="mt-4 focus-visible:ring-0">
                <RangeList range={r} events={events} onSelectEvent={onSelectEvent} canCreate={canCreate} onCreate={onCreate} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* FAB */}
      {canCreate && onCreate && (
        <button
          type="button"
          onClick={onCreate}
          aria-label="Nuevo evento"
          className="fixed bottom-20 right-4 rounded-full h-14 w-14 bg-primary text-primary-foreground shadow-xl shadow-primary/25 flex items-center justify-center z-40 hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </>
  );
}

function RangeList({
  range,
  events,
  onSelectEvent,
  canCreate,
  onCreate,
}: {
  range: Range;
  events: UnifiedCalendarEvent[];
  onSelectEvent: (event: UnifiedCalendarEvent) => void;
  canCreate?: boolean;
  onCreate?: () => void;
}) {
  const filtered = useMemo(() => {
    const now = new Date();
    if (range === 'hoy') return events.filter((e) => isSameDay(e.start, now));
    if (range === 'semana') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return events.filter((e) => isWithinInterval(e.start, { start, end }));
    }
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    return events.filter((e) => isWithinInterval(e.start, { start: mStart, end: mEnd }));
  }, [range, events]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>();
    filtered.forEach((e) => {
      const key = format(e.start, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (filtered.length === 0) {
    return <CalendarEmptyState canCreate={canCreate} onCreate={onCreate} description="No hay eventos en este rango." />;
  }

  return (
    <div className="space-y-5">
      {grouped.map(([dayKey, items]) => {
        const date = new Date(dayKey + 'T00:00:00');
        return (
          <div key={dayKey}>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 capitalize">
              {format(date, "EEEE d 'de' MMMM", { locale: es })}
            </p>
            <div className="rounded-[1.5rem] border ring-1 ring-border bg-background/60 backdrop-blur-sm overflow-hidden divide-y">
              {items.map((evt) => {
                const Icon = evt.icon;
                return (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => onSelectEvent(evt)}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 px-5 hover:bg-muted/30 transition-all text-left border-l-4',
                      evt.tone.borderLeft
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        evt.tone.chipBg
                      )}
                    >
                      <Icon className={cn('h-4 w-4', evt.tone.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{evt.title}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                        {evt.allDay ? 'Todo el día' : format(evt.start, 'HH:mm')}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
