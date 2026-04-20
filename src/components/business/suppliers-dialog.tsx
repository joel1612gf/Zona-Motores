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
import { Loader2, Plus, Pencil, Trash2, Building2, Phone, Percent, Search, MapPin, User, ChevronRight } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white/70 backdrop-blur-2xl border-slate-200/60 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] rounded-[2.5rem]">
        <div className="p-8 pb-6 border-b border-slate-100 bg-gradient-to-b from-blue-50/50 to-transparent shrink-0">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 ring-1 ring-blue-600/20">
                    <Building2 className="h-6 w-6" />
                  </div>
                  Gestión de Proveedores
                </DialogTitle>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-widest ml-14">Directorio y Configuración Fiscal</p>
              </div>
              <Button onClick={openNew} className="rounded-2xl h-12 px-6 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 font-bold transition-all active:scale-95 self-start sm:self-center">
                <Plus className="h-5 w-5 mr-2" /> Nuevo Proveedor
              </Button>
            </div>
          </DialogHeader>

          {/* Search Header */}
          {!showForm && (
            <div className="mt-8 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <Input
                className="w-full pl-12 pr-4 h-14 text-base bg-white/50 border-slate-200 focus:border-blue-500/50 focus:ring-blue-500/10 rounded-2xl transition-all shadow-sm"
                placeholder="Buscar por nombre, RIF o teléfono..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
          {/* Form Section */}
          {showForm && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500 mb-8">
              <div className="rounded-[2rem] border border-blue-100 bg-blue-50/30 p-8 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    {editing ? 'Modificar Proveedor' : 'Registrar Nuevo Proveedor'}
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Razón Social / Nombre Comercial *</Label>
                    <Input placeholder="Ej: Repuestos Delta C.A." value={form.nombre} onChange={set('nombre')} className="h-12 rounded-xl bg-white border-slate-200" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">RIF Fiscal *</Label>
                    <Input placeholder="J-12345678-0" value={form.rif} onChange={set('rif')} className="h-12 rounded-xl bg-white border-slate-200 font-mono" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">% Retención IVA</Label>
                    <Select value={form.porcentaje_retencion_iva} onValueChange={v => setForm(p => ({ ...p, porcentaje_retencion_iva: v }))}>
                      <SelectTrigger className="h-12 rounded-xl bg-white border-slate-200 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="0" className="font-medium">0% (Sin retención)</SelectItem>
                        <SelectItem value="75" className="font-bold text-blue-600">75% (Agente Estándar)</SelectItem>
                        <SelectItem value="100" className="font-bold text-blue-700">100% (Contribuyente Especial)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Dirección Fiscal {parseInt(form.porcentaje_retencion_iva) > 0 ? '*' : ''}</Label>
                    <Input placeholder="Calle, Local, Ciudad..." value={form.direccion} onChange={set('direccion')} className="h-12 rounded-xl bg-white border-slate-200" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Contacto Principal</Label>
                    <Input placeholder="Nombre de contacto" value={form.contacto_nombre} onChange={set('contacto_nombre')} className="h-12 rounded-xl bg-white border-slate-200" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Teléfono / WhatsApp</Label>
                    <Input placeholder="0412-0000000" value={form.contacto_telefono} onChange={set('contacto_telefono')} className="h-12 rounded-xl bg-white border-slate-200" />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-blue-100/50">
                  <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl h-11 px-6 font-bold text-slate-500">Cancelar</Button>
                  <Button onClick={handleSave} disabled={isSaving} className="rounded-xl h-11 px-10 bg-blue-600 shadow-md font-bold">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* List Section */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-500 opacity-50" />
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sincronizando proveedores...</span>
              </div>
            ) : proveedores.length === 0 ? (
              <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No hay registros</p>
                <p className="text-slate-400 text-xs mt-1">Comienza agregando un proveedor para tus compras.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {proveedores
                  .filter(p => !searchQuery.trim() || `${p.nombre} ${p.rif} ${p.contacto_telefono}`.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(p => (
                  <div key={p.id} className="group relative overflow-hidden bg-white/40 border border-slate-100 hover:border-blue-200 hover:bg-white hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.05)] rounded-3xl p-5 transition-all duration-500 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-start gap-5 flex-1 min-w-0">
                      <div className="p-4 rounded-2xl bg-slate-100 text-slate-500 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-200 transition-all duration-500 shrink-0">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-slate-900 font-black text-xl tracking-tight truncate max-w-full">
                            {p.nombre}
                          </h4>
                          <Badge variant="outline" className={cn(
                            "px-2.5 py-0.5 rounded-lg font-bold text-[10px] uppercase tracking-tighter",
                            p.porcentaje_retencion_iva > 0 
                              ? "bg-blue-50 text-blue-600 border-blue-100" 
                              : "bg-slate-50 text-slate-400 border-slate-100"
                          )}>
                            {p.porcentaje_retencion_iva > 0 ? `Retención: ${p.porcentaje_retencion_iva}%` : 'Sin Retención'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                          <span className="flex items-center gap-2 font-bold text-slate-700">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">RIF</span> {p.rif}
                          </span>
                          {p.contacto_telefono && (
                            <span className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-blue-500/50" />
                              <span className="font-medium italic">{p.contacto_telefono} {p.contacto_nombre && `(${p.contacto_nombre})`}</span>
                            </span>
                          )}
                          {p.direccion && (
                            <span className="flex items-center gap-2 truncate">
                              <MapPin className="h-4 w-4 text-blue-500/50" />
                              <span className="font-medium truncate">{p.direccion}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 shrink-0">
                      <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 transition-all" onClick={() => openEdit(p)}>
                        <Pencil className="h-5 w-5" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 transition-all">
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2rem] border-rose-100 bg-white/95 backdrop-blur-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                              <div className="p-2 rounded-lg bg-rose-100 text-rose-600"><Trash2 className="h-5 w-5" /></div>
                              ¿Eliminar Proveedor?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-500">
                              Esta acción eliminará permanentemente a <strong>{p.nombre}</strong>. No afectará las facturas históricas ya registradas con este proveedor.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 rounded-xl font-bold" onClick={() => handleDelete(p.id)}>
                              Sí, Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                         <ChevronRight className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
