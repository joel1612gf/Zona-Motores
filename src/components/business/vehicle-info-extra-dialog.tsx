'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
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
import { Loader2, Sparkles, Upload, CheckCircle2 } from 'lucide-react';
import type { StockVehicle, VehicleInfoExtra } from '@/lib/business-types';

interface VehicleInfoExtraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: StockVehicle;
  concesionarioId: string;
  onSave: () => void;
}

const EMPTY_INFO: VehicleInfoExtra = {
  cedula_propietario: '',
  placa: '',
  serial_niv: '',
  serial_carroceria: '',
  serial_chasis: '',
  serial_carrozado: '',
  serial_motor: '',
  clase: '',
  tipo: '',
};

export function VehicleInfoExtraDialog({ open, onOpenChange, vehicle, concesionarioId, onSave }: VehicleInfoExtraDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();

  const [info, setInfo] = useState<VehicleInfoExtra>({ ...EMPTY_INFO });
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [titlePreview, setTitlePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInfo({ ...EMPTY_INFO, ...(vehicle.info_extra || {}) });
      setTitlePreview(null);
    }
  }, [open, vehicle]);

  const setField = (key: keyof VehicleInfoExtra, value: string) => {
    setInfo(prev => ({ ...prev, [key]: value }));
  };

  const handleTitleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTitlePreview(URL.createObjectURL(file));
    setIsScanning(true);

    try {
      // Convert image to base64 for Gemini
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = file.type;

      const res = await fetch('/api/scan-vehicle-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, vehicleMake: vehicle.make, vehicleModel: vehicle.model, vehicleYear: vehicle.year }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      // Merge extracted fields with current state (don't overwrite if already filled)
      setInfo(prev => ({
        cedula_propietario: data.cedula_propietario || prev.cedula_propietario || '',
        placa: data.placa || prev.placa || '',
        serial_niv: data.serial_niv || prev.serial_niv || '',
        serial_carroceria: data.serial_carroceria || prev.serial_carroceria || '',
        serial_chasis: data.serial_chasis || prev.serial_chasis || '',
        serial_carrozado: data.serial_carrozado || prev.serial_carrozado || '',
        serial_motor: data.serial_motor || prev.serial_motor || '',
        clase: data.clase || prev.clase || '',
        tipo: data.tipo || prev.tipo || '',
      }));

      toast({ title: '✨ Título escaneado', description: 'Verifica los datos extraídos y corrige si es necesario.' });
    } catch (error) {
      console.error('[TitleScan] Error:', error);
      toast({ title: 'Error al escanear', description: 'No se pudo extraer la información. Llena los campos manualmente.', variant: 'destructive' });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ref = doc(firestore, 'concesionarios', concesionarioId, 'inventario', vehicle.id);
      await updateDoc(ref, {
        placa: info.placa || '', // Save at top level for easy access in listings
        info_extra: info,
        updated_at: serverTimestamp(),
      });
      toast({ title: 'Información guardada', description: 'La información extra del vehículo ha sido actualizada.' });
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('[InfoExtra] Error:', error);
      toast({ title: 'Error al guardar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-headline">
            Información Extra — {vehicle.year} {vehicle.make} {vehicle.model}
          </DialogTitle>
          <DialogDescription>
            Datos del título y seriales del vehículo. Esta información se usará en las notas de entrega.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* AI Title Scanner */}
          <div className="p-4 rounded-lg border-2 border-dashed border-purple-300 bg-gradient-to-br from-purple-500/5 to-blue-500/5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-semibold">Escanear Título con IA</p>
                <p className="text-xs text-muted-foreground">Sube una foto clara del título y la IA llenará los campos automáticamente.</p>
              </div>
            </div>

            {titlePreview && (
              <div className="relative h-36 rounded-lg overflow-hidden border bg-muted">
                <img src={titlePreview} alt="Título" className="w-full h-full object-contain" />
                {isScanning && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Analizando con IA...</span>
                  </div>
                )}
              </div>
            )}

            <label className="cursor-pointer block">
              <div className="flex items-center justify-center gap-2 h-10 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-purple-700 text-sm font-medium">
                {isScanning ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Analizando...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Subir foto del título</>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleTitleScan}
                disabled={isScanning}
              />
            </label>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Cédula del Propietario</Label>
              <Input
                placeholder="Ej: V-12345678"
                value={info.cedula_propietario || ''}
                onChange={e => setField('cedula_propietario', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Placa</Label>
              <Input
                placeholder="Ej: AB123CD"
                value={info.placa || ''}
                onChange={e => setField('placa', e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Serial N.I.V.</Label>
              <Input
                placeholder="Número de Identificación Vehicular"
                value={info.serial_niv || ''}
                onChange={e => setField('serial_niv', e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Seriales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'serial_carroceria', label: 'Serial Carrocería' },
                { key: 'serial_chasis', label: 'Serial Chasis' },
                { key: 'serial_carrozado', label: 'Serial Carrozado' },
                { key: 'serial_motor', label: 'Serial Motor' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-sm">{label}</Label>
                  <Input
                    placeholder={`Ej: ${label.split(' ')[1]?.toUpperCase() || '—'}-XXXX`}
                    value={(info as any)[key] || ''}
                    onChange={e => setField(key as keyof VehicleInfoExtra, e.target.value.toUpperCase())}
                    className="font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Clase</Label>
              <Input
                placeholder="Ej: Automóvil, Camioneta"
                value={info.clase || ''}
                onChange={e => setField('clase', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo</Label>
              <Input
                placeholder="Ej: Sedan, SUV, Pick-Up"
                value={info.tipo || ''}
                onChange={e => setField('tipo', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isScanning}>
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Guardar Información'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
