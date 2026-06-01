'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import { hashSHA256 } from '@/lib/business-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShieldAlert, Lock, Building2, AlertTriangle, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BusinessLoginPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { concesionario, isLoading, validateEnterprise, loadConcesionario } = useBusinessAuth();

  const [masterKey, setMasterKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // Master-key reset mini-flow: an admin nulled clave_maestra_hash; the client
  // must define a new key here before logging in (onboarding is already complete).
  const [newKey, setNewKey] = useState('');
  const [newKeyConfirm, setNewKeyConfirm] = useState('');
  const [isSettingKey, setIsSettingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const needsNewKey =
    !!concesionario && concesionario.onboarding_completado === true && concesionario.clave_maestra_hash == null;

  const handleSetNewKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concesionario) return;
    if (newKey.length < 6) {
      setKeyError('La clave maestra debe tener al menos 6 caracteres.');
      return;
    }
    if (newKey !== newKeyConfirm) {
      setKeyError('Las claves no coinciden.');
      return;
    }
    setKeyError(null);
    setIsSettingKey(true);
    try {
      await updateDoc(doc(firestore, 'concesionarios', concesionario.id), {
        clave_maestra_hash: await hashSHA256(newKey),
      });
      await loadConcesionario(slug);
      // The reset condition is now false → the normal login form renders below,
      // prefilled with the new key so the client only has to press "Acceder".
      setMasterKey(newKey);
      toast({ title: 'Clave maestra definida', description: 'Ingresa para acceder al sistema.' });
    } catch {
      setKeyError('No se pudo guardar la clave. Inténtalo de nuevo.');
    } finally {
      setIsSettingKey(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKey.trim()) {
      toast({
        title: 'Clave requerida',
        description: 'Ingresa la clave maestra de la empresa.',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    try {
      const success = await validateEnterprise(slug, masterKey);
      if (success) {
        toast({ title: '¡Acceso concedido!', description: 'Selecciona tu perfil para continuar.' });
        router.push(`/business/${slug}/staff-login`);
      } else {
        toast({
          title: 'Acceso denegado',
          description: 'La clave maestra es incorrecta o la suscripción no está activa.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al validar. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Concesionario not found
  if (!concesionario) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Empresa no encontrada</CardTitle>
            <CardDescription>
              No existe ningún concesionario registrado con el identificador &quot;{slug}&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Verifica que la URL sea correcta o contacta al administrador de Zona Motores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Plan not active
  if (!concesionario.plan_activo) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            {concesionario.logo_url && (
              <div className="mx-auto mb-4 relative h-20 w-20 rounded-xl overflow-hidden bg-muted">
                <Image src={concesionario.logo_url} alt="" fill className="object-cover" />
              </div>
            )}
            <CardTitle>{concesionario.nombre_empresa}</CardTitle>
            <CardDescription className="text-destructive font-medium flex items-center justify-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Suscripción inactiva
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              La suscripción de esta empresa no está activa. Contacta al administrador de Zona Motores para renovar el acceso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Master-key reset → ask the client to define a new one before logging in.
  if (needsNewKey) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-amber-500/5 via-background to-primary/10">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center shadow-md">
              <KeyRound className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Definir nueva clave maestra</CardTitle>
              <CardDescription>
                Tu clave maestra fue reseteada. Crea una nueva para volver a acceder.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetNewKey} className="space-y-5">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Anótala en un lugar seguro</AlertTitle>
                <AlertDescription>
                  No podrás cambiarla luego desde el sistema. Si la olvidas, deberás pedir otro
                  reseteo al administrador.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="new-key">Nueva clave maestra</Label>
                <Input
                  id="new-key"
                  type="password"
                  value={newKey}
                  onChange={(e) => {
                    setNewKey(e.target.value);
                    setKeyError(null);
                  }}
                  placeholder="Mínimo 6 caracteres"
                  disabled={isSettingKey}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-key-confirm">Confirmar nueva clave</Label>
                <Input
                  id="new-key-confirm"
                  type="password"
                  value={newKeyConfirm}
                  onChange={(e) => {
                    setNewKeyConfirm(e.target.value);
                    setKeyError(null);
                  }}
                  placeholder="Repite la clave"
                  disabled={isSettingKey}
                />
              </div>
              {keyError && <p className="text-sm text-destructive">{keyError}</p>}
              <Button type="submit" className="w-full" size="lg" disabled={isSettingKey}>
                {isSettingKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Definir clave'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          {concesionario.logo_url ? (
            <div className="mx-auto relative h-24 w-24 rounded-2xl overflow-hidden bg-muted shadow-md">
              <Image src={concesionario.logo_url} alt="" fill className="object-cover" />
            </div>
          ) : (
            <div className="mx-auto h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center shadow-md">
              <Building2 className="h-12 w-12 text-primary" />
            </div>
          )}
          <div>
            <CardTitle className="text-2xl font-bold">{concesionario.nombre_empresa}</CardTitle>
            <CardDescription>Ingresa la clave maestra para acceder al sistema</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="masterKey" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Clave Maestra
              </Label>
              <Input
                id="masterKey"
                type="password"
                placeholder="Ingresa la clave de la empresa"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                disabled={isValidating}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : (
                'Acceder'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Zona Motores Business • Sistema de Gestión
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Full screen loading overlay */}
      {isValidating && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
          <p className="text-xl font-headline font-bold text-foreground">Accediendo al sistema...</p>
          <p className="text-sm text-muted-foreground mt-2">Verificando credenciales</p>
        </div>
      )}
    </div>
  );
}
