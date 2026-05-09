'use client';

import { Calendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarEventCard } from './calendar-event-card';
import { CalendarToolbar } from './calendar-toolbar';
import type { UnifiedCalendarEvent } from '@/lib/calendar-schemas';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { es },
});

const messages = {
  allDay: 'Todo el día',
  previous: 'Anterior',
  next: 'Siguiente',
  today: 'Hoy',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'No hay eventos en este rango.',
  showMore: (total: number) => `+ ${total} más`,
};

type CalendarMainGridProps = {
  events: UnifiedCalendarEvent[];
  onSelectEvent: (event: UnifiedCalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  view: View;
  onView: (view: View) => void;
  date: Date;
  onNavigate: (date: Date) => void;
};

export function CalendarMainGrid({
  events,
  onSelectEvent,
  onSelectSlot,
  view,
  onView,
  date,
  onNavigate,
}: CalendarMainGridProps) {
  const eventStyleGetter = (event: UnifiedCalendarEvent) => ({
    style: {
      backgroundColor: 'transparent',
      border: 'none',
      padding: 0,
      margin: '1px 2px',
    },
  });

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[2rem]">
      <CardContent className="p-4 sm:p-6">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .zm-calendar .rbc-calendar { font-family: inherit; background: transparent; }
              .zm-calendar .rbc-toolbar { display: none !important; }
              .zm-calendar .rbc-month-view,
              .zm-calendar .rbc-time-view,
              .zm-calendar .rbc-agenda-view { border: 1px solid hsl(var(--border)); border-radius: 1rem; overflow: hidden; }
              .zm-calendar .rbc-header {
                font-family: var(--font-headline);
                font-size: 10px; font-weight: 800; letter-spacing: 0.1em;
                text-transform: uppercase; color: hsl(var(--muted-foreground));
                padding: 12px 4px; border-color: hsl(var(--border));
                background: hsl(var(--muted) / 0.3);
              }
              .zm-calendar .rbc-month-row, .zm-calendar .rbc-day-bg { border-color: hsl(var(--border)); }
              .zm-calendar .rbc-off-range-bg { background-color: hsl(var(--muted) / 0.2); }
              .zm-calendar .rbc-today { background-color: hsl(var(--primary) / 0.05); }
              .zm-calendar .rbc-date-cell {
                font-size: 12px; font-weight: 600; padding: 6px 8px;
                color: hsl(var(--foreground));
              }
              .zm-calendar .rbc-date-cell.rbc-now { color: hsl(var(--primary)); font-weight: 800; }
              .zm-calendar .rbc-event {
                background: transparent !important;
                border: none !important;
                padding: 0 !important;
                box-shadow: none !important;
              }
              .zm-calendar .rbc-event-content { padding: 0; }
              .zm-calendar .rbc-show-more {
                font-size: 10px; font-weight: 800;
                color: hsl(var(--primary)); padding: 2px 6px;
                background: hsl(var(--primary) / 0.06);
                border-radius: 8px; margin-top: 2px;
              }
              .zm-calendar .rbc-time-content,
              .zm-calendar .rbc-timeslot-group,
              .zm-calendar .rbc-day-slot .rbc-time-slot { border-color: hsl(var(--border)); }
              .zm-calendar .rbc-time-header-content { border-color: hsl(var(--border)); }
              .zm-calendar .rbc-current-time-indicator { background-color: hsl(var(--primary)); height: 2px; }
              .zm-calendar .rbc-agenda-view table.rbc-agenda-table { border-color: hsl(var(--border)); }
              .zm-calendar .rbc-agenda-view table.rbc-agenda-table tbody > tr > td,
              .zm-calendar .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
                border-color: hsl(var(--border));
                font-size: 12px;
              }
              .zm-calendar .rbc-agenda-date-cell, .zm-calendar .rbc-agenda-time-cell {
                font-weight: 700; color: hsl(var(--foreground));
              }
            `,
          }}
        />

        <CalendarToolbar
          label={format(date, 'MMMM yyyy', { locale: es })}
          onNavigate={(action: any) => {
            if (action === 'TODAY') return onNavigate(new Date());
            if (action === 'PREV') {
              const next = new Date(date);
              if (view === Views.MONTH) next.setMonth(next.getMonth() - 1);
              else if (view === Views.WEEK) next.setDate(next.getDate() - 7);
              else next.setDate(next.getDate() - 1);
              return onNavigate(next);
            }
            if (action === 'NEXT') {
              const next = new Date(date);
              if (view === Views.MONTH) next.setMonth(next.getMonth() + 1);
              else if (view === Views.WEEK) next.setDate(next.getDate() + 7);
              else next.setDate(next.getDate() + 1);
              return onNavigate(next);
            }
          }}
          onView={onView}
          view={view}
          views={['month', 'week', 'day'] as any}
          date={date}
          localizer={localizer as any}
        />

        <div className="zm-calendar h-[600px] sm:h-[700px]">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            allDayAccessor="allDay"
            style={{ height: '100%' }}
            messages={messages}
            culture="es"
            view={view}
            onView={onView}
            date={date}
            onNavigate={onNavigate}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            eventPropGetter={eventStyleGetter}
            components={{
              event: CalendarEventCard as any,
              toolbar: () => null, // we render our own above
            }}
            popup
            selectable
            onSelectEvent={(e: any) => onSelectEvent(e as UnifiedCalendarEvent)}
            onSelectSlot={(slotInfo) => onSelectSlot?.({ start: slotInfo.start as Date, end: slotInfo.end as Date })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
