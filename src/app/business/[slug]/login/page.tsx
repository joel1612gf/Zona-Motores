'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useBusinessAuth } from '@/context/business-auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldAlert, Lock, Building2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BusinessLoginPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { toast } = useToast();
  const { concesionario, isLoading, validateEnterprise } = useBusinessAuth();

  const [masterKey, setMasterKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);

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
