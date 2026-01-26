'use client';

import { useState, useEffect } from 'react';
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
  updateProfile,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, Loader2, List, Store } from 'lucide-react';

import { useAuth, useUser, useFirestore } from '@/firebase';
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
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface AuthButtonProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AuthButton({ open, onOpenChange }: AuthButtonProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signUpStep, setSignUpStep] = useState<'type' | 'details'>('type');
  const [accountType, setAccountType] = useState<'personal' | 'dealer' | null>(null);

  const formSchema = z.object({
    name: z.string().optional(),
    email: z.string().email({ message: "Por favor, introduce un correo válido." }),
    password: z.string().min(1, { message: "La contraseña es requerida." }),
  }).superRefine((data, ctx) => {
      if (mode === 'signUp') {
          if (!data.name || data.name.length < 2) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: "El nombre debe tener al menos 2 caracteres." });
          }
          if (data.password.length < 6) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: "La contraseña debe tener al menos 6 caracteres." });
          }
      }
  });
  
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    form.reset();
  }, [mode, form]);


  const handleOAuthSignIn = async (providerName: 'google' | 'apple') => {
    setIsSubmitting(true);
    const provider = providerName === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
    if (providerName === 'apple') {
      provider.addScope('email');
      provider.addScope('name');
    }
    
    try {
      const result = await signInWithPopup(auth, provider);
      const additionalInfo = getAdditionalUserInfo(result);
      
      if (mode === 'signUp' && additionalInfo?.isNewUser && accountType) {
        const userRef = doc(firestore, 'users', result.user.uid);
        await setDoc(userRef, {
            uid: result.user.uid,
            displayName: result.user.displayName,
            email: result.user.email,
            isVerified: false,
            accountType: accountType,
        }, { merge: true });
      }

      onOpenChange(false);
      toast({
        title: '¡Bienvenido!',
        description: 'Has iniciado sesión correctamente.',
      });
    } catch (error: any) {
      console.error(`Error signing in with ${providerName}: `, error);
      let description = `No se pudo iniciar sesión con ${providerName}. Inténtalo de nuevo.`;
      if (error.code === 'auth/account-exists-with-different-credential') {
        description = 'Ya existe una cuenta con este correo electrónico pero con un método de inicio de sesión diferente.';
      }
      toast({
        title: 'Error de autenticación',
        description: description,
        variant: 'destructive',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
        if (mode === 'signUp') {
            const { name, email, password } = values;
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            if (userCredential.user) {
              await updateProfile(userCredential.user, { displayName: name });
              
              const userRef = doc(firestore, 'users', userCredential.user.uid);
              await setDoc(userRef, {
                  uid: userCredential.user.uid,
                  displayName: name,
                  email: email,
                  isVerified: false,
                  accountType: accountType,
              }, { merge: true });
            }
            toast({
                title: '¡Cuenta Creada!',
                description: 'Has sido registrado e iniciado sesión.',
            });
        } else {
            const { email, password } = values;
            await signInWithEmailAndPassword(auth, email, password);
            toast({
                title: '¡Bienvenido de nuevo!',
                description: 'Has iniciado sesión correctamente.',
            });
        }
        onOpenChange(false);
        form.reset();
    } catch (error: any) {
        console.error('Email/password auth error:', error);
        let description = 'Ocurrió un error. Por favor, inténtalo de nuevo.';
        if (error.code === 'auth/email-already-in-use') {
          description = 'Este correo electrónico ya está en uso. Intenta iniciar sesión.';
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
          description = 'Correo electrónico o contraseña incorrectos.';
        } else if (error.code === 'auth/invalid-email') {
            description = 'El formato del correo electrónico es inválido.'
        }
        toast({
            title: mode === 'signUp' ? 'Error al Registrarse' : 'Error al Iniciar Sesión',
            description,
            variant: 'destructive',
        });
    } finally {
        setIsSubmitting(false);
    }
  }


  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión correctamente.',
      });
    } catch (error) {
      console.error('Error signing out: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo cerrar la sesión. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  if (userLoading) {
    return <Button variant="outline" size="icon" disabled><Loader2 className="animate-spin"/></Button>;
  }

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.photoURL!} alt={user.displayName!} />
              <AvatarFallback>
                <UserIcon />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user.displayName}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Mi Perfil</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/profile/listings">
              <List className="mr-2 h-4 w-4" />
              <span>Mis Publicaciones</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button variant="secondary" onClick={() => { setMode('signIn'); onOpenChange(true); }}>
        <LogIn className="mr-2 h-4 w-4" />
        Iniciar Sesión
      </Button>
      <Dialog open={open} onOpenChange={(isOpen) => {
          if (!isOpen) {
            form.reset();
            setMode('signIn');
            setSignUpStep('type');
            setAccountType(null);
          }
          onOpenChange(isOpen);
        }}>
        <DialogContent className="sm:max-w-[425px]">
          {mode === 'signUp' && signUpStep === 'type' ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl">Crear Cuenta</DialogTitle>
                <DialogDescription>Para empezar, dinos qué tipo de cuenta necesitas.</DialogDescription>
              </DialogHeader>
              <div className="pt-4 text-center">
                <h3 className="text-lg font-semibold mb-2">¿Cómo usarás Zona Motores?</h3>
                <p className="text-sm text-muted-foreground mb-6">Elige el tipo de cuenta que mejor se adapte a ti.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-28 flex-col gap-2" onClick={() => { setAccountType('personal'); setSignUpStep('details'); }}>
                      <UserIcon className="h-8 w-8 text-primary" />
                      <span className="font-semibold text-base">Persona</span>
                  </Button>
                  <Button variant="outline" className="h-28 flex-col gap-2" onClick={() => { setAccountType('dealer'); setSignUpStep('details'); }}>
                      <Store className="h-8 w-8 text-primary" />
                      <span className="font-semibold text-base">Concesionario</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                    Los concesionarios tendrán acceso a herramientas especiales y más de 3 publicaciones.
                </p>
              </div>
              <div className="mt-4 text-center text-sm">
                <span>¿Ya tienes una cuenta?{' '}
                    <Button variant="link" className="p-0 h-auto" onClick={() => setMode('signIn')}>
                        Inicia Sesión
                    </Button>
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <DialogHeader>
                  <DialogTitle className="font-headline text-2xl text-center">
                    {mode === 'signIn' ? 'Iniciar Sesión' : `Crear Cuenta de ${accountType === 'personal' ? 'Persona' : 'Concesionario'}`}
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    {mode === 'signIn' 
                      ? 'Para continuar, inicia sesión en tu cuenta de Zona Motores.'
                      : 'Completa tus datos para finalizar el registro.'
                    }
                  </DialogDescription>
                </DialogHeader>
                {mode === 'signUp' && (
                  <Button variant="ghost" size="sm" className="absolute top-4 left-0" onClick={() => setSignUpStep('type')}>
                    &larr; Volver
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" onClick={() => handleOAuthSignIn('google')} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-76.2 64.5C308.6 106.5 280.2 96 248 96c-88.3 0-160 71.7-160 160s71.7 160 160 160c94.4 0 135.3-64.4 140.8-98.3H248v-85.3h236.1c2.3 12.7 3.9 26.9 3.9 41.4z"></path></svg>}
                    Google
                  </Button>
                  <Button variant="outline" onClick={() => handleOAuthSignIn('apple')} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C39.2 141.6 0 184.2 0 241.2c0 61.6 31.5 118.8 80.8 152.1 31.1 21.2 62.2 32.7 97.9 32.7 35.5 0 67.2-11.5 99.5-32.7 4.2-2.8 8.7-12.2 14.2-27.4-5.8-.8-11.6-1.7-17.2-3.1-34.9-8.4-69.4-29.6-93.5-54.2-26.3-27-42.3-56.9-42.3-88.4 0-1.3.1-2.6.2-3.9 14.8-1.5 42.4-10.4 69.3-10.4 26.3 0 49.3 8.3 65.5 8.3 16.5 0 32.8-8.3 49.3-8.3 14.3 0 28.5 2.8 41.2 5.6-20.9 23.3-33.8 51.5-33.8 82.9zM207.2 120.1c12.3-13.9 20.9-30.9 20.9-48.4 0-18.3-8-34-21.9-42.8-14.2-9.3-31-10-44.5-2.8-13.3 7.2-25.9 22.8-30.9 38.8-1.3 4.1 6.5 11.4 12.3 11.4 6 0 10.3-6.5 11.5-9.3 5.3-13.3 15.3-24.8 28.5-24.8 10.5 0 20.8 7.2 20.8 23.3 0 10.5-5.3 20.8-13.3 28.5-5.8 6.3-10.3 15.3-10.3 24.5 0 9.3 4.2 17.5 10.3 22.8 5.3 5.3 11.5 10.3 18.8 10.3 7.2 0 12.3-4.5 17.8-10.3z"/></svg>}
                    Apple
                  </Button>
              </div>
              <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">o continúa con</span>
                  </div>
              </div>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleEmailSubmit)} className="space-y-4">
                    {mode === 'signUp' && (
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Nombre completo</FormLabel><FormControl><Input placeholder="Ej: Juan Perez" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    )}
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="tu@correo.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={isSubmitting || form.formState.isSubmitting}>
                        {(isSubmitting || form.formState.isSubmitting) && <Loader2 className="mr-2 animate-spin" />}
                        {mode === 'signIn' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                    </Button>
                </form>
              </Form>

              <div className="mt-4 text-center text-sm">
                {mode === 'signIn' ? (
                    <span>¿No tienes una cuenta?{' '}
                        <Button variant="link" className="p-0 h-auto" onClick={() => { setMode('signUp'); setSignUpStep('type'); }}>
                            Regístrate
                        </Button>
                    </span>
                ) : (
                    <span>¿Ya tienes una cuenta?{' '}
                        <Button variant="link" className="p-0 h-auto" onClick={() => setMode('signIn')}>
                            Inicia Sesión
                        </Button>
                    </span>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
