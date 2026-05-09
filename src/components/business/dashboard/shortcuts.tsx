'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import {
  ChevronRight,
  ShoppingCart,
  Wallet,
  Receipt,
  BarChart3,
  Plus,
  type LucideIcon,
} from 'lucide-react';

type Shortcut = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type ShortcutsProps = {
  items?: Shortcut[];
};

export function Shortcuts({ items }: ShortcutsProps) {
  const { slug } = useParams();
  const defaults: Shortcut[] = [
    { href: `/business/${slug}/sales`, label: 'Nueva venta', description: 'Registrar venta', icon: ShoppingCart },
    { href: `/business/${slug}/finance`, label: 'Registrar gasto', description: 'Egreso operativo', icon: Receipt },
    { href: `/business/${slug}/cash-register`, label: 'Caja', description: 'Movimientos / cierre', icon: Wallet },
    { href: `/business/${slug}/reports`, label: 'Ver reportes', description: 'Análisis del período', icon: BarChart3 },
  ];

  const list = items ?? defaults;

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
        Atajos rápidos
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {list.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href + s.label} href={s.href}>
              <Card className="border-none shadow-sm bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem] h-28 p-4 flex items-center gap-3 hover:-translate-y-1 hover:ring-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all group cursor-pointer">
                <div className="p-2.5 bg-primary/5 rounded-2xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <Icon className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{s.label}</p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight mt-0.5 truncate">
                    {s.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Re-export Plus for convenience in role-specific overviews
export { Plus };
