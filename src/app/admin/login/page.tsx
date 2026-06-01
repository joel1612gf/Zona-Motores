'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, type AuthError } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, Lock, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta de nuevo más tarde.';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada.';
    default:
      return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }
}

export default function AdminLoginPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: 'Datos requeridos', description: 'Ingresa tu correo y contraseña.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Direct (awaited) sign-in — NOT the non-blocking helper, since we must
      // know the result here. Authorization is enforced by AdminLayout against
      // the super_admins collection; valid Auth credentials alone grant nothing.
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // On success the AdminAuthProvider resolves the role and AdminLayout
      // redirects to /admin/dashboard (or expels non-admins to '/').
    } catch (err) {
      const code = (err as AuthError)?.code ?? '';
      toast({ title: 'Acceso denegado', description: authErrorMessage(code), variant: 'destructive' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <Card className="w-full max-w-md border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem]">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25 w-fit">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold font-headline tracking-tight">Panel de Administración</CardTitle>
            <CardDescription>Acceso restringido a administradores de Zona Motores</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@zonamotores.ve"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                autoFocus
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                className="rounded-xl h-12"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-2xl h-12 shadow-lg shadow-primary/20 font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Acceder'
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">Zona Motores • Centro de Mando</p>
        </CardContent>
      </Card>
    </div>
  );
}
