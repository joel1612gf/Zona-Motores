'use client';

import { useState } from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Car, Pause, Play, Trash2, User } from 'lucide-react';

type VehicleRow = Vehicle & { id: string };

type Props = {
  listings: VehicleRow[];
  /** Map owner_uid → nombre_empresa for the dealership column. */
  dealerNameByUid: Map<string, string>;
};

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  paused: { label: 'Pausado', variant: 'secondary' },
  sold: { label: 'Vendido', variant: 'outline' },
};

export function MarketplaceTable({ listings, dealerNameByUid }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<VehicleRow | null>(null);

  const listingRef = (v: VehicleRow) => doc(firestore, 'users', v.sellerId, 'vehicleListings', v.id);

  const togglePause = (v: VehicleRow) => {
    const next = v.status === 'paused' ? 'active' : 'paused';
    updateDocumentNonBlocking(listingRef(v), { status: next });
    toast({
      title: next === 'paused' ? 'Publicación pausada' : 'Publicación reactivada',
      description: `${v.make} ${v.model}`,
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteDocumentNonBlocking(listingRef(pendingDelete));
    toast({ title: 'Publicación eliminada', description: `${pendingDelete.make} ${pendingDelete.model}` });
    setPendingDelete(null);
  };

  const sellerLabel = (v: VehicleRow) => {
    const dealerName = dealerNameByUid.get(v.sellerId) ?? (v.seller?.uid ? dealerNameByUid.get(v.seller.uid) : undefined);
    if (dealerName) return { name: dealerName, isDealer: true };
    return { name: v.seller?.displayName || 'Particular', isDealer: false };
  };

  const statusOf = (v: VehicleRow) => STATUS_META[v.status ?? 'active'] ?? STATUS_META.active;

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-[1.5rem] bg-card/40">
        <Car className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
        <p className="font-headline text-lg font-semibold">No hay publicaciones</p>
        <p className="text-sm text-muted-foreground mt-1">Los vehículos del Marketplace aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-[1.5rem] border shadow-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Vehículo</TableHead>
              <TableHead>Publicado por</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((v) => {
              const seller = sellerLabel(v);
              const status = statusOf(v);
              const isSold = v.status === 'sold';
              return (
                <TableRow key={`${v.sellerId}-${v.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 rounded-lg overflow-hidden bg-muted shrink-0">
                        {v.images?.[0]?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.images[0].url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Car className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {v.make} {v.model}
                        </p>
                        <p className="text-xs text-muted-foreground">{v.year}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {seller.isDealer ? (
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={cn('text-sm', seller.isDealer && 'font-medium')}>{seller.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(v.priceUSD ?? 0, 'USD')}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        disabled={isSold}
                        onClick={() => togglePause(v)}
                      >
                        {v.status === 'paused' ? (
                          <>
                            <Play className="h-3.5 w-3.5 mr-1" /> Reactivar
                          </>
                        ) : (
                          <>
                            <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setPendingDelete(v)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {listings.map((v) => {
          const seller = sellerLabel(v);
          const status = statusOf(v);
          const isSold = v.status === 'sold';
          return (
            <div
              key={`${v.sellerId}-${v.id}`}
              className="rounded-[1.5rem] border shadow-sm bg-card p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-14 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
                  {v.images?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Car className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {v.make} {v.model} <span className="text-muted-foreground font-normal">{v.year}</span>
                  </p>
                  <p className="text-sm font-medium tabular-nums">{formatCurrency(v.priceUSD ?? 0, 'USD')}</p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                {seller.isDealer ? (
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className={cn(seller.isDealer && 'font-medium')}>{seller.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-lg flex-1" disabled={isSold} onClick={() => togglePause(v)}>
                  {v.status === 'paused' ? (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1" /> Reactivar
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setPendingDelete(v)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent className="bg-card rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-xl">¿Eliminar publicación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente {pendingDelete?.make} {pendingDelete?.model} ({pendingDelete?.year}) del
              Marketplace. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 px-8 font-bold"
              onClick={confirmDelete}
            >
              Sí, Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
