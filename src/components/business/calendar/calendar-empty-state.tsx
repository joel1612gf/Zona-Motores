'use client';

import { Button } from '@/components/ui/button';
import { CalendarOff, Plus } from 'lucide-react';

type CalendarEmptyStateProps = {
  title?: string;
  description?: string;
  canCreate?: boolean;
  onCreate?: () => void;
};

export function CalendarEmptyState({
  title = 'Sin eventos',
  description = 'No hay nada agendado para este día.',
  canCreate,
  onCreate,
}: CalendarEmptyStateProps) {
  return (
    <div className="border-dashed border-2 border-muted-foreground/20 rounded-[1.5rem] py-10 px-6 flex flex-col items-center text-center gap-3">
      <div className="p-3 bg-muted/40 rounded-full">
        <CalendarOff className="h-8 w-8 text-muted-foreground opacity-60" />
      </div>
      <p className="text-base font-bold font-headline">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      {canCreate && onCreate && (
        <Button
          variant="outline"
          className="rounded-2xl mt-2 border-primary/20 hover:bg-primary/5 font-bold gap-2"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4 text-primary" /> Crear evento
        </Button>
      )}
    </div>
  );
}
