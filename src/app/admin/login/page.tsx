'use client';

import { useCallback, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, type AuthError } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, Lock, Mail, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ==================== Brute-force guard (client-side deterrent) ====================
// Real enforcement is layered: Firebase Auth's own server-side throttling
// (auth/too-many-requests) + the super_admins authorization gate. This adds a
// local lockout so repeated guesses on this device are stopped early.
const MAX_FAILED_ATTEMPTS = 3; // failed tries allowed before lockout
const LOCKOUT_MINUTES = 5; // lockout duration
const LOCKOUT_MS = LOCKOUT_MINUTES * 60 * 1000;
const STORAGE_KEY = 'zm_admin_login_guard';

type Guard = { failed: number; lockUntil: number };

function readGuard(): Guard {
  if (typeof window === 'undefined') return { failed: 0, lockUntil: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { failed: 0, lockUntil: 0 };
    const parsed = JSON.parse(raw) as Partial<Guard>;
    return { failed: Number(parsed.failed) || 0, lockUntil: Number(parsed.lockUntil) || 0 };
  } catch {
    return { failed: 0, lockUntil: 0 };
  }
}

function writeGuard(g: Guard) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(g));
  } catch {
    /* ignore quota/availability errors */
  }
}

function clearGuard() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Acceso bloqueado temporalmente.';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada.';
    default:
      return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AdminLoginPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [failed, setFailed] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(0);

  // Hydrate guard state from localStorage on mount (client only).
  useEffect(() => {
    const g = readGuard();
    setFailed(g.failed);
    setLockUntil(g.lockUntil);
    setNow(Date.now());
  }, []);

  const isLocked = lockUntil > now;
  const remainingMs = isLocked ? lockUntil - now : 0;

  // Tick the countdown while locked; auto-clear the lock when it expires.
  useEffect(() => {
    if (!isLocked) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockUntil) {
        setLockUntil(0);
        setFailed(0);
        clearGuard();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isLocked, lockUntil]);

  const registerFailure = useCallback(
    (code: string) => {
      // Firebase already throttling → lock immediately.
      if (code === 'auth/too-many-requests') {
        const until = Date.now() + LOCKOUT_MS;
        setLockUntil(until);
        setFailed(0);
        writeGuard({ failed: 0, lockUntil: until });
        return;
      }
      const nextFailed = failed + 1;
      if (nextFailed >= MAX_FAILED_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockUntil(until);
        setFailed(0);
        writeGuard({ failed: 0, lockUntil: until });
        toast({
          title: 'Acceso bloqueado',
          description: `Demasiados intentos fallidos. Espera ${LOCKOUT_MINUTES} minutos.`,
          variant: 'destructive',
        });
      } else {
        setFailed(nextFailed);
        writeGuard({ failed: nextFailed, lockUntil: 0 });
        toast({
          title: 'Acceso denegado',
          description: `${authErrorMessage(code)} Te queda${MAX_FAILED_ATTEMPTS - nextFailed === 1 ? '' : 'n'} ${MAX_FAILED_ATTEMPTS - nextFailed} intento(s).`,
          variant: 'destructive',
        });
      }
    },
    [failed, toast],
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (!email.trim() || !password) {
      toast({ title: 'Datos requeridos', description: 'Ingresa tu correo y contraseña.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Awaited sign-in (not the non-blocking helper) so we can react to the result.
      // Authorization is enforced by AdminLayout against super_admins; valid Auth
      // credentials alone grant nothing.
      await signInWithEmailAndPassword(auth, email.trim(), password);
      clearGuard();
      // AdminAuthProvider resolves the role and AdminLayout redirects.
    } catch (err) {
      const code = (err as AuthError)?.code ?? '';
      registerFailure(code);
      setIsSubmitting(false);
    }
  };

  const disabled = isSubmitting || isLocked;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <Card className="w-full max-w-md border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem]">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25 w-fit">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold font-headline tracking-tight">Panel de Administración</CardTitle>
            <CardDescription>Acceso restringido a administradores · sin registro público</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLocked ? (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="h-7 w-7 text-destructive" />
              </div>
              <p className="font-headline text-lg font-bold">Acceso bloqueado</p>
              <p className="text-sm text-muted-foreground">
                Demasiados intentos fallidos. Vuelve a intentarlo en:
              </p>
              <p className="text-3xl font-bold font-headline tabular-nums text-destructive">
                {formatCountdown(remainingMs)}
              </p>
            </div>
          ) : (
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
                  disabled={disabled}
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
                  disabled={disabled}
                  autoComplete="current-password"
                  className="rounded-xl h-12"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full rounded-2xl h-12 shadow-lg shadow-primary/20 font-bold"
                disabled={disabled}
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
              {failed > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  Intentos fallidos: {failed} / {MAX_FAILED_ATTEMPTS}
                </p>
              )}
            </form>
          )}
          <p className="mt-6 text-center text-xs text-muted-foreground">Zona Motores • Centro de Mando</p>
        </CardContent>
      </Card>
    </div>
  );
}
