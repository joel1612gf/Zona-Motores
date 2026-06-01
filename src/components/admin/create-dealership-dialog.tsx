'use client';

import { useEffect, useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { createDealershipSchema } from '@/lib/admin-schemas';
import { DEFAULT_CONCESIONARIO_CONFIG } from '@/lib/business-types';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link2 } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Creates a blank tenant (concesionario). Only asks for slug, monthly fee and
 * billing day; the document is seeded with onboarding_completado:false so the
 * client is forced through the onboarding wizard on first entry.
 */
export function CreateDealershipDialog({ open, onOpenChange }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [slug, setSlug] = useState('');
  const [precio, setPrecio] = useState('');
  const [diaCobro, setDiaCobro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSlug('');
      setPrecio('');
      setDiaCobro('');
      setError(null);
      setIsSaving(false);
    }
  }, [open]);

  const handleSave = async () => {
    setError(null);
    const parsed = createDealershipSchema.safeParse({
      slug,
      precio_mensual_usd: precio,
      dia_cobro_mensual: diaCobro,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Datos inválidos');
      return;
    }

    const { slug: cleanSlug, precio_mensual_usd, dia_cobro_mensual } = parsed.data;
    setIsSaving(true);
    try {
      // Slug must be unique (it is both the URL and the document ID).
      const dupSnap = await getDocs(
        query(collection(firestore, 'concesionarios'), where('slug', '==', cleanSlug)),
      );
      if (!dupSnap.empty) {
        setError('Ya existe un concesionario con ese slug.');
        setIsSaving(false);
        return;
      }

      await setDoc(doc(firestore, 'concesionarios', cleanSlug), {
        slug: cleanSlug,
        nombre_empresa: '',
        owner_uid: '',
        clave_maestra_hash: null,
        plan_activo: true,
        onboarding_completado: false,
        precio_mensual_usd,
        dia_cobro_mensual,
        configuracion: DEFAULT_CONCESIONARIO_CONFIG,
        created_at: serverTimestamp(),
      });

      toast({
        title: 'Concesionario creado',
        description: `/${cleanSlug} — el cliente completará la configuración al ingresar.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error('[CreateDealership] Error:', err);
      setError('No se pudo crear el concesionario. Inténtalo de nuevo.');
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">Nuevo Concesionario</DialogTitle>
          <DialogDescription>
            Crea un cliente vacío del SaaS. Solo defines la URL y el cobro; el cliente configura el
            resto en su primer acceso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="dealer-slug" className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              Slug (URL)
            </Label>
            <div className="flex items-center gap-1 rounded-xl border bg-muted/30 px-3 h-12">
              <span className="text-sm text-muted-foreground shrink-0">/business/</span>
              <Input
                id="dealer-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  setError(null);
                }}
                placeholder="mi-concesionario"
                className="border-0 bg-transparent px-0 h-auto focus-visible:ring-0 shadow-none"
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dealer-precio">Tarifa mensual (USD)</Label>
              <Input
                id="dealer-precio"
                type="number"
                min="0"
                step="0.01"
                value={precio}
                onChange={(e) => {
                  setPrecio(e.target.value);
                  setError(null);
                }}
                placeholder="25"
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealer-dia">Día de cobro (1–31)</Label>
              <Input
                id="dealer-dia"
                type="number"
                min="1"
                max="31"
                step="1"
                value={diaCobro}
                onChange={(e) => {
                  setDiaCobro(e.target.value);
                  setError(null);
                }}
                placeholder="5"
                className="rounded-xl h-12"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-xl font-bold shadow-lg shadow-primary/20"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Concesionario'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
