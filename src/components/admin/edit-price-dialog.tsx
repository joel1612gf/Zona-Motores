'use client';

import { useEffect, useState } from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { editPriceSchema } from '@/lib/admin-schemas';
import type { Concesionario } from '@/lib/business-types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type Props = {
  dealership: (Concesionario & { id: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Edits the custom B2B monthly fee (precio_mensual_usd) that drives the MRR. */
export function EditPriceDialog({ dealership, open, onOpenChange }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && dealership) {
      setValue(dealership.precio_mensual_usd != null ? String(dealership.precio_mensual_usd) : '');
      setError(null);
    }
  }, [open, dealership]);

  const handleSave = () => {
    if (!dealership) return;
    const parsed = editPriceSchema.safeParse({ precio_mensual_usd: value });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Valor inválido');
      return;
    }
    updateDocumentNonBlocking(doc(firestore, 'concesionarios', dealership.id), {
      precio_mensual_usd: parsed.data.precio_mensual_usd,
    });
    toast({
      title: 'Tarifa actualizada',
      description: `${dealership.nombre_empresa}: $${parsed.data.precio_mensual_usd.toFixed(2)} / mes`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">Tarifa mensual</DialogTitle>
          <DialogDescription>
            {dealership?.nombre_empresa} — define la cuota mensual del SaaS en dólares (USD).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="precio_mensual_usd">Precio mensual (USD)</Label>
          <Input
            id="precio_mensual_usd"
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="25"
            className="rounded-xl h-12"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleSave}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
