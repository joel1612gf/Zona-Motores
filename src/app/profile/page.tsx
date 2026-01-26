
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, setDoc } from 'firebase/firestore';
import { updateProfile, sendEmailVerification, RecaptchaVerifier, linkWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';

import { useUser, useFirestore, useAuth, useMemoFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MailCheck, MailWarning, ShieldCheck, Phone, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Define the schema for the profile form
const profileSchema = z.object({
  displayName: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }).max(50),
  phoneNumber: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  // Memoize the document reference
  const profileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: profileData, isLoading: isProfileLoading } = useDoc(profileRef);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
      phoneNumber: '',
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { isSubmitting, errors },
  } = form;


  useEffect(() => {
    if (user && profileData) {
      reset({
        displayName: user.displayName || '',
        phoneNumber: (profileData as any)?.phoneNumber || '',
      });
    } else if (user) {
        reset({
            displayName: user.displayName || '',
            phoneNumber: user.phoneNumber || '',
        });
    }
  }, [user, profileData, reset]);

  const onSaveChanges: SubmitHandler<ProfileFormValues> = async (data) => {
    if (!user || !profileRef) return;
    
    try {
      const promises = [];
      // Update auth profile if display name changed
      if (data.displayName !== user.displayName) {
        promises.push(updateProfile(user, { displayName: data.displayName }));
      }

      // Update Firestore document
      const firestoreData = {
        uid: user.uid,
        displayName: data.displayName,
        email: user.email,
        phoneNumber: data.phoneNumber || '',
        isVerified: (profileData as any)?.isVerified || false
      };
      promises.push(setDoc(profileRef, firestoreData, { merge: true }));
      
      await Promise.all(promises);

      toast({
        title: '¡Perfil Actualizado!',
        description: 'Tus cambios han sido guardados con éxito.',
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const handleSendVerificationEmail = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      toast({
        title: 'Correo de Verificación Enviado',
        description: 'Revisa tu bandeja de entrada para verificar tu cuenta.',
      });
    } catch (error) {
        console.error("Error sending verification email:", error);
        toast({
            title: 'Error',
            description: 'No se pudo enviar el correo. Inténtalo de nuevo más tarde.',
            variant: 'destructive',
        });
    }
  }

  const setupRecaptcha = () => {
    if (!auth) return;
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response: any) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
          setIsSendingCode(false);
        },
        'expired-callback': () => {
          // Response expired. Ask user to solve reCAPTCHA again.
          setIsSendingCode(false);
          toast({ title: 'reCAPTCHA expirado', description: 'Por favor, intenta enviar el código de nuevo.', variant: 'destructive' });
        }
      });
    }
    return (window as any).recaptchaVerifier;
  }

  const handleSendVerificationCode = async () => {
    if (!user) return;
    const phoneNumber = getValues('phoneNumber');
    if (!phoneNumber) {
        toast({ title: 'Número de teléfono requerido', description: 'Por favor, guarda un número de teléfono en tu perfil primero.', variant: 'destructive' });
        return;
    }

    setIsSendingCode(true);
    const appVerifier = setupRecaptcha();
    
    try {
        const result = await linkWithPhoneNumber(user, phoneNumber, appVerifier);
        setConfirmationResult(result);
        setIsCodeSent(true);
        toast({ title: 'Código SMS Enviado', description: `Se ha enviado un código a ${phoneNumber}.` });
    } catch(error) {
        console.error("Error sending phone verification code:", error);
        toast({ title: 'Error al Enviar Código', description: 'No se pudo enviar el SMS. Verifica el número y el formato (+584121234567).', variant: 'destructive' });
    } finally {
        setIsSendingCode(false);
    }
  };

  const handleConfirmVerificationCode = async () => {
      if (!confirmationResult || !verificationCode) return;
      setIsSubmittingCode(true);
      try {
        await confirmationResult.confirm(verificationCode);
        
        // Update firestore profile
        if (profileRef) {
            await setDoc(profileRef, { isVerified: true }, { merge: true });
        }

        toast({ title: '¡Número Verificado!', description: 'Tu número de teléfono ha sido verificado con éxito.', className: 'bg-green-100 dark:bg-green-900' });
        setIsVerificationDialogOpen(false);
      } catch (error) {
        console.error("Error confirming verification code:", error);
        toast({ title: 'Código Incorrecto', description: 'El código que ingresaste no es válido. Inténtalo de nuevo.', variant: 'destructive' });
      } finally {
        setIsSubmittingCode(false);
      }
  }
  
  const handleDialogClose = () => {
    // Reset state when dialog is closed
    setIsCodeSent(false);
    setConfirmationResult(null);
    setVerificationCode('');
    if ((window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier.clear();
    }
  }


  if (isAuthLoading || isProfileLoading) {
    return (
        <div className="container max-w-4xl mx-auto py-12">
            <h1 className="font-headline text-3xl font-bold mb-8">Mi Perfil</h1>
            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                        <CardContent className="space-y-6">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </CardContent>
                        <CardFooter><Skeleton className="h-10 w-32" /></CardFooter>
                    </Card>
                </div>
                <div>
                     <Card>
                        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
  }
  
  if (!user) {
    router.push('/');
    return null;
  }
  
  const isPhoneNumberVerified = (profileData as any)?.isVerified || false;

  return (
    <div className="container max-w-4xl mx-auto py-12">
      <h1 className="font-headline text-3xl font-bold mb-8">Mi Perfil</h1>
      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit(onSaveChanges)}>
            <Card>
              <CardHeader>
                <CardTitle>Información de Perfil</CardTitle>
                <CardDescription>
                  Esta información se mostrará públicamente en tus anuncios.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nombre Completo</Label>
                  <Input 
                    id="displayName" 
                    {...register('displayName')}
                  />
                  {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" type="email" value={user.email || ''} disabled />
                  <p className="text-xs text-muted-foreground">El correo no se puede cambiar.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Número de Teléfono</Label>
                  <Input 
                    id="phoneNumber" 
                    type="tel"
                    {...register('phoneNumber')}
                    placeholder="+584121234567"
                  />
                   <p className="text-xs text-muted-foreground">Usa el formato internacional (ej: +584121234567).</p>
                  {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
                <CardTitle>Verificación</CardTitle>
                <CardDescription>Completa las verificaciones para generar más confianza.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                        {user.emailVerified ? <MailCheck className="text-green-500" /> : <MailWarning className="text-orange-500" />}
                        <span>Correo</span>
                    </div>
                    {user.emailVerified ? (
                        <Badge variant="secondary" className="border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300">Verificado</Badge>
                    ) : (
                        <Button variant="outline" size="sm" onClick={handleSendVerificationEmail}>Verificar</Button>
                    )}
                </div>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                       {isPhoneNumberVerified ? <Phone className="text-green-500" /> : <Phone className="text-orange-500" />}
                        <span>Teléfono</span>
                    </div>
                    {isPhoneNumberVerified ? (
                         <Badge variant="secondary" className="border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300">Verificado</Badge>
                    ) : (
                       <Button variant="outline" size="sm" onClick={() => setIsVerificationDialogOpen(true)}>Verificar</Button>
                    )}
                </div>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                        <FileText className="text-muted-foreground" />
                        <span>Cédula</span>
                    </div>
                    <Button variant="outline" size="sm" disabled>Próximamente</Button>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={isVerificationDialogOpen} onOpenChange={(open) => { if(!open) handleDialogClose(); setIsVerificationDialogOpen(open);}}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Verificar Número de Teléfono</DialogTitle>
                <DialogDescription>
                    {!isCodeSent 
                        ? 'Se enviará un código de verificación por SMS a tu número. Se aplicará un reCAPTCHA invisible.'
                        : 'Ingresa el código de 6 dígitos que recibiste por SMS.'
                    }
                </DialogDescription>
            </DialogHeader>
            <div id="recaptcha-container" className="my-4"></div>
            {isCodeSent ? (
                <div className="space-y-4">
                    <Input 
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="Código de 6 dígitos"
                        maxLength={6}
                    />
                    <Button onClick={handleConfirmVerificationCode} disabled={isSubmittingCode || verificationCode.length < 6} className="w-full">
                        {isSubmittingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Código
                    </Button>
                </div>
            ) : (
                <Button onClick={handleSendVerificationCode} disabled={isSendingCode} className="w-full">
                    {isSendingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar Código de Verificación
                </Button>
            )}
            <DialogFooter>
                 <DialogClose asChild>
                    <Button variant="outline" onClick={handleDialogClose}>Cancelar</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
