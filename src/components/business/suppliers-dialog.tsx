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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Building2, Phone, Percent, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import type { Proveedor } from '@/lib/business-types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SuppliersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM = { nombre: '', rif: '', porcentaje_retencion_iva: '75', contacto_nombre: '', contacto_telefono: '', direccion: '' };

export function SuppliersDialog({ open, onOpenChange }: SuppliersDialogProps) {
  const firestore = useFirestore();
  const { concesionario } = useBusinessAuth();
  const { toast } = useToast();

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState('');

  const colRef = () => collection(firestore, 'concesionarios', concesionario!.id, 'proveedores');

  const load = async () => {
    if (!concesionario?.id) return;
    setIsLoading(true);
    try {
      const snap = await getDocs(query(colRef(), orderBy('nombre', 'asc')));
      setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Proveedor)));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (p: Proveedor) => { setEditing(p); setForm({ nombre: p.nombre, rif: p.rif, porcentaje_retencion_iva: String(p.porcentaje_retencion_iva), contacto_nombre: p.contacto_nombre || '', contacto_telefono: p.contacto_telefono || '', direccion: p.direccion || '' }); setShowForm(true); };

  const handleSave = async () => {
    const retencion = parseInt(form.porcentaje_retencion_iva) || 0;
    const requiereDireccion = retencion > 0;

    if (!concesionario?.id || !form.nombre.trim() || !form.rif.trim()) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Nombre y RIF son obligatorios.' });
      return;
    }
    
    if (requiereDireccion && (!form.direccion || !form.direccion.trim())) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'La Dirección Fiscal es obligatoria para agentes de retención.' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        rif: form.rif.trim(),
        porcentaje_retencion_iva: retencion,
        contacto_nombre: form.contacto_nombre.trim(),
        contacto_telefono: form.contacto_telefono.trim(),
        direccion: form.direccion?.trim() || '',
      };
      if (editing?.id) {
        await updateDoc(doc(colRef(), editing.id), payload);
      } else {
        await addDoc(colRef(), { ...payload, created_at: serverTimestamp() });
      }
      toast({ title: editing?.id ? 'Proveedor actualizado' : 'Proveedor registrado' });
      setShowForm(false);
      await load();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!concesionario?.id) return;
    try {
      await deleteDoc(doc(colRef(), id));
      toast({ title: 'Proveedor eliminado' });
      await load();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al eliminar' });
    }
  };

  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Proveedores
            </DialogTitle>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" /> Nuevo Proveedor
            </Button>
          </div>
        </DialogHeader>

        {/* Form */}
        {showForm && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3 mb-2">
            <p className="font-semibold text-sm">{editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nombre / Razón Social *</Label>
                <Input placeholder="ej: Repuestos Delta C.A." value={form.nombre} onChange={set('nombre')} />
              </div>
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <Label>RIF *</Label>
                <Input placeholder="ej: J-123456789-0" value={form.rif} onChange={set('rif')} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Dirección Fiscal {parseInt(form.porcentaje_retencion_iva) > 0 ? '*' : ''}</Label>
                <Input placeholder="ej: Av. Principal, Local 4..." value={form.direccion} onChange={set('direccion')} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Percent className="h-3.5 w-3.5" /> % Retención IVA</Label>
                <Select value={form.porcentaje_retencion_iva} onValueChange={v => setForm(p => ({ ...p, porcentaje_retencion_iva: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (Sin retención)</SelectItem>
                    <SelectItem value="75">75% (Agente de Retención)</SelectItem>
                    <SelectItem value="100">100% (Contribuyente Especial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contacto (nombre)</Label>
                <Input placeholder="ej: Carlos Pérez" value={form.contacto_nombre} onChange={set('contacto_nombre')} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Teléfono / WhatsApp</Label>
                <Input placeholder="ej: 04141234567" value={form.contacto_telefono} onChange={set('contacto_telefono')} />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Guardar
              </Button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Buscar proveedor por nombre o RIF..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : proveedores.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No hay proveedores registrados.</p>
          ) : proveedores
              .filter(p => !searchQuery.trim() || `${p.nombre} ${p.rif}`.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3 bg-card hover:bg-muted/40 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.nombre}</p>
                <p className="text-xs text-muted-foreground">{p.rif} · Retención IVA: {p.porcentaje_retencion_iva}%</p>
                {p.contacto_telefono && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />{p.contacto_telefono}
                    {p.contacto_nombre && ` (${p.contacto_nombre})`}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
                      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(p.id)}>
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
