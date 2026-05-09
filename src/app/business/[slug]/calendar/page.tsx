'use client';

import { useState, useMemo } from 'react';
import { type View, Views } from 'react-big-calendar';
import { useBusinessAuth } from '@/context/business-auth-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  CalendarDays,
  Plus,
  RefreshCw,
  Lock,
  CalendarOff,
} from 'lucide-react';
import { useCalendarEvents } from '@/components/business/calendar/use-calendar-events';
import { CalendarHeaderStats } from '@/components/business/calendar/calendar-header-stats';
import { CalendarTypeFilters } from '@/components/business/calendar/calendar-type-filters';
import { CalendarMainGrid } from '@/components/business/calendar/calendar-main-grid';
import { CalendarDayPanel } from '@/components/business/calendar/calendar-day-panel';
import { CalendarMobileList } from '@/components/business/calendar/calendar-mobile-list';
import { CalendarEventDetailDialog } from '@/components/business/calendar/calendar-event-detail-dialog';
import { CalendarEventFormDialog } from '@/components/business/calendar/calendar-event-form-dialog';
import { CalendarEmptyState } from '@/components/business/calendar/calendar-empty-state';
import {
  canCreateEvents,
  type CalendarEventSource,
  type UnifiedCalendarEvent,
  type EventoCalendario,
} from '@/lib/calendar-schemas';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BusinessCalendarPage() {
  const { concesionario, currentRole, hasPermission, isLoading: authLoading } = useBusinessAuth();
  const permission = hasPermission('calendar');

  // Filters
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventSource>>(
    () => new Set(['cita', 'cxp', 'manual'])
  );

  const { events, visibleSources, isLoading } = useCalendarEvents(activeFilters);

  // Calendar state
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Dialogs
  const [detailEvent, setDetailEvent] = useState<UnifiedCalendarEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventoCalendario | null>(null);
  const [initialDate, setInitialDate] = useState<Date | undefined>(undefined);

  const canCreate = canCreateEvents(currentRole);

  const openCreate = (atDate?: Date) => {
    setEditingEvent(null);
    setInitialDate(atDate);
    setFormOpen(true);
  };

  const openEdit = (evt: UnifiedCalendarEvent) => {
    if (evt.source !== 'manual') return;
    setEditingEvent(evt.raw as EventoCalendario);
    setInitialDate(undefined);
    setFormOpen(true);
  };

  const handleSelectEvent = (evt: UnifiedCalendarEvent) => {
    setDetailEvent(evt);
    setDetailOpen(true);
  };

  const handleSelectSlot = ({ start }: { start: Date; end: Date }) => {
    setSelectedDay(start);
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches) {
      // xl: side panel ya muestra
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setMobileSheetOpen(true);
    }
  };

  const toggleFilter = (s: CalendarEventSource) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  // ── Access guard
  if (authLoading) {
    return (
      <div className="space-y-8 pb-12">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-[650px] rounded-[2rem]" />
      </div>
    );
  }

  if (permission === false) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 animate-in fade-in duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-slate-500/20 blur-2xl rounded-full" />
          <div className="relative p-8 bg-white/60 backdrop-blur-xl border border-white/40 rounded-[2rem] shadow-xl">
            <Lock className="h-14 w-14 text-slate-400 mx-auto" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold font-headline">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Tu rol no tiene permisos para ver el calendario. Habla con el dueño del concesionario.
          </p>
        </div>
      </div>
    );
  }

  const dayEventsForSelected = events.filter((e) => isSameDay(e.start, selectedDay));

  return (
    <div className="space-y-8 pb-12 relative animate-in fade-in duration-500">
      {/* Blob */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header §3 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <CalendarDays className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Calendario</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Agenda unificada de citas, vencimientos y recordatorios de{' '}
            <span className="text-foreground font-bold">{concesionario?.nombre_empresa}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.location.reload()}
            className="rounded-2xl h-12 w-12 border-primary/20 hover:bg-primary/5"
            aria-label="Refrescar"
          >
            <RefreshCw className="h-5 w-5 text-primary" />
          </Button>
          {canCreate && (
            <Button
              onClick={() => openCreate()}
              className="rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 gap-2 font-bold flex-1 md:flex-none"
            >
              <Plus className="h-5 w-5" /> Nuevo evento
            </Button>
          )}
        </div>
      </div>

      {/* Stats chips */}
      <div className="relative z-10">
        {isLoading ? (
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-44 rounded-2xl" />
            ))}
          </div>
        ) : (
          <CalendarHeaderStats events={events} />
        )}
      </div>

      {/* Filters */}
      <div className="relative z-10">
        <CalendarTypeFilters
          visibleSources={visibleSources}
          active={activeFilters}
          onToggle={toggleFilter}
        />
      </div>

      {/* Desktop: calendar + side panel */}
      <div className="hidden md:grid xl:grid-cols-3 gap-6 relative z-10">
        <div className="xl:col-span-2">
          {isLoading ? (
            <Skeleton className="h-[700px] rounded-[2rem]" />
          ) : (
            <CalendarMainGrid
              events={events}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
            />
          )}
        </div>
        <div className="hidden xl:block">
          {isLoading ? (
            <Skeleton className="h-[700px] rounded-[1.5rem]" />
          ) : (
            <CalendarDayPanel
              date={selectedDay}
              events={events}
              onSelectEvent={handleSelectEvent}
              canCreate={canCreate}
              onCreate={() => openCreate(selectedDay)}
            />
          )}
        </div>
      </div>

      {/* Mobile vista lista */}
      <div className="md:hidden relative z-10">
        {isLoading ? (
          <Skeleton className="h-[500px] rounded-[2rem]" />
        ) : (
          <CalendarMobileList
            events={events}
            onSelectEvent={handleSelectEvent}
            canCreate={canCreate}
            onCreate={() => openCreate()}
          />
        )}
      </div>

      {/* Sheet lateral para tablet/desktop pequeño (md - lg) */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="right" className="w-[90vw] sm:w-[420px] sm:max-w-[420px] p-0 bg-card overflow-y-auto">
          <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
            <SheetTitle className="font-headline text-xl tracking-tight capitalize">
              {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
            </SheetTitle>
            <SheetDescription>
              {dayEventsForSelected.length} evento{dayEventsForSelected.length === 1 ? '' : 's'}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            {dayEventsForSelected.length === 0 ? (
              <CalendarEmptyState
                canCreate={canCreate}
                onCreate={() => {
                  setMobileSheetOpen(false);
                  openCreate(selectedDay);
                }}
              />
            ) : (
              <div className="rounded-[1.5rem] border ring-1 ring-border overflow-hidden divide-y bg-background/60">
                {dayEventsForSelected.map((evt) => {
                  const Icon = evt.icon;
                  return (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => {
                        setMobileSheetOpen(false);
                        handleSelectEvent(evt);
                      }}
                      className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${evt.tone.chipBg}`}>
                        <Icon className={`h-4 w-4 ${evt.tone.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{evt.title}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                          {evt.allDay ? 'Todo el día' : format(evt.start, 'HH:mm')}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <CalendarEventDetailDialog
        event={detailEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
      />
      <CalendarEventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editingEvent}
        initialDate={initialDate}
      />
    </div>
  );
}
