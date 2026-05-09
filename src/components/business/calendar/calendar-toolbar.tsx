'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolbarProps, View } from 'react-big-calendar';

const VIEW_LABELS: Record<View, string> = {
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  work_week: 'Semana laboral',
};

export function CalendarToolbar(props: ToolbarProps) {
  const { label, onNavigate, onView, view, views } = props;
  const availableViews = (Array.isArray(views) ? views : Object.keys(views)) as View[];

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 px-1">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="rounded-2xl h-10 w-10 border-primary/20 hover:bg-primary/5"
          onClick={() => onNavigate('PREV')}
          aria-label="Anterior"
        >
          <ChevronLeft className="h-4 w-4 text-primary" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-2xl h-10 w-10 border-primary/20 hover:bg-primary/5"
          onClick={() => onNavigate('NEXT')}
          aria-label="Siguiente"
        >
          <ChevronRight className="h-4 w-4 text-primary" />
        </Button>
        <Button
          className="rounded-2xl h-10 px-5 shadow-lg shadow-primary/20 font-bold text-xs uppercase tracking-widest"
          onClick={() => onNavigate('TODAY')}
        >
          Hoy
        </Button>
        <p className="ml-2 font-headline text-xl tracking-tight capitalize">{label}</p>
      </div>

      {/* View selector — pill style §7B */}
      <div className="bg-slate-100 p-1 rounded-2xl h-12 border border-slate-200/60 shadow-inner flex items-center gap-1 self-start md:self-auto">
        {availableViews.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            className={cn(
              'rounded-xl px-4 h-10 text-xs font-bold uppercase tracking-tight transition-all',
              view === v
                ? 'bg-white text-primary shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {VIEW_LABELS[v] ?? v}
          </button>
        ))}
      </div>
    </div>
  );
}
