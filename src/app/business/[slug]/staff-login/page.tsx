'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useBusinessAuth } from '@/context/business-auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, UserRound, LogOut, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, type StaffMember } from '@/lib/business-types';
import { cn } from '@/lib/utils';

export default function StaffLoginPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { toast } = useToast();
  const { concesionario, staffList, isLoading, validateStaffPin, logout } = useBusinessAuth();

  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleStaffSelect = (member: StaffMember) => {
    setSelectedStaff(member);
    setPin('');
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !pin.trim()) return;

    if (pin.length < 4 || pin.length > 6) {
      toast({
        title: 'PIN inválido',
        description: 'El PIN debe tener entre 4 y 6 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    try {
      const success = await validateStaffPin(selectedStaff.id, pin);
      if (success) {
        toast({
          title: `¡Bienvenido, ${selectedStaff.nombre}!`,
          description: `Sesión iniciada como ${ROLE_LABELS[selectedStaff.rol]}.`,
        });
        router.push(`/business/${slug}/dashboard`);
      } else {
        toast({
          title: 'PIN incorrecto',
          description: 'El PIN ingresado no es válido. Inténtalo de nuevo.',
          variant: 'destructive',
        });
        setPin('');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Ocurrió un error. Inténtalo de nuevo.',
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Header */}
      <div className="text-center mb-8 space-y-2">
        {concesionario?.logo_url && (
          <div className="mx-auto relative h-16 w-16 rounded-xl overflow-hidden bg-muted shadow-md mb-4">
            <Image src={concesionario.logo_url} alt="" fill className="object-cover" />
          </div>
        )}
        <h1 className="text-2xl font-bold">{concesionario?.nombre_empresa}</h1>
        <p className="text-muted-foreground">Selecciona tu perfil para continuar</p>
      </div>

      {/* Staff Grid */}
      {staffList.length === 0 ? (
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Sin personal registrado</CardTitle>
            <CardDescription>
              No hay empleados registrados en este concesionario. Contacta al administrador.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-3xl w-full">
          {staffList.map((member) => (
            <button
              key={member.id}
              onClick={() => handleStaffSelect(member)}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 bg-card transition-all duration-200",
                "hover:border-primary hover:shadow-lg hover:scale-[1.02]",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                "active:scale-95"
              )}
            >
              <div className="relative h-20 w-20 rounded-full overflow-hidden bg-muted shadow-inner">
                {member.foto_url ? (
                  <Image src={member.foto_url} alt="" fill className="object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-primary/10">
                    <UserRound className="h-10 w-10 text-primary" />
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm truncate max-w-[120px]">{member.nombre}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[member.rol]}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Logout link */}
      <Button
        variant="ghost"
        size="sm"
        className="mt-8 text-muted-foreground"
        onClick={() => {
          logout();
          router.push(`/business/${slug}/login`);
        }}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Cambiar de empresa
      </Button>

      {/* PIN Dialog */}
      <Dialog open={!!selectedStaff} onOpenChange={(open) => !open && setSelectedStaff(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-center">
            {selectedStaff?.foto_url ? (
              <div className="mx-auto relative h-20 w-20 rounded-full overflow-hidden bg-muted mb-2">
                <Image src={selectedStaff.foto_url} alt="" fill className="object-cover" />
              </div>
            ) : (
              <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <UserRound className="h-10 w-10 text-primary" />
              </div>
            )}
            <DialogTitle>{selectedStaff?.nombre}</DialogTitle>
            <DialogDescription>
              Ingresa tu PIN para acceder como {selectedStaff ? ROLE_LABELS[selectedStaff.rol] : ''}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePinSubmit} className="space-y-4 mt-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-muted-foreground shrink-0" />
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                disabled={isValidating}
                autoFocus
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isValidating || pin.length < 4}>
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Full screen loading overlay */}
      {isValidating && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
          <p className="text-xl font-headline font-bold text-foreground">Accediendo al sistema...</p>
          <p className="text-sm text-muted-foreground mt-2">Verificando sesión</p>
        </div>
      )}
    </div>
  );
}
