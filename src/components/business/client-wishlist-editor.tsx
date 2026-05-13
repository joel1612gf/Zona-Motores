'use client';

import { useState } from 'react';
import { Timestamp, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Save, Loader2, Car, Heart } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Cliente, VehiculoRequerido } from '@/lib/business-types';

interface Props {
  cliente: Cliente;
  concesionarioId: string;
  onSaved?: (next: VehiculoRequerido[]) => void;
}

function newRequerido(): VehiculoRequerido {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req_${Date.now()}`,
    make: '',
    model: '',
    status: 'pendiente',
    created_at: Timestamp.now(),
  };
}

const STATUS_LABEL: Record<VehiculoRequerido['status'], string> = {
  pendiente: 'Activo',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const STATUS_TONE: Record<VehiculoRequerido['status'], string> = {
  pendiente: 'bg-primary/10 text-primary border-primary/20',
  completado: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  cancelado: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

export function ClientWishlistEditor({ cliente, concesionarioId, onSaved }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [items, setItems] = useState<VehiculoRequerido[]>(cliente.vehiculos_requeridos ?? []);
  const [saving, setSaving] = useState(false);

  const updateItem = (idx: number, patch: Partial<VehiculoRequerido>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => setItems(prev => [...prev, newRequerido()]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const clean = items
        .filter(it => it.make.trim() && it.model.trim())
        .map(it => ({
          ...it,
          make: it.make.trim(),
          model: it.model.trim(),
        }));
      await updateDoc(doc(firestore, 'concesionarios', concesionarioId, 'clientes', cliente.id), {
        vehiculos_requeridos: clean,
        updated_at: serverTimestamp(),
      });
      setItems(clean);
      onSaved?.(clean);
      toast({ title: 'Wishlist actualizada', description: 'Los requerimientos se guardaron correctamente.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem] overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Wishlist del cliente</p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                El match-maker notifica automáticamente al ingresar un vehículo que coincida.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl h-10 px-4 border-primary/20 hover:bg-primary/5 font-bold gap-1.5 flex-shrink-0"
              onClick={addItem}
            >
              <Plus className="h-4 w-4 text-primary" />
              Añadir
            </Button>
          </div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card className="bg-card/40 backdrop-blur-md border-dashed border-2 border-muted-foreground/20 rounded-[1.5rem]">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-muted/50 rounded-full mb-3">
              <Heart className="h-7 w-7 text-muted-foreground opacity-60" />
            </div>
            <p className="text-base font-bold font-headline">Sin requerimientos</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Añade marca, modelo y presupuesto para activar el match-maker automático.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((it, idx) => (
            <Card key={it.id} className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem] overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={cn('text-[10px] font-bold border', STATUS_TONE[it.status])}>
                    <Car className="h-2.5 w-2.5 mr-1" />
                    {STATUS_LABEL[it.status]}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl border-red-200 text-red-500 hover:bg-red-50"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Marca *</Label>
                    <Input
                      value={it.make}
                      onChange={e => updateItem(idx, { make: e.target.value })}
                      placeholder="Toyota"
                      className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Modelo *</Label>
                    <Input
                      value={it.model}
                      onChange={e => updateItem(idx, { model: e.target.value })}
                      placeholder="4Runner"
                      className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Año mínimo</Label>
                    <Input
                      type="number"
                      value={it.year_min ?? ''}
                      onChange={e => updateItem(idx, { year_min: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="2015"
                      className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Año máximo</Label>
                    <Input
                      type="number"
                      value={it.year_max ?? ''}
                      onChange={e => updateItem(idx, { year_max: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="2022"
                      className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Presupuesto USD</Label>
                    <Input
                      type="number"
                      value={it.budget ?? ''}
                      onChange={e => updateItem(idx, { budget: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="25000"
                      className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</Label>
                  <Select value={it.status} onValueChange={(v) => updateItem(idx, { status: v as VehiculoRequerido['status'] })}>
                    <SelectTrigger className="h-11 max-w-[240px] rounded-xl border-slate-200 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="pendiente">Activo (busca match)</SelectItem>
                      <SelectItem value="completado">Completado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-2xl h-11 px-6 shadow-lg shadow-primary/20 gap-2 font-bold"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar wishlist
        </Button>
      </div>
    </div>
  );
}
