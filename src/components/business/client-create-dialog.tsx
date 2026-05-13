'use client';

import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';
import { Loader2, Save, UserPlus } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Cliente } from '@/lib/business-types';

const schema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  apellido: z.string().min(1, 'Apellido requerido'),
  cedula_rif: z.string().min(1, 'Cédula/RIF requerido'),
  telefono: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  concesionarioId: string;
  onCreated?: (cliente: Cliente) => void;
}

export function ClientCreateDialog({ open, onOpenChange, concesionarioId, onCreated }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cedulaRif, setCedulaRif] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setNombre('');
    setApellido('');
    setCedulaRif('');
    setTelefono('');
    setEmail('');
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      cedula_rif: cedulaRif.trim(),
      telefono: telefono.trim() || undefined,
      email: email.trim() || undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path.join('.')] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const docRef = await addDoc(collection(firestore, 'concesionarios', concesionarioId, 'clientes'), {
        nombre: parsed.data.nombre,
        apellido: parsed.data.apellido,
        cedula_rif: parsed.data.cedula_rif,
        telefono: parsed.data.telefono ?? null,
        email: parsed.data.email || null,
        compras_ids: [],
        total_invertido: 0,
        traspaso_pendiente: false,
        tags: [],
        vehiculos_requeridos: [],
        created_at: serverTimestamp(),
      });
      toast({ title: 'Cliente creado', description: 'Abriendo perfil 360°.' });
      const created: Cliente = {
        id: docRef.id,
        nombre: parsed.data.nombre,
        apellido: parsed.data.apellido,
        cedula_rif: parsed.data.cedula_rif,
        telefono: parsed.data.telefono,
        email: parsed.data.email || undefined,
        compras_ids: [],
        total_invertido: 0,
        traspaso_pendiente: false,
        tags: [],
        vehiculos_requeridos: [],
        created_at: { toDate: () => new Date() } as any,
      };
      onCreated?.(created);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo crear el cliente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <UserPlus className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="font-headline text-xl font-bold tracking-tight">Nuevo cliente</DialogTitle>
              <DialogDescription className="text-sm font-medium">Datos básicos. Wishlist y bitácora se añaden después.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre *</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1" />
              {errors.nombre && <p className="text-[11px] text-red-600 mt-1 font-bold">{errors.nombre}</p>}
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Apellido *</Label>
              <Input value={apellido} onChange={e => setApellido(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1" />
              {errors.apellido && <p className="text-[11px] text-red-600 mt-1 font-bold">{errors.apellido}</p>}
            </div>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cédula / RIF *</Label>
            <Input value={cedulaRif} onChange={e => setCedulaRif(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1 font-mono" placeholder="V-12345678" />
            {errors.cedula_rif && <p className="text-[11px] text-red-600 mt-1 font-bold">{errors.cedula_rif}</p>}
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teléfono</Label>
            <Input value={telefono} onChange={e => setTelefono(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1" placeholder="+58 412..." />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1" />
            {errors.email && <p className="text-[11px] text-red-600 mt-1 font-bold">{errors.email}</p>}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" className="rounded-xl font-bold border-slate-200" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="rounded-xl h-11 px-6 font-bold shadow-lg shadow-primary/20 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Crear cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
