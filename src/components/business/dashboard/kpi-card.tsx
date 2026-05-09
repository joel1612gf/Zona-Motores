'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type KpiVariant = 'primary' | 'success' | 'warning' | 'danger' | 'gradient';

type KpiCardProps = {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  variant?: KpiVariant;
  trend?: string;
  onClick?: () => void;
};

const VARIANT_STYLES: Record<KpiVariant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-primary/30',
  success: 'bg-card border-l-4 border-l-emerald-500 shadow-sm',
  warning: 'bg-card border-l-4 border-l-amber-500 shadow-sm',
  danger: 'bg-card border-l-4 border-l-red-500 shadow-sm',
  gradient: 'bg-gradient-to-br from-blue-600/90 to-blue-800/90 text-white ring-1 ring-white/20 shadow-2xl',
};

export function KpiCard({ title, value, description, icon: Icon, variant = 'primary', trend, onClick }: KpiCardProps) {
  const isLight = variant !== 'primary' && variant !== 'gradient';
  const Wrapper: any = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'block w-full text-left',
        onClick && 'cursor-pointer'
      )}
    >
      <Card
        className={cn(
          'border-none relative overflow-hidden group transition-all hover:-translate-y-1 rounded-[1.5rem]',
          VARIANT_STYLES[variant]
        )}
      >
        <Icon
          className={cn(
            'absolute -bottom-4 -right-4 h-28 w-28 group-hover:scale-110 transition-transform duration-700',
            isLight ? 'opacity-[0.06]' : 'opacity-[0.15]'
          )}
        />
        <CardHeader className="pb-2 space-y-0 relative z-10">
          <p
            className={cn(
              'text-[10px] font-black uppercase tracking-[0.2em]',
              isLight ? 'text-muted-foreground' : 'text-white/70'
            )}
          >
            {title}
          </p>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-bold font-headline tracking-tighter leading-none">{value}</div>
          {description && (
            <p
              className={cn(
                'text-xs mt-2.5 font-medium',
                isLight ? 'text-muted-foreground' : 'text-white/80'
              )}
            >
              {description}
            </p>
          )}
          {trend && (
            <div
              className={cn(
                'mt-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest',
                isLight ? 'text-primary/70' : 'text-white/70'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full animate-pulse',
                  isLight ? 'bg-primary' : 'bg-white'
                )}
              />
              {trend}
            </div>
          )}
        </CardContent>
      </Card>
    </Wrapper>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="h-32 rounded-[1.5rem] bg-muted/40 animate-pulse" />
  );
}
