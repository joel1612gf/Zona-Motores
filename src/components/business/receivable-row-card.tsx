'use client';

import {
  AlertCircle,
  Calendar,
  Car,
  ChevronRight,
  FileText,
  HandCoins,
  Layers,
  MessageCircle,
  Package,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import type { ReceivableRow } from '@/lib/receivable-schemas';
import {
  openWhatsApp,
  templateCobranza,
  templateVencido,
} from '@/lib/whatsapp-helper';

function ageInDays(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function origenIcon(origen: ReceivableRow['origen']) {
  if (origen === 'venta_credito_vehiculo') return <Car className="h-5 w-5 text-primary" />;
  if (origen === 'venta_credito_producto') return <Package className="h-5 w-5 text-primary" />;
  if (origen === 'nota_debito_cliente') return <FileText className="h-5 w-5 text-amber-500" />;
  return <HandCoins className="h-5 w-5 text-primary" />;
}

function origenLabel(origen: ReceivableRow['origen']): string {
  const map: Record<ReceivableRow['origen'], string> = {
    venta_credito_vehiculo: 'Financiamiento Vehículo',
    venta_credito_producto: 'Crédito Comercial',
    nota_debito_cliente: 'Nota de Débito',
  };
  return map[origen];
}

function statusBadge(estado: ReceivableRow['estado']) {
  if (estado === 'pagada') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
        Pagada
      </Badge>
    );
  }
  if (estado === 'parcial') {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
        Parcial
      </Badge>
    );
  }
  if (estado === 'vencida') {
    return (
      <Badge className="bg-red-500/10 text-red-600 border-red-500/20 font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
        Vencida
      </Badge>
    );
  }
  return null;
}

interface ReceivableRowCardProps {
  row: ReceivableRow;
  empresaNombre: string;
  onPay: (row: ReceivableRow) => void;
  canWrite: boolean;
}

export function ReceivableRowCard({ row, empresaNombre, onPay, canWrite }: ReceivableRowCardProps) {
  const vencimiento = row.fecha_vencimiento ?? row.fecha_emision;
  const isOverdue = row.estado === 'vencida' || (vencimiento.getTime() < Date.now() && row.estado !== 'pagada');
  const overdueDays = isOverdue ? ageInDays(vencimiento) : 0;
  const dueDays = !isOverdue ? daysUntil(vencimiento) : 0;
  const dueSoon = !isOverdue && dueDays >= 0 && dueDays <= 7 && row.estado !== 'pagada';

  const handleWhatsApp = () => {
    if (!row.cliente_telefono) return;
    const ctx = {
      clienteNombre: row.cliente_nombre,
      empresaNombre,
      cuotaNumero: row.numero_cuota ?? 1,
      cuotasTotal: row.cuotas_total ?? 1,
      montoUsd: row.saldo_pendiente,
      fechaVencimientoIso: vencimiento.toISOString().slice(0, 10),
      descripcion: row.descripcion,
    };
    const text = isOverdue ? templateVencido(ctx) : templateCobranza(ctx);
    openWhatsApp(row.cliente_telefono, text);
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[2rem] border bg-card/30 backdrop-blur-md p-5 transition-all duration-300 hover:bg-card/50',
        isOverdue && row.estado !== 'pagada' ? 'border-red-500/30' : 'border-white/5'
      )}
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-background/50 border border-white/5 shadow-inner">
            {origenIcon(row.origen)}
          </div>
          <div className="min-w-0">
            <h4 className="text-lg font-bold tracking-tight truncate">{row.cliente_nombre}</h4>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {origenLabel(row.origen)}
              </span>
              {row.numero_cuota && row.cuotas_total && (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    Cuota {row.numero_cuota}/{row.cuotas_total}
                  </span>
                </>
              )}
              <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
              <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Vence {vencimiento.toLocaleDateString('es-VE')}
              </span>
              {isOverdue && row.estado !== 'pagada' && (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {overdueDays} días vencido
                  </span>
                </>
              )}
              {dueSoon && (
                <>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                    Vence en {dueDays} d
                  </span>
                </>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground truncate">{row.descripcion}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 md:justify-end">
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Total</p>
              <p className="text-base font-bold text-muted-foreground/80">
                {formatCurrency(row.monto_original, 'USD')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                Saldo Pendiente
              </p>
              <p
                className={cn(
                  'text-xl font-bold tracking-tighter font-headline',
                  row.saldo_pendiente > 0 ? 'text-primary' : 'text-emerald-500'
                )}
              >
                {formatCurrency(row.saldo_pendiente, 'USD')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusBadge(row.estado)}
            {row.cliente_telefono && (
              <Button
                onClick={handleWhatsApp}
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-2xl border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                title="Enviar recordatorio por WhatsApp"
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" />
              </Button>
            )}
            {canWrite && row.estado !== 'pagada' && (
              <Button
                onClick={() => onPay(row)}
                className="h-11 rounded-2xl px-6 font-bold shadow-lg shadow-primary/20 transition-transform active:scale-95"
              >
                Cobrar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
