'use client';

import { cn } from '@/lib/utils';
import type { UnifiedCalendarEvent } from '@/lib/calendar-schemas';

type CalendarEventCardProps = {
  event: UnifiedCalendarEvent;
};

/** Compact event chip rendered inside react-big-calendar cells */
export function CalendarEventCard({ event }: CalendarEventCardProps) {
  const Icon = event.icon;
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[11px] font-bold truncate w-full',
        event.tone.chipBg,
        event.tone.chipText
      )}
    >
      <Icon className={cn('h-3 w-3 shrink-0', event.tone.iconColor)} />
      <span className="truncate">{event.title}</span>
    </div>
  );
}
