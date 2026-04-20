'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, ShieldCheck, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import type { Proveedor } from '@/lib/business-types';
import { cn } from '@/lib/utils';

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Proveedor | null;
  onSaved: () => void;
}

const EMPTY_FORM = {
  nombre: '',
  rif: '',
  direccion: '',
  isRetentionAgent: false,
  porcentaje_retencion_iva: '75',
  contacto_nombre: '',
  contacto_telefono: '',
};

export function SupplierFormDialog({ open, onOpenChange, supplier, onSaved }: SupplierFormDialogProps) {
  const firestore = useFirestore();
  const { concesionario } = useBusinessAuth();
  const { toast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (supplier) {
        setForm({
          nombre: supplier.nombre,
          rif: supplier.rif,
          direccion: supplier.direccion || '',
          isRetentionAgent: supplier.isRetentionAgent ?? (supplier.porcentaje_retencion_iva > 0),
          porcentaje_retencion_iva: String(supplier.porcentaje_retencion_iva || 75),
          contacto_nombre: supplier.contacto_nombre || '',
          contacto_telefono: supplier.contacto_telefono || '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, supplier]);

  const handleSave = async () => {
    if (!concesionario?.id || !form.nombre.trim() || !form.rif.trim()) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Nombre y RIF son obligatorios.' });
      return;
    }
    if (form.isRetentionAgent && !form.direccion.trim()) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'La dirección fiscal es obligatoria para agentes de retención.' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        rif: form.rif.trim(),
        direccion: form.direccion.trim(),
        isRetentionAgent: form.isRetentionAgent,
        porcentaje_retencion_iva: form.isRetentionAgent ? (parseInt(form.porcentaje_retencion_iva) || 75) : 0,
        contacto_nombre: form.contacto_nombre.trim(),
        contacto_telefono: form.contacto_telefono.trim(),
      };

      if (supplier?.id) {
        await updateDoc(doc(firestore, 'concesionarios', concesionario.id, 'proveedores', supplier.id), payload);
        toast({ title: 'Proveedor actualizado' });
      } else {
        await addDoc(collection(firestore, 'concesionarios', concesionario.id, 'proveedores'), { ...payload, created_at: serverTimestamp() });
        toast({ title: 'Proveedor registrado' });
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl p-0 overflow-hidden bg-white/90 backdrop-blur-3xl border-white/40 shadow-2xl rounded-[2.5rem] max-h-[90vh] flex flex-col">
        <DialogHeader className="p-8 pb-4 border-b border-black/5 bg-white/5 shrink-0 relative">
          <DialogTitle className="text-2xl font-bold font-headline text-slate-900 flex items-center gap-3">
             <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
             </div>
             {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </DialogTitle>
          <p className="text-muted-foreground text-sm mt-1 ml-13">{supplier ? 'Actualiza los datos fiscales' : 'Registra un nuevo proveedor en el sistema'}</p>
        </DialogHeader>

        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Razón Social / Nombre Comercial *</Label>
            <Input placeholder="Ej: Importadora VZLA C.A." value={form.nombre} onChange={set('nombre')} className="h-14 rounded-2xl bg-white border-black/5 focus:border-primary/50 text-base font-medium transition-all" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">RIF Fiscal *</Label>
              <Input placeholder="J-12345678-9" value={form.rif} onChange={set('rif')} className="h-14 rounded-2xl bg-white border-black/5 focus:border-primary/50 text-base font-medium font-mono transition-all" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Teléfono de Contacto</Label>
              <Input placeholder="0412-0000000" value={form.contacto_telefono} onChange={set('contacto_telefono')} className="h-14 rounded-2xl bg-white border-black/5 focus:border-primary/50 text-base font-medium transition-all" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Dirección Fiscal {form.isRetentionAgent && '*'}</Label>
            <Input 
              placeholder="Indica la dirección completa para facturación..." 
              value={form.direccion} 
              onChange={set('direccion')} 
              className="h-14 rounded-2xl bg-white border-black/5 focus:border-primary/50 text-base font-medium transition-all"
            />
          </div>

          {/* Retention Agent Toggle */}
          <div className="rounded-[2rem] border border-black/5 p-6 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", form.isRetentionAgent ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-400")}>
                   <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                   <Label className="text-sm font-bold cursor-pointer block" htmlFor="retention-toggle">
                     Agente de Retención de IVA
                   </Label>
                   <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Sujeto a normativa SENIAT</p>
                </div>
              </div>
              <button
                id="retention-toggle"
                type="button"
                role="switch"
                aria-checked={form.isRetentionAgent}
                onClick={() => setForm(prev => ({ ...prev, isRetentionAgent: !prev.isRetentionAgent }))}
                className={cn(
                  "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-inner",
                  form.isRetentionAgent ? 'bg-primary' : 'bg-slate-300'
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300",
                    form.isRetentionAgent ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {form.isRetentionAgent && (
              <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Porcentaje de Retención Aplicado</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, porcentaje_retencion_iva: '75' }))}
                    className={cn(
                      'flex-1 h-12 rounded-xl border-2 font-bold transition-all flex items-center justify-center gap-2',
                      form.porcentaje_retencion_iva === '75' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-400 hover:bg-slate-100'
                    )}
                  >
                    75% <span className="text-[10px] font-normal opacity-60">ESTÁNDAR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, porcentaje_retencion_iva: '100' }))}
                    className={cn(
                      'flex-1 h-12 rounded-xl border-2 font-bold transition-all flex items-center justify-center gap-2',
                      form.porcentaje_retencion_iva === '100' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-400 hover:bg-slate-100'
                    )}
                  >
                    100% <span className="text-[10px] font-normal opacity-60">ESPECIAL</span>
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 text-center uppercase font-black tracking-tighter">
                  Nota: 100% aplica a proveedores sin RIF actualizado o contribuyentes especiales.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nombre de la Persona de Contacto</Label>
            <Input placeholder="Opcional" value={form.contacto_nombre} onChange={set('contacto_nombre')} className="h-14 rounded-2xl bg-white border-black/5 focus:border-primary/50 text-base font-medium transition-all" />
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-black/5 flex items-center justify-end gap-3 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="h-12 rounded-2xl px-6 hover:bg-black/5 font-bold uppercase text-xs tracking-widest text-slate-600">Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="h-12 rounded-2xl px-10 bg-primary shadow-lg shadow-primary/20 font-bold text-white hover:bg-primary/90 transition-all hover:translate-y-[-1px]">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {supplier ? 'Actualizar Datos' : 'Guardar Proveedor'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
