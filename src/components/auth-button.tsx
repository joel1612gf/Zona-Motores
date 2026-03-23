'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { doc, setDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, Loader2, List, Store, Heart, BarChart, Crown, Palette, Sun, Moon, Monitor, ChevronLeft, Check, ArrowRight, Circle, MessageCircle, AlertTriangle } from 'lucide-react';

import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { UserProfile, PLAN_CONFIG } from '@/lib/types';
import { useTheme } from 'next-themes';
import { Separator } from '@/components/ui/separator';

// Country codes for phone selector
const COUNTRY_CODES = [
  { code: '+58', label: 'VE +58' },
  { code: '+1', label: 'US +1' },
  { code: '+57', label: 'CO +57' },
  { code: '+55', label: 'BR +55' },
  { code: '+54', label: 'AR +54' },
  { code: '+56', label: 'CL +56' },
  { code: '+52', label: 'MX +52' },
  { code: '+51', label: 'PE +51' },
  { code: '+593', label: 'EC +593' },
  { code: '+507', label: 'PA +507' },
  { code: '+34', label: 'ES +34' },
  { code: '+39', label: 'IT +39' },
  { code: '+351', label: 'PT +351' },
];

// Normalizes a phone number: removes leading 0, prepends country code
function normalizePhone(raw: string, countryCode: string): string {
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  return `${countryCode}${digits}`;
}

// Password strength indicator component
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const requirements = [
    { label: 'Mínimo 8 caracteres', met: hasMinLength },
    { label: 'Al menos una letra', met: hasLetter },
    { label: 'Al menos una mayúscula', met: hasUppercase },
    { label: 'Al menos un número', met: hasNumber },
  ];

  const unmet = requirements.filter(r => !r.met);

  if (unmet.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mt-1.5">
        <Check className="h-3.5 w-3.5" />
        <span>Contraseña válida</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 mt-1.5">
      {unmet.map((req) => (
        <div key={req.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Circle className="h-3 w-3 text-orange-400 flex-shrink-0" />
          <span>{req.label}</span>
        </div>
      ))}
    </div>
  );
}

function ThemeOptions() {
  const { setTheme } = useTheme();
  return (
    <>
      <DropdownMenuItem onClick={() => setTheme('system')}>
        <Monitor className="mr-2 h-4 w-4" />
        Por defecto
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('light')}>
        <Sun className="mr-2 h-4 w-4" />
        Claro
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme('dark')}>
        <Moon className="mr-2 h-4 w-4" />
        Oscuro
      </DropdownMenuItem>
    </>
  );
}

interface AuthButtonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Password validation schema
const passwordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[a-zA-Z]/, 'Debe contener al menos una letra')
  .regex(/[0-9]/, 'Debe contener al menos un número');

export function AuthButton({ open, onOpenChange }: AuthButtonProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading: userLoading } = useUser();
  const { toast } = useToast();
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'forgotPassword'>('signIn');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signUpStep, setSignUpStep] = useState<1 | 2 | 3>(1);

  // Keeps plan info dialog visible after Firebase auto-logs in the new user
  const [showPlanInfo, setShowPlanInfo] = useState(false);

  // Forgot password
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);

  // Phone country code — using simple state, rendered as native <select>
  const [phoneCountryCode, setPhoneCountryCode] = useState('+58');

  // Cédula prefix
  const [cedulaPrefix, setCedulaPrefix] = useState('V');

  // Cédula conflict state
  const [cedulaConflict, setCedulaConflict] = useState(false);

  const profileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: profileData } = useDoc<UserProfile>(profileRef);

  // --- Sign In form ---
  const signInSchema = z.object({
    email: z.string().email({ message: "Correo inválido." }),
    password: z.string().min(1, { message: "La contraseña es requerida." }),
  });

  const signInForm = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  // --- Sign Up Step 1 form ---
  const signUpStep1Schema = z.object({
    email: z.string().email({ message: "Correo inválido." }),
    password: passwordSchema,
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ['confirmPassword'],
  });

  const signUpStep1Form = useForm<z.infer<typeof signUpStep1Schema>>({
    resolver: zodResolver(signUpStep1Schema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
    mode: 'onChange',
  });

  const watchedPassword = signUpStep1Form.watch('password');

  // --- Sign Up Step 2 form ---
  const signUpStep2Schema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
    phone: z.string().min(7, 'Número de teléfono requerido.'),
    cedulaNumber: z.string().min(5, 'La cédula debe tener al menos 5 dígitos.').max(8, 'La cédula no puede tener más de 8 dígitos.').regex(/^\d+$/, 'Solo números.'),
  });

  const signUpStep2Form = useForm<z.infer<typeof signUpStep2Schema>>({
    resolver: zodResolver(signUpStep2Schema),
    defaultValues: { name: '', phone: '', cedulaNumber: '' },
    mode: 'onChange',
  });

  // Reset countdown timer
  useEffect(() => {
    if (resetCountdown <= 0) return;
    const timer = setInterval(() => setResetCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resetCountdown]);

  // Reset forms when mode changes
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset() refs are stable from react-hook-form
  useEffect(() => {
    signInForm.reset();
    signUpStep1Form.reset();
    signUpStep2Form.reset();
    setSignUpStep(1);
    setResetEmail('');
    setResetSent(false);
  }, [mode]);

  const handleOAuthSignIn = useCallback(async (providerName: 'google' | 'apple') => {
    setIsSubmitting(true);
    const provider = providerName === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
    if (providerName === 'apple') {
      provider.addScope('email');
      provider.addScope('name');
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const additionalInfo = getAdditionalUserInfo(result);

      if (additionalInfo?.isNewUser) {
        const userRef = doc(firestore, 'users', result.user.uid);
        await setDoc(userRef, {
          uid: result.user.uid,
          displayName: result.user.displayName,
          email: result.user.email,
          isVerified: false,
          accountType: 'personal',
        }, { merge: true });
      }

      onOpenChange(false);
      toast({ title: '¡Bienvenido!', description: 'Has iniciado sesión correctamente.' });
    } catch (error: any) {
      console.error(`Error signing in with ${providerName}: `, error);
      let description = `No se pudo iniciar sesión con ${providerName}. Inténtalo de nuevo.`;
      if (error.code === 'auth/account-exists-with-different-credential') {
        description = 'Ya existe una cuenta con este correo pero con un método de inicio de sesión diferente.';
      }
      toast({ title: 'Error de autenticación', description, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }, [auth, firestore, onOpenChange, toast]);

  const handleSignIn = async (values: z.infer<typeof signInSchema>) => {
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: '¡Bienvenido de nuevo!', description: 'Has iniciado sesión correctamente.' });
      onOpenChange(false);
      signInForm.reset();
    } catch (error: any) {
      console.error('Email/password auth error:', error);
      let description = 'Ocurrió un error. Por favor, inténtalo de nuevo.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        description = 'Correo electrónico o contraseña incorrectos.';
      } else if (error.code === 'auth/invalid-email') {
        description = 'El formato del correo electrónico es inválido.';
      }
      toast({ title: 'Error al Iniciar Sesión', description, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpStep1Next = () => {
    setSignUpStep(2);
  };

  const handleSignUpComplete = async (values: z.infer<typeof signUpStep2Schema>) => {
    setIsSubmitting(true);
    setCedulaConflict(false);
    try {
      const step1 = signUpStep1Form.getValues();
      const { email, password } = step1;
      const { name, phone, cedulaNumber } = values;

      const normalizedPhone = normalizePhone(phone, phoneCountryCode);
      const cedula = `${cedulaPrefix}${cedulaNumber}`;

      // Check if cedula is already in use
      const cedulaQuery = query(collection(firestore, 'users'), where('cedula', '==', cedula));
      const cedulaSnapshot = await getDocs(cedulaQuery);
      if (cedulaSnapshot.size > 0) {
        setCedulaConflict(true);
        setIsSubmitting(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name });

        const userRef = doc(firestore, 'users', userCredential.user.uid);
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          displayName: name,
          email: email,
          phone: normalizedPhone,
          cedula: cedula,
          isVerified: false,
          accountType: 'personal',
        }, { merge: true });
      }

      // Show plan info (step 3) — using separate flag so it persists after auto-login
      setShowPlanInfo(true);
    } catch (error: any) {
      console.error('Registration error:', error);
      let description = 'Ocurrió un error. Por favor, inténtalo de nuevo.';
      let title = 'Error al Registrarse';
      if (error.code === 'auth/email-already-in-use') {
        title = 'Correo ya registrado';
        description = 'Este correo ya tiene una cuenta. Te hemos cambiado a la pantalla de inicio de sesión.';
        setMode('signIn');
      }
      toast({ title, description, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) return;
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
      setResetCountdown(60);
      toast({ title: 'Enlace enviado', description: `Se ha enviado un enlace de recuperación a ${resetEmail}.` });
    } catch (error: any) {
      console.error('Password reset error:', error);
      let description = 'No se pudo enviar el enlace. Verifica el correo e inténtalo de nuevo.';
      if (error.code === 'auth/user-not-found') {
        description = 'No existe una cuenta con este correo electrónico.';
      }
      toast({ title: 'Error', description, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Sesión cerrada', description: 'Has cerrado sesión correctamente.' });
    } catch (error) {
      console.error('Error signing out: ', error);
      toast({ title: 'Error', description: 'No se pudo cerrar la sesión.', variant: 'destructive' });
    }
  };

  if (userLoading) {
    return <Button variant="outline" size="icon" disabled><Loader2 className="animate-spin" /></Button>;
  }

  // Post-registration plan info dialog — standalone, persists through auto-login
  if (showPlanInfo) {
    const basicPlan = PLAN_CONFIG.basico;
    return (
      <>
        {user && (
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.photoURL!} alt={user.displayName!} />
              <AvatarFallback><UserIcon /></AvatarFallback>
            </Avatar>
          </Button>
        )}
        <Dialog open onOpenChange={(isOpen) => { if (!isOpen) setShowPlanInfo(false); }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl text-center">¡Cuenta Creada!</DialogTitle>
              <DialogDescription className="text-center">Bienvenido a Zona Motores</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/50 p-5 space-y-3">
                <p className="text-sm font-medium text-center">
                  Actualmente cuentas con el <strong className="text-primary">Plan Básico</strong>
                </p>
                <Separator />
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    Publicar hasta <strong className="text-foreground">{basicPlan.limits.maxListings} vehículos</strong> al mismo tiempo
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    Contactar hasta <strong className="text-foreground">{basicPlan.limits.maxContactsPerMonth} vendedores</strong> al mes
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    Sin perfil de concesionario
                  </li>
                </ul>
              </div>
              <Button className="w-full" size="lg" onClick={() => setShowPlanInfo(false)}>
                Continuar
              </Button>
              <div className="text-center">
                <Button variant="link" className="text-muted-foreground text-sm" asChild>
                  <Link href="/pricing" onClick={() => setShowPlanInfo(false)}>
                    Quiero ver los planes
                  </Link>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={(profileData as any)?.logoUrl || user.photoURL!} alt={user.displayName!} />
              <AvatarFallback><UserIcon /></AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/profile"><UserIcon className="mr-2 h-4 w-4" /><span>Mi Perfil</span></Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/profile/listings"><List className="mr-2 h-4 w-4" /><span>Mis Publicaciones</span></Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/profile/favorites"><Heart className="mr-2 h-4 w-4" /><span>Mis Favoritos</span></Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/pricing"><Crown className="mr-2 h-4 w-4" /><span>Mi Plan</span></Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/profile/stats"><BarChart className="mr-2 h-4 w-4" /><span>Estadísticas</span></Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Palette className="mr-2 h-4 w-4" /><span>Aspecto</span></DropdownMenuSubTrigger>
            <DropdownMenuPortal><DropdownMenuSubContent><ThemeOptions /></DropdownMenuSubContent></DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" /><span>Cerrar sesión</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const resetDialog = () => {
    signInForm.reset();
    signUpStep1Form.reset();
    signUpStep2Form.reset();
    setMode('signIn');
    setSignUpStep(1);
    setResetEmail('');
    setResetSent(false);
    setShowPlanInfo(false);
    setPhoneCountryCode('+58');
    setCedulaPrefix('V');
    setCedulaConflict(false);
  };

  const OAuthButtons = () => (
    <div className="grid grid-cols-2 gap-4">
      <Button variant="outline" type="button" onClick={() => handleOAuthSignIn('google')} disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-76.2 64.5C308.6 106.5 280.2 96 248 96c-88.3 0-160 71.7-160 160s71.7 160 160 160c94.4 0 135.3-64.4 140.8-98.3H248v-85.3h236.1c2.3 12.7 3.9 26.9 3.9 41.4z"></path></svg>}
        Google
      </Button>
      <Button variant="outline" type="button" onClick={() => handleOAuthSignIn('apple')} disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><path fill="currentColor" d="M25.565,9.785c-0.123,0.077-3.051,1.702-3.051,5.305c0.138,4.109,3.695,5.55,3.756,5.55 c-0.061,0.077-0.537,1.963-1.947,3.94C23.204,26.283,21.962,28,20.076,28c-1.794,0-2.438-1.135-4.508-1.135 c-2.223,0-2.852,1.135-4.554,1.135c-1.886,0-3.22-1.809-4.4-3.496c-1.533-2.208-2.836-5.673-2.882-9 c-0.031-1.763,0.307-3.496,1.165-4.968c1.211-2.055,3.373-3.45,5.734-3.496c1.809-0.061,3.419,1.242,4.523,1.242 c1.058,0,3.036-1.242,5.274-1.242C21.394,7.041,23.97,7.332,25.565,9.785z M15.001,6.688c-0.322-1.61,0.567-3.22,1.395-4.247 c1.058-1.242,2.729-2.085,4.17-2.085c0.092,1.61-0.491,3.189-1.533,4.339C18.098,5.937,16.488,6.872,15.001,6.688z"></path></svg>}
        Apple
      </Button>
    </div>
  );

  const OrDivider = () => (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">o continúa con</span>
      </div>
    </div>
  );

  // Native select styles to match the design system
  const nativeSelectClass = "flex h-10 items-center rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  return (
    <>
      <Button variant="secondary" onClick={() => { setMode('signIn'); onOpenChange(true); }}>
        <LogIn className="mr-2 h-4 w-4" />
        Iniciar Sesión
      </Button>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) resetDialog();
        onOpenChange(isOpen);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          {/* =================== SIGN IN =================== */}
          {mode === 'signIn' && (
            <>
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl text-center">Iniciar Sesión</DialogTitle>
                <DialogDescription className="text-center">
                  Para continuar, inicia sesión en tu cuenta de Zona Motores.
                </DialogDescription>
              </DialogHeader>

              <OAuthButtons />
              <OrDivider />

              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                  <FormField control={signInForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="tu@correo.com" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={signInForm.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="text-right">
                    <Button type="button" variant="link" className="p-0 h-auto text-xs text-muted-foreground" onClick={() => setMode('forgotPassword')}>
                      ¿Olvidaste tu contraseña?
                    </Button>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                    Iniciar Sesión
                  </Button>
                </form>
              </Form>

              <div className="mt-2 text-center text-sm">
                ¿No tienes una cuenta?{' '}
                <Button variant="link" className="p-0 h-auto" onClick={() => setMode('signUp')}>Regístrate</Button>
              </div>
            </>
          )}

          {/* =================== FORGOT PASSWORD =================== */}
          {mode === 'forgotPassword' && (
            <>
              <DialogHeader className="relative">
                <Button variant="ghost" size="sm" className="absolute left-0 top-0 p-0 h-auto" onClick={() => setMode('signIn')}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Volver
                </Button>
                <DialogTitle className="font-headline text-2xl text-center pt-8">Recuperar Contraseña</DialogTitle>
                <DialogDescription className="text-center">
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Correo Electrónico</label>
                  <Input type="email" placeholder="tu@correo.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                </div>

                {resetSent ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Enlace enviado a <strong>{resetEmail}</strong>. Revisa tu correo.
                      </p>
                    </div>
                    {resetCountdown > 0 ? (
                      <p className="text-sm text-center text-muted-foreground">Puedes reenviar en {resetCountdown} segundos</p>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={handleForgotPassword} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                        Reenviar enlace
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button className="w-full" onClick={handleForgotPassword} disabled={isSubmitting || !resetEmail}>
                    {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                    Enviar enlace de recuperación
                  </Button>
                )}
              </div>
            </>
          )}

          {/* =================== SIGN UP STEP 1 =================== */}
          {mode === 'signUp' && signUpStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl text-center">Crear Cuenta</DialogTitle>
                <DialogDescription className="text-center">Paso 1 de 2 — Ingresa tus credenciales</DialogDescription>
              </DialogHeader>

              <OAuthButtons />
              <OrDivider />

              <Form {...signUpStep1Form}>
                <form onSubmit={signUpStep1Form.handleSubmit(handleSignUpStep1Next)} className="space-y-4">
                  <FormField control={signUpStep1Form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="tu@correo.com" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={signUpStep1Form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl><Input type="password" placeholder="Mín. 8 caracteres" autoComplete="new-password" {...field} /></FormControl>
                      <PasswordStrength password={watchedPassword || ''} />
                    </FormItem>
                  )} />
                  <FormField control={signUpStep1Form.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Contraseña</FormLabel>
                      <FormControl><Input type="password" placeholder="Repite tu contraseña" autoComplete="new-password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={!signUpStep1Form.formState.isValid}>
                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </Form>

              <div className="mt-2 text-center text-sm">
                ¿Ya tienes una cuenta?{' '}
                <Button variant="link" className="p-0 h-auto" onClick={() => setMode('signIn')}>Inicia Sesión</Button>
              </div>
            </>
          )}

          {/* =================== SIGN UP STEP 2 =================== */}
          {mode === 'signUp' && signUpStep === 2 && (
            <>
              <DialogHeader className="relative">
                <Button variant="ghost" size="sm" className="absolute left-0 top-0 p-0 h-auto" onClick={() => setSignUpStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Volver
                </Button>
                <DialogTitle className="font-headline text-2xl text-center pt-8">Completa tu perfil</DialogTitle>
                <DialogDescription className="text-center">Paso 2 de 2 — Datos personales</DialogDescription>
              </DialogHeader>

              <Form {...signUpStep2Form}>
                <form onSubmit={signUpStep2Form.handleSubmit(handleSignUpComplete)} className="space-y-4">
                  <FormField control={signUpStep2Form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Ej: Juan Perez" autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  {/* Phone with native <select> for country code — avoids Radix portal conflicts */}
                  <FormField control={signUpStep2Form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Teléfono</FormLabel>
                      <div className="flex gap-2">
                        <select
                          value={phoneCountryCode}
                          onChange={(e) => setPhoneCountryCode(e.target.value)}
                          className={`${nativeSelectClass} w-[100px] flex-shrink-0`}
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>{c.label}</option>
                          ))}
                        </select>
                        <FormControl>
                          <Input type="tel" placeholder="4241234567" autoComplete="tel" {...field} />
                        </FormControl>
                      </div>
                      <p className="text-xs text-muted-foreground">Sin el 0 inicial ni el código de país.</p>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Cédula with native <select> for prefix */}
                  <FormField control={signUpStep2Form.control} name="cedulaNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cédula de Identidad</FormLabel>
                      <div className="flex gap-2">
                        <select
                          value={cedulaPrefix}
                          onChange={(e) => { setCedulaPrefix(e.target.value); setCedulaConflict(false); }}
                          className={`${nativeSelectClass} w-[70px] flex-shrink-0`}
                        >
                          <option value="V">V</option>
                          <option value="E">E</option>
                          <option value="J">J</option>
                        </select>
                        <FormControl>
                          <Input type="text" placeholder="12345678" inputMode="numeric" {...field} onChange={(e) => { field.onChange(e); setCedulaConflict(false); }} />
                        </FormControl>
                      </div>
                      <p className="text-xs text-muted-foreground">La cédula no se podrá cambiar después.</p>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Cédula conflict UI */}
                  {cedulaConflict && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-700 dark:text-red-300">
                            Esta cédula ya está en uso
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ¿Esta sí es mi cédula y no está en uso?
                          </p>
                        </div>
                      </div>
                      <div className="rounded-md border bg-card p-4 space-y-2">
                        <p className="text-sm text-center text-muted-foreground">
                          Si necesitas ayuda, escríbenos y te asistimos
                        </p>
                        <Button
                          type="button"
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => window.open('https://wa.me/584221756187', '_blank')}
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Contactar por WhatsApp
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting || !signUpStep2Form.formState.isValid || cedulaConflict}>
                    {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                    Confirmar Registro
                  </Button>
                </form>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
