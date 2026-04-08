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
import { Loader2, Building2, ShieldCheck } from 'lucide-react';
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Razón Social / Nombre <span className="text-red-500">*</span></Label>
            <Input placeholder="Ej: Importadora VZLA C.A." value={form.nombre} onChange={set('nombre')} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>RIF <span className="text-red-500">*</span></Label>
              <Input placeholder="J-12345678-9" value={form.rif} onChange={set('rif')} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Dirección Fiscal {form.isRetentionAgent && <span className="text-red-500">*</span>}</Label>
            <Input 
              placeholder="Ej: Sabana Grande, Centro Comercial El Recreo, Torre Norte, Piso 12..." 
              value={form.direccion} 
              onChange={set('direccion')} 
            />
          </div>

          {/* Retention Agent Toggle */}
          <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold cursor-pointer" htmlFor="retention-toggle">
                  ¿Es Agente de Retención de IVA?
                </Label>
              </div>
              <button
                id="retention-toggle"
                type="button"
                role="switch"
                aria-checked={form.isRetentionAgent}
                onClick={() => setForm(prev => ({ ...prev, isRetentionAgent: !prev.isRetentionAgent }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  form.isRetentionAgent ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.isRetentionAgent ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {form.isRetentionAgent && (
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">Porcentaje de Retención (SENIAT)</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, porcentaje_retencion_iva: '75' }))}
                    className={`flex-1 rounded-md border-2 py-2 text-sm font-semibold transition-colors ${
                      form.porcentaje_retencion_iva === '75'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    75% <span className="text-xs font-normal">(Estándar)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, porcentaje_retencion_iva: '100' }))}
                    className={`flex-1 rounded-md border-2 py-2 text-sm font-semibold transition-colors ${
                      form.porcentaje_retencion_iva === '100'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    100% <span className="text-xs font-normal">(Especial)</span>
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  75% aplica al 90% de las empresas. 100% para proveedores sin RIF actualizado.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Nombre Contacto</Label>
              <Input placeholder="Opcional" value={form.contacto_nombre} onChange={set('contacto_nombre')} />
            </div>
            <div className="grid gap-2">
              <Label>Teléfono</Label>
              <Input placeholder="Opcional" value={form.contacto_telefono} onChange={set('contacto_telefono')} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
