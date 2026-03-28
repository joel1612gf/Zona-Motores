'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useBusinessAuth } from '@/context/business-auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { StockVehicle, GastoAdecuacion, GastoCategoria } from '@/lib/business-types';
import { GASTO_CATEGORIA_LABELS } from '@/lib/business-types';

interface VehicleCostsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: StockVehicle;
  concesionarioId: string;
  onSave: () => void;
}

export function VehicleCostsDialog({ open, onOpenChange, vehicle, concesionarioId, onSave }: VehicleCostsDialogProps) {
  const { toast } = useToast();
  const { concesionario } = useBusinessAuth();
  const firestore = useFirestore();

  const [gastos, setGastos] = useState<GastoAdecuacion[]>([]);
  const [newCategoria, setNewCategoria] = useState<GastoCategoria>('lavado');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [newMonto, setNewMonto] = useState<number>(0);
  const [precioVenta, setPrecioVenta] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showPricePrompt, setShowPricePrompt] = useState(false);

  useEffect(() => {
    if (open) {
      setGastos(vehicle.gastos_adecuacion || []);
      setPrecioVenta(vehicle.precio_venta || 0);
      setShowPricePrompt(false);
      setNewCategoria('lavado');
      setNewDescripcion('');
      setNewMonto(0);
    }
  }, [open, vehicle]);

  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);
  const costoCompra = vehicle.costo_compra || 0;
  const totalInvertido = costoCompra + totalGastos;
  const gananciaActual = precioVenta - totalInvertido;
  const margenActual = totalInvertido > 0 ? ((gananciaActual / totalInvertido) * 100).toFixed(1) : '0.0';
  const margenMinimo = concesionario?.configuracion?.margen_minimo || 10;
  const precioSugerido = Math.ceil(totalInvertido * (1 + margenMinimo / 100) / 100) * 100;

  const originalTotalGastos = (vehicle.gastos_adecuacion || []).reduce((s, g) => s + g.monto, 0);
  const gastosChanged = totalGastos !== originalTotalGastos;

  const addGasto = () => {
    if (!newDescripcion.trim() || newMonto <= 0) {
      toast({ title: 'Datos incompletos', description: 'Describe el gasto y agrega un monto mayor a 0.', variant: 'destructive' });
      return;
    }
    setGastos(prev => [...prev, { categoria: newCategoria, descripcion: newDescripcion.trim(), monto: newMonto }]);
    setNewDescripcion('');
    setNewMonto(0);
    // Show price prompt when costs are added
    setShowPricePrompt(true);
  };

  const removeGasto = (index: number) => {
    setGastos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (withNewPrice?: number) => {
    setIsSaving(true);
    try {
      const finalPrecio = withNewPrice !== undefined ? withNewPrice : precioVenta;
      const ganancia = finalPrecio - totalInvertido;

      const ref = doc(firestore, 'concesionarios', concesionarioId, 'inventario', vehicle.id);
      await updateDoc(ref, {
        gastos_adecuacion: gastos,
        precio_venta: finalPrecio,
        ganancia_neta_estimada: ganancia,
        updated_at: serverTimestamp(),
      });

      toast({ title: 'Costos actualizados', description: 'Los gastos y el precio han sido guardados.' });
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('[CostsDialog] Error:', error);
      toast({ title: 'Error al guardar', description: 'Revisa tu conexión e intenta de nuevo.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-headline">
            Agregar Costos — {vehicle.year} {vehicle.make} {vehicle.model}
          </DialogTitle>
          <DialogDescription>
            Registra los gastos de adecuación del vehículo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground">Costo Compra</p>
              <p className="font-bold text-base">{formatCurrency(costoCompra)}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
              <p className="text-xs text-muted-foreground">Gastos Adec.</p>
              <p className="font-bold text-base text-orange-700">{formatCurrency(totalGastos)}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border">
              <p className="text-xs text-muted-foreground">Total Invertido</p>
              <p className="font-bold text-base">{formatCurrency(totalInvertido)}</p>
            </div>
          </div>

          {/* Existing costs list */}
          {gastos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Gastos registrados</Label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {gastos.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30 group">
                    <Badge variant="secondary" className="text-xs shrink-0">{GASTO_CATEGORIA_LABELS[g.categoria]}</Badge>
                    <span className="text-sm flex-1 truncate">{g.descripcion}</span>
                    <span className="text-sm font-semibold shrink-0">{formatCurrency(g.monto)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeGasto(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new cost */}
          <div className="space-y-3 p-4 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/10">
            <Label className="text-sm font-medium">Agregar nuevo gasto</Label>
            <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Categoría</Label>
                <Select value={newCategoria} onValueChange={(v) => setNewCategoria(v as GastoCategoria)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(GASTO_CATEGORIA_LABELS) as [GastoCategoria, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Descripción</Label>
                <Input
                  className="h-9"
                  placeholder="Ej: Pulitura completa"
                  value={newDescripcion}
                  onChange={e => setNewDescripcion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGasto()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Monto ($)</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9"
                  value={newMonto || ''}
                  onChange={e => setNewMonto(Number(e.target.value))}
                  onKeyDown={e => e.key === 'Enter' && addGasto()}
                />
              </div>
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={addGasto}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Price prompt after costs added */}
          {showPricePrompt && gastosChanged && (
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Se agregaron costos. ¿Deseas ajustar el precio de venta?</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Precio actual: <strong>{formatCurrency(precioVenta)}</strong> — Ganancia: <strong className={gananciaActual >= 0 ? 'text-green-700' : 'text-red-600'}>{formatCurrency(gananciaActual)} ({margenActual}%)</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-xs shrink-0">Nuevo precio:</Label>
                  <Input
                    type="number"
                    min={totalInvertido}
                    value={precioVenta}
                    onChange={e => setPrecioVenta(Number(e.target.value))}
                    className="h-8 text-sm flex-1"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => setPrecioVenta(precioSugerido)}
                >
                  {precioVenta < precioSugerido ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  Sugerido: {formatCurrency(precioSugerido)}
                </Button>
              </div>

              {precioVenta > 0 && (
                <p className="text-xs text-muted-foreground">
                  Con este precio: ganancia <strong className={gananciaActual >= 0 ? 'text-green-700' : 'text-red-600'}>{formatCurrency(gananciaActual)}</strong> ({margenActual}%)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={() => handleSave(precioVenta)} disabled={isSaving}>
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Guardar Costos'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
