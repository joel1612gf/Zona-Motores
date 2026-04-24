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
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Upload, CheckCircle2, FileText, Hash, ShieldCheck, Fingerprint, Info } from 'lucide-react';
import type { StockVehicle, VehicleInfoExtra } from '@/lib/business-types';
import { cn } from '@/lib/utils';

interface VehicleInfoExtraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: StockVehicle | null;
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
    if (open && vehicle) {
      setInfo({ ...EMPTY_INFO, ...(vehicle.info_extra || {}) });
      setTitlePreview(null);
    }
  }, [open, vehicle]);

  if (!vehicle) return null;

  const setField = (key: keyof VehicleInfoExtra, value: string) => {
    setInfo(prev => ({ ...prev, [key]: value }));
  };

  const handleTitleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTitlePreview(URL.createObjectURL(file));
    setIsScanning(true);

    try {
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
        placa: info.placa || '', 
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
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-2xl p-0 transition-all duration-300 rounded-[2rem]">
        <DialogHeader className="p-8 pb-4 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Expediente Legal</DialogTitle>
              <DialogDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          {/* AI Scanner Section */}
          <div className="relative group overflow-hidden p-6 rounded-3xl border-2 border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all duration-500 shadow-sm">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Sparkles className="h-24 w-24 text-primary" />
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
              <div className="flex-1 space-y-2 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                  <p className="font-black text-sm uppercase tracking-tight">Escaner Inteligente de Títulos</p>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm">
                  Captura una fotografía clara del título de propiedad. Nuestra IA extraerá automáticamente la placa, N.I.V. y seriales del motor.
                </p>
              </div>

              {titlePreview && (
                <div className="relative w-32 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-xl bg-muted shrink-0 animate-in zoom-in-95">
                  <img src={titlePreview} alt="Preview" className="w-full h-full object-cover" />
                  {isScanning && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                </div>
              )}

              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 font-bold gap-2 shrink-0"
              >
                {isScanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</> : <><Upload className="h-4 w-4" /> Escanear Ahora</>}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleTitleScan} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Identification Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 px-1">
                <Fingerprint className="h-4 w-4 text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identificación Básica</span>
              </div>
              
              <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Cédula del Propietario</Label>
                  <Input
                    placeholder="V-12345678"
                    value={info.cedula_propietario || ''}
                    onChange={e => setField('cedula_propietario', e.target.value)}
                    className="h-11 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Placa / Matrícula</Label>
                  <Input
                    placeholder="AB123CD"
                    value={info.placa || ''}
                    onChange={e => setField('placa', e.target.value.toUpperCase())}
                    className="h-11 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-black tracking-widest text-primary"
                  />
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Serial N.I.V. (VIN)</Label>
                  <Input
                    placeholder="Número de Identificación Vehicular"
                    value={info.serial_niv || ''}
                    onChange={e => setField('serial_niv', e.target.value.toUpperCase())}
                    className="h-11 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Technical Serial Numbers */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 px-1">
                <Hash className="h-4 w-4 text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seriales de Carrocería</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'serial_carroceria', label: 'Carrocería' },
                  { key: 'serial_chasis', label: 'Chasis' },
                  { key: 'serial_motor', label: 'Motor' },
                  { key: 'serial_carrozado', label: 'Carrozado' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">{label}</Label>
                    <Input
                      placeholder="—"
                      value={(info as any)[key] || ''}
                      onChange={e => setField(key as keyof VehicleInfoExtra, e.target.value.toUpperCase())}
                      className="h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono text-[10px] font-bold"
                    />
                  </div>
                ))}
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4 shadow-sm">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Clase</Label>
                  <Input
                    placeholder="Ej: Automóvil"
                    value={info.clase || ''}
                    onChange={e => setField('clase', e.target.value)}
                    className="h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tipo</Label>
                  <Input
                    placeholder="Ej: Sedan"
                    value={info.tipo || ''}
                    onChange={e => setField('tipo', e.target.value)}
                    className="h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 flex items-start gap-4">
            <Info className="h-4 w-4 text-blue-600 mt-1 shrink-0" />
            <p className="text-[10px] font-bold text-blue-700/80 dark:text-blue-400 uppercase leading-relaxed tracking-tighter">
              Esta información es vital para la generación de contratos de compra-venta y actas de deslinde. Asegúrate de verificar los seriales físicos contra el título.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            disabled={isSaving}
            className="h-11 px-6 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all font-semibold"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || isScanning}
            className="h-11 px-10 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all font-bold gap-2"
          >
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : <><CheckCircle2 className="h-5 w-5" /> Vincular Expediente</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
