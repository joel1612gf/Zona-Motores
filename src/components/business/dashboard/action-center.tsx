'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { differenceInDays, differenceInHours } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import {
  ListTodo,
  Receipt,
  AlertTriangle,
  Package,
  Handshake,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import type { Producto, Compra } from '@/lib/business-types';

type PendingItem = {
  id: string;
  type: 'pre_invoice' | 'cxp' | 'stock' | 'lead';
  title: string;
  meta: string;
  metaTone: 'neutral' | 'amber' | 'red';
  href: string;
  icon: typeof Receipt;
};

const TYPE_STYLES: Record<PendingItem['type'], { bg: string; iconColor: string }> = {
  pre_invoice: { bg: 'bg-primary/5 border-primary/10', iconColor: 'text-primary' },
  cxp: { bg: 'bg-amber-500/5 border-amber-500/10', iconColor: 'text-amber-600' },
  stock: { bg: 'bg-red-500/5 border-red-500/10', iconColor: 'text-red-600' },
  lead: { bg: 'bg-emerald-500/5 border-emerald-500/10', iconColor: 'text-emerald-600' },
};

export function ActionCenter() {
  const { slug } = useParams();
  const { concesionario } = useBusinessAuth();
  const firestore = useFirestore();

  const preInvoicesQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'pre_invoices'),
      where('estado', '==', 'pendiente'),
      orderBy('created_at', 'asc'),
      limit(10)
    );
  }, [concesionario?.id, firestore]);

  const comprasPendientesQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'compras'),
      where('estado', '==', 'pendiente'),
      limit(20)
    );
  }, [concesionario?.id, firestore]);

  const productosQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'productos'),
      limit(200)
    );
  }, [concesionario?.id, firestore]);

  const leadsQuery = useMemoFirebase(() => {
    if (!concesionario?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionario.id, 'consignaciones_leads'),
      where('estado', 'in', ['contacto_inicial', 'cita_agendada']),
      limit(20)
    );
  }, [concesionario?.id, firestore]);

  const { data: preInvoices, isLoading: piLoading } = useCollection<any>(preInvoicesQuery);
  const { data: compras, isLoading: cxpLoading } = useCollection<Compra>(comprasPendientesQuery);
  const { data: productos, isLoading: prodLoading } = useCollection<Producto>(productosQuery);
  const { data: leads, isLoading: leadsLoading } = useCollection<any>(leadsQuery);

  const isLoading = piLoading || cxpLoading || prodLoading || leadsLoading;

  const items = useMemo<PendingItem[]>(() => {
    const out: PendingItem[] = [];
    const now = new Date();

    preInvoices?.slice(0, 3).forEach((pi: any) => {
      const monto = pi.precio_negociado ?? pi.total_usd ?? pi.precio_total ?? 0;
      out.push({
        id: pi.id,
        type: 'pre_invoice',
        title: pi.item_nombre || 'Prefactura pendiente',
        meta: `${formatCurrency(monto, 'USD')} · ${pi.vendedor_nombre || 'Vendedor'}`,
        metaTone: 'neutral',
        href: `/business/${slug}/sales`,
        icon: Receipt,
      });
    });

    compras?.forEach((c) => {
      const venc = c.fecha_vencimiento?.toDate?.();
      if (!venc) return;
      const days = differenceInDays(venc, now);
      if (days > 7) return;
      const tone: PendingItem['metaTone'] = days < 0 ? 'red' : 'amber';
      const metaText = days < 0 ? `Vencida hace ${Math.abs(days)}d` : days === 0 ? 'Vence hoy' : `Vence en ${days}d`;
      out.push({
        id: c.id,
        type: 'cxp',
        title: c.proveedor_nombre || 'Proveedor',
        meta: `${formatCurrency(c.saldo_pendiente ?? c.total_usd ?? 0, 'USD')} · ${metaText}`,
        metaTone: tone,
        href: `/business/${slug}/payables`,
        icon: AlertTriangle,
      });
    });

    productos?.filter((p) => p.stock_actual <= p.stock_minimo).slice(0, 3).forEach((p) => {
      out.push({
        id: p.id,
        type: 'stock',
        title: p.nombre,
        meta: `${p.stock_actual} unidades · mínimo ${p.stock_minimo}`,
        metaTone: 'red',
        href: `/business/${slug}/products`,
        icon: Package,
      });
    });

    leads?.forEach((lead: any) => {
      const updated = lead.updated_at?.toDate?.() || lead.created_at?.toDate?.();
      if (!updated) return;
      const hours = differenceInHours(now, updated);
      if (hours < 48) return;
      out.push({
        id: lead.id,
        type: 'lead',
        title: lead.vehiculo_descripcion || lead.propietario_nombre || 'Lead de consignación',
        meta: `Sin contacto hace ${Math.floor(hours / 24)}d`,
        metaTone: 'amber',
        href: `/business/${slug}/consignment`,
        icon: Handshake,
      });
    });

    return out.slice(0, 6);
  }, [preInvoices, compras, productos, leads, slug]);

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[2rem]">
      <CardHeader className="bg-muted/30 border-b flex-row items-center justify-between gap-4 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <ListTodo className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-headline tracking-tight">Tu cola de hoy</CardTitle>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
              Acciones que requieren atención
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-black tabular-nums">
            {items.length}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 px-6 animate-pulse">
                <div className="w-12 h-12 rounded-2xl bg-muted/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 bg-muted/50 rounded" />
                  <div className="h-2 w-1/3 bg-muted/30 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 px-6">
            <div className="border-dashed border-2 border-muted-foreground/20 rounded-[2rem] py-12 flex flex-col items-center text-center gap-3">
              <div className="p-4 bg-emerald-500/10 rounded-full">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <p className="text-lg font-bold font-headline text-foreground">Todo en orden</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                No hay pendientes urgentes. Buen momento para revisar reportes o cerrar caja.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => {
              const Icon = item.icon;
              const styles = TYPE_STYLES[item.type];
              const metaColor =
                item.metaTone === 'red'
                  ? 'text-red-600'
                  : item.metaTone === 'amber'
                  ? 'text-amber-600'
                  : 'text-muted-foreground';
              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  className="flex items-center gap-4 p-4 px-6 hover:bg-muted/30 transition-all group"
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 transition-all',
                      styles.bg
                    )}
                  >
                    <Icon className={cn('h-5 w-5', styles.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{item.title}</p>
                    <p className={cn('text-xs font-medium mt-0.5', metaColor)}>{item.meta}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
