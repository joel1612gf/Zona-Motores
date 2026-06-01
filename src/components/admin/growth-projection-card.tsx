'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectionResult } from '@/lib/analytics-helpers';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  icon: LucideIcon;
  projection: ProjectionResult;
  /** Last month-over-month growth (e.g. 0.12). null when no base. */
  growth: number | null;
  /** Formats numeric values for display (e.g. currency or integer count). */
  format: (n: number) => string;
};

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function nextSixMonthLabels(now: Date = new Date()): string[] {
  const labels: string[] = [];
  let m = now.getMonth();
  for (let i = 0; i < 6; i++) {
    m += 1;
    if (m > 11) m = 0;
    labels.push(MONTHS_ES[m]);
  }
  return labels;
}

const CONFIDENCE_LABEL: Record<ProjectionResult['confidence'], string> = {
  high: 'Confianza alta',
  medium: 'Confianza media',
  low: 'Confianza baja',
};

export function GrowthProjectionCard({ title, icon: Icon, projection, growth, format }: Props) {
  const labels = nextSixMonthLabels();
  const finalValue = projection.projected[projection.projected.length - 1] ?? projection.lastValue;
  const ratePct = (projection.monthlyRate * 100).toFixed(1);
  const isPositive = projection.monthlyRate >= 0;
  const RateIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem] overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
          </div>
          <Badge
            variant={projection.confidence === 'high' ? 'default' : projection.confidence === 'medium' ? 'secondary' : 'outline'}
            className="text-[10px] font-black uppercase tracking-wide"
          >
            {CONFIDENCE_LABEL[projection.confidence]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Proyección a 6 meses</p>
            <p className="text-3xl font-bold font-headline tracking-tighter leading-none">{format(finalValue)}</p>
          </div>
          <div className={cn('flex items-center gap-1 text-sm font-bold', isPositive ? 'text-emerald-600' : 'text-red-600')}>
            <RateIcon className="h-4 w-4" />
            {isPositive ? '+' : ''}
            {ratePct}%/mes
          </div>
        </div>

        {/* Mini projected timeline */}
        <div className="grid grid-cols-6 gap-1.5">
          {projection.projected.map((v, i) => (
            <div key={i} className="rounded-lg bg-muted/40 px-1 py-2 text-center">
              <p className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">{labels[i]}</p>
              <p className="text-[11px] font-bold tabular-nums">{format(v)}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Crecimiento último mes:{' '}
            <span className={cn('font-bold', (growth ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {growth == null ? 'N/D' : `${growth >= 0 ? '+' : ''}${(growth * 100).toFixed(1)}%`}
            </span>
          </span>
        </div>

        {projection.insufficientData && (
          <p className="text-[11px] text-amber-600 font-medium">
            Datos históricos insuficientes — proyección referencial.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
