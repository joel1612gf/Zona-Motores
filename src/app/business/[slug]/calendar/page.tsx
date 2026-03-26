'use client';

import { useState, useEffect } from 'react';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore } from '@/firebase';
import { collection, query, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const locales = {
  'es': es,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

interface CitaEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource?: any;
}

export default function BusinessCalendarPage() {
  const { concesionario, isLoading: authLoading } = useBusinessAuth();
  const firestore = useFirestore();
  
  const [events, setEvents] = useState<CitaEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedEvent, setSelectedEvent] = useState<CitaEvent | null>(null);

  useEffect(() => {
    if (authLoading || !concesionario || !firestore) return;

    const fetchCitas = async () => {
      setIsLoading(true);
      try {
        const citasRef = collection(firestore, `concesionarios/${concesionario.id}/citas_consignacion`);
        const q = query(citasRef, orderBy('fecha_cita', 'asc'));
        const snapshot = await getDocs(q);
        
        const citasData: CitaEvent[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.fecha_cita) {
            const startDate = (data.fecha_cita as Timestamp).toDate();
            // Default 1 hour duration
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
            
            citasData.push({
              id: doc.id,
              title: `${data.vehicle_nombre} - ${data.publicador_nombre || 'Cliente'}`,
              start: startDate,
              end: endDate,
              allDay: false,
              resource: data
            });
          }
        });
        setEvents(citasData);
      } catch (error) {
        console.error("Error fetching citas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCitas();
  }, [concesionario, firestore, authLoading]);

  // Translate messages for react-big-calendar
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
    showMore: (total: number) => `+ Ver más (${total})`
  };

  const eventStyleGetter = (event: CitaEvent) => {
    const estado = event.resource?.estado || 'agendada';
    let backgroundColor = '#3b82f6'; // blue
    if (estado === 'completada') backgroundColor = '#10b981'; // green
    if (estado === 'cancelada') backgroundColor = '#ef4444'; // red

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        padding: '2px 6px',
        fontSize: '12px'
      }
    };
  };

  const statusColors: Record<string, string> = {
    agendada: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    completada: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    cancelada: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Calendario</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Gestiona citas de captación de consignaciones y otros eventos
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-muted/60">
        <CardHeader className="pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <CardTitle>Agenda del Concesionario</CardTitle>
          </div>
          <CardDescription>Visualiza y organiza el flujo de trabajo del equipo. Selecciona una vista superior para cambiar el enfoque.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {isLoading ? (
            <div className="h-[600px] flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-[650px] w-full p-2 bg-background dark:calendar-dark-override rounded-lg">
              <style dangerouslySetInnerHTML={{__html: `
                .rbc-calendar { font-family: inherit; }
                .rbc-toolbar button { border-radius: 6px; }
                .rbc-toolbar button.rbc-active { background-color: var(--primary); color: white; border-color: var(--primary); box-shadow: none; pointer-events: none;}
                .rbc-toolbar button:active { background-color: var(--primary); color: white; border-color: var(--primary); }
                .rbc-toolbar button:hover:not(.rbc-active) { background-color: var(--muted); }
                .rbc-event { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
                .dark .rbc-month-view, .dark .rbc-time-view, .dark .rbc-agenda-view { border-color: hsl(var(--border)); }
                .dark .rbc-day-bg, .dark .rbc-month-row, .dark .rbc-header { border-color: hsl(var(--border)); }
                .dark .rbc-off-range-bg { background-color: hsl(var(--muted)/0.3); }
                .dark .rbc-today { background-color: hsl(var(--muted)/0.6); }
                .dark .rbc-time-content, .dark .rbc-timeslot-group, .dark .rbc-day-slot .rbc-time-slot { border-color: hsl(var(--border)); }
                .dark .rbc-toolbar button { color: hsl(var(--foreground)); border-color: hsl(var(--border)); }
                .dark .rbc-agenda-view table.rbc-agenda-table { border-color: hsl(var(--border)); }
                .dark .rbc-agenda-view table.rbc-agenda-table tbody > tr > td { border-color: hsl(var(--border)); }
                .dark .rbc-agenda-view table.rbc-agenda-table thead > tr > th { border-color: hsl(var(--border)); border-bottom-color: hsl(var(--border)); }
              `}} />
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                messages={messages}
                culture="es"
                defaultView={Views.MONTH}
                views={['month', 'week', 'day', 'agenda']}
                eventPropGetter={eventStyleGetter}
                popup
                selectable
                onSelectEvent={(event) => setSelectedEvent(event)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedEvent} onOpenChange={(val) => { if (!val) setSelectedEvent(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={statusColors[selectedEvent.resource?.estado || 'agendada'] || 'bg-muted'}>
                    {(selectedEvent.resource?.estado || 'agendada').toUpperCase()}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-headline tracking-tight">{selectedEvent.title}</DialogTitle>
                <DialogDescription>
                  Detalles de la cita programada
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">Fecha y Hora</p>
                    <p className="text-sm text-muted-foreground mt-1 capitalize">
                      {format(selectedEvent.start, "EEEE d 'de' MMMM", { locale: es })} a las {format(selectedEvent.start, 'h:mm a')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1 bg-muted/40 p-3 rounded-md">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vehículo</p>
                    <p className="text-sm font-medium">{selectedEvent.resource?.vehicle_nombre}</p>
                    <p className="text-xs text-muted-foreground font-mono">ID: {selectedEvent.resource?.vehicle_id?.substring(0,6)}...</p>
                  </div>
                  <div className="space-y-1 bg-muted/40 p-3 rounded-md">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Atendido por</p>
                    <p className="text-sm font-medium">{selectedEvent.resource?.vendedor_nombre || 'No asignado'}</p>
                  </div>
                </div>

                {selectedEvent.resource?.publicador_telefono && (
                  <div className="bg-primary/5 p-3 rounded-md border border-primary/20">
                     <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">Contacto del Cliente</p>
                     <p className="text-sm font-medium">{selectedEvent.resource.publicador_nombre}</p>
                     <p className="text-sm text-muted-foreground">{selectedEvent.resource.publicador_telefono}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                 <Button variant="outline" onClick={() => setSelectedEvent(null)}>Cerrar</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
