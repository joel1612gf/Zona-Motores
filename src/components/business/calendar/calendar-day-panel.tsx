'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEmptyState } from './calendar-empty-state';
import type { UnifiedCalendarEvent } from '@/lib/calendar-schemas';

type CalendarDayPanelProps = {
  date: Date;
  events: UnifiedCalendarEvent[];
  onSelectEvent: (event: UnifiedCalendarEvent) => void;
  canCreate?: boolean;
  onCreate?: () => void;
};

export function CalendarDayPanel({ date, events, onSelectEvent, canCreate, onCreate }: CalendarDayPanelProps) {
  const dayEvents = events.filter((e) => isSameDay(e.start, date));

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[1.5rem] sticky top-6">
      <CardHeader className="bg-muted/30 border-b pb-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Día seleccionado
        </p>
        <p className="font-headline text-xl tracking-tight capitalize">
          {format(date, "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <p className="text-xs text-muted-foreground font-medium">
          {dayEvents.length} evento{dayEvents.length === 1 ? '' : 's'}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {dayEvents.length === 0 ? (
          <div className="p-6">
            <CalendarEmptyState canCreate={canCreate} onCreate={onCreate} />
          </div>
        ) : (
          <div className="divide-y max-h-[520px] overflow-y-auto">
            {dayEvents.map((evt) => {
              const Icon = evt.icon;
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => onSelectEvent(evt)}
                  className="w-full flex items-center gap-3 p-4 px-5 hover:bg-muted/30 transition-all group text-left"
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 border-l-4',
                      evt.tone.chipBg,
                      evt.tone.borderLeft
                    )}
                  >
                    <Icon className={cn('h-4 w-4', evt.tone.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{evt.title}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                      {evt.allDay
                        ? 'Todo el día'
                        : format(evt.start, "HH:mm", { locale: es })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
