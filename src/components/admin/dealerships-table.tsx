'use client';

import { doc } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import type { Concesionario } from '@/lib/business-types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Building2, DollarSign, Trash2, KeyRound } from 'lucide-react';

type DealerRow = Concesionario & { id: string };

type Props = {
  dealerships: DealerRow[];
  onEditPrice: (d: DealerRow) => void;
  onResetKey: (d: DealerRow) => void;
  onDelete: (d: DealerRow) => void;
};

export function DealershipsTable({ dealerships, onEditPrice, onResetKey, onDelete }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const toggleActive = (d: DealerRow) => {
    const next = !d.plan_activo;
    updateDocumentNonBlocking(doc(firestore, 'concesionarios', d.id), { plan_activo: next });
    toast({
      title: next ? 'Plan activado' : 'Plan suspendido',
      description: `${d.nombre_empresa} — el acceso al SaaS ${next ? 'fue habilitado' : 'quedó bloqueado'}.`,
    });
  };

  const nameLabel = (d: DealerRow) => d.nombre_empresa?.trim() || 'Sin configurar';
  const ownerLabel = (d: DealerRow) =>
    d.email || (d.owner_uid ? `${d.owner_uid.slice(0, 10)}…` : 'Pendiente onboarding');
  const priceLabel = (d: DealerRow) =>
    d.precio_mensual_usd != null ? `${formatCurrency(d.precio_mensual_usd, 'USD')}/mes` : 'Sin tarifa';

  if (dealerships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-[1.5rem] bg-card/40">
        <Building2 className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
        <p className="font-headline text-lg font-semibold">No hay concesionarios</p>
        <p className="text-sm text-muted-foreground mt-1">Los clientes del SaaS aparecerán aquí.</p>
      </div>
    );
  }

  const Logo = ({ d }: { d: DealerRow }) =>
    d.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={d.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover bg-muted shrink-0" />
    ) : (
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Building2 className="h-5 w-5 text-primary" />
      </div>
    );

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-[1.5rem] border shadow-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Concesionario</TableHead>
              <TableHead>Dueño</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dealerships.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Logo d={d} />
                    <div>
                      <p className="font-medium">{nameLabel(d)}</p>
                      <p className="text-xs text-muted-foreground">/{d.slug}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{ownerLabel(d)}</TableCell>
                <TableCell>
                  <span className="text-sm font-medium tabular-nums">{priceLabel(d)}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Switch checked={!!d.plan_activo} onCheckedChange={() => toggleActive(d)} />
                    <Badge variant={d.plan_activo ? 'default' : 'secondary'}>
                      {d.plan_activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onEditPrice(d)}>
                      <DollarSign className="h-3.5 w-3.5 mr-1" /> Tarifa
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg text-amber-600 hover:text-amber-600 hover:bg-amber-500/10"
                      title="Resetear clave maestra"
                      onClick={() => onResetKey(d)}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(d)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {dealerships.map((d) => (
          <div key={d.id} className="rounded-[1.5rem] border shadow-sm bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Logo d={d} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{nameLabel(d)}</p>
                <p className="text-xs text-muted-foreground truncate">{ownerLabel(d)}</p>
              </div>
              <Badge variant={d.plan_activo ? 'default' : 'secondary'}>{d.plan_activo ? 'Activo' : 'Inactivo'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium tabular-nums">{priceLabel(d)}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Plan</span>
                <Switch checked={!!d.plan_activo} onCheckedChange={() => toggleActive(d)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-lg flex-1" onClick={() => onEditPrice(d)}>
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Editar tarifa
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg text-amber-600 hover:text-amber-600 hover:bg-amber-500/10"
                title="Resetear clave maestra"
                onClick={() => onResetKey(d)}
              >
                <KeyRound className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(d)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
