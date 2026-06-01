'use client';

import { useEffect, useState } from 'react';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { inviteAdminSchema } from '@/lib/admin-schemas';
import type { AdminRole } from '@/lib/admin-types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Emails already in super_admins (lowercased) — used to prevent duplicates. */
  existingEmails: string[];
};

/** Invites a new platform administrator into super_admins (doc id = email). */
export function InviteAdminDialog({ open, onOpenChange, existingEmails }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('moderator');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail('');
      setRole('moderator');
      setError(null);
    }
  }, [open]);

  const handleInvite = () => {
    const parsed = inviteAdminSchema.safeParse({ email, role });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Datos inválidos');
      return;
    }
    const normalized = parsed.data.email; // already trimmed + lowercased by schema
    if (existingEmails.includes(normalized)) {
      setError('Ya existe un administrador con ese correo.');
      return;
    }
    setDocumentNonBlocking(
      doc(firestore, 'super_admins', normalized),
      {
        email: normalized,
        role: parsed.data.role,
        activo: true,
        created_at: serverTimestamp(),
      },
      { merge: true },
    );
    toast({
      title: 'Administrador invitado',
      description: `${normalized} fue agregado como ${parsed.data.role === 'owner' ? 'propietario' : 'moderador'}. Debe registrarse en Firebase Auth con ese correo para acceder.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">Invitar administrador</DialogTitle>
          <DialogDescription>
            Agrega un correo al equipo de administración global. Crear el registro no crea la cuenta de acceso:
            el invitado debe registrarse en Firebase Auth con ese mismo correo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Correo electrónico</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="moderador@zonamotores.ve"
              className="rounded-xl h-12"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
              <SelectTrigger id="invite-role" className="rounded-xl h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">Moderador</SelectItem>
                <SelectItem value="owner">Propietario</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleInvite}>
            Invitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
