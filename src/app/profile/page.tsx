'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import Image from 'next/image';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { updateProfile, sendEmailVerification, RecaptchaVerifier, linkWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

import { useUser, useFirestore, useAuth, useMemoFirebase, useStorage, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MailCheck, MailWarning, ShieldCheck, Phone, FileText, UploadCloud, Crown, Zap, Shield, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/context/subscription-context';
import { PLAN_CONFIG } from '@/lib/types';
import Link from 'next/link';

const phoneRegex = new RegExp(/^\+[1-9]\d{1,14}$/);

const profileSchema = z.object({
  displayName: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }).max(50),
  phone: z.string().optional().refine((val) => !val || phoneRegex.test(val), {
    message: "Formato inválido. Usa el formato internacional, ej: +584121234567."
  }),
  address: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const { plan, planName, subscription, cancelPlan, limits, contactsUsed, contactsRemaining, promotionsUsed, promotionsRemaining } = useSubscription();
  const [isCanceling, setIsCanceling] = useState(false);

  const handleCancelPlan = async () => {
    setIsCanceling(true);
    await cancelPlan();
    setIsCanceling(false);
  };

  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isFixing, setIsFixing] = useState(false);


  const profileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: profileData, isLoading: isProfileLoading } = useDoc(profileRef);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
      phone: '',
      address: '',
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    trigger,
    formState: { isSubmitting, errors, isLoading: isFormLoading },
  } = form;

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/');
    }
  }, [isAuthLoading, user, router]);

  const isDealer = useMemo(() => (profileData as any)?.accountType === 'dealer', [profileData]);

  useEffect(() => {
    const data = profileData as any;
    if (user && data) {
      reset({
        displayName: user.displayName || '',
        phone: data?.phone || user.phoneNumber || '',
        address: data?.address || '',
      });
      if (data.logoUrl) setLogoPreview(data.logoUrl);
      if (data.heroUrl) setHeroPreview(data.heroUrl);
    } else if (user) {
      reset({
        displayName: user.displayName || '',
        phone: user.phoneNumber || '',
      });
    }
  }, [user, profileData, reset]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCodeSent && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isCodeSent, countdown]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'hero') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressionToast = toast({ title: 'Comprimiendo imagen...', description: 'Por favor, espera.' });

    try {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);

      const previewUrl = URL.createObjectURL(compressedFile);

      if (type === 'logo') {
        setLogoFile(compressedFile);
        setLogoPreview(previewUrl);
      } else {
        setHeroFile(compressedFile);
        setHeroPreview(previewUrl);
      }
      toast({ title: 'Imagen lista', description: 'La imagen ha sido comprimida y está lista para subirse.' });
    } catch (error) {
      console.error('Error compressing image:', error);
      toast({ title: 'Error de compresión', variant: 'destructive' });
    } finally {
      compressionToast.dismiss();
    }
  };

  const onSaveChanges: SubmitHandler<ProfileFormValues> = async (data) => {
    if (!user || !profileRef || isSubmitting || isProfileLoading || isFormLoading) return;

    setUploadProgress(0);

    let newLogoUrl: string | null = (profileData as any)?.logoUrl || null;
    let newHeroUrl: string | null = (profileData as any)?.heroUrl || null;

    try {
      const totalUploads = (logoFile ? 1 : 0) + (heroFile ? 1 : 0);
      let uploadsCompleted = 0;

      const uploadFile = async (file: File, path: string): Promise<string> => {
        const fileRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(fileRef, file, { contentType: file.type });

        return new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              const overallProgress = ((uploadsCompleted * 100) + progress) / totalUploads;
              setUploadProgress(overallProgress);
            },
            (error) => reject(error),
            async () => {
              uploadsCompleted++;
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      };

      if (logoFile) {
        newLogoUrl = await uploadFile(logoFile, `dealer-assets/${user.uid}/dealer_logo`);
      }
      if (heroFile) {
        newHeroUrl = await uploadFile(heroFile, `dealer-assets/${user.uid}/dealer_hero`);
      }

      if (data.displayName !== user.displayName) {
        await updateProfile(user, { displayName: data.displayName });
      }
    } catch (uploadError) {
      console.error("Error uploading images:", uploadError);
      toast({
        title: 'Error de Subida',
        description: 'No se pudieron subir las imágenes. Inténtalo de nuevo.',
        variant: 'destructive',
      });
      setUploadProgress(null);
      return;
    }

    const updatePayload: any = {
      displayName: data.displayName,
      phone: data.phone || null,
    };

    if (isDealer) {
      updatePayload.address = data.address || null;
      if (logoFile) updatePayload.logoUrl = newLogoUrl;
      if (heroFile) updatePayload.heroUrl = newHeroUrl;
    }

    setDoc(profileRef, updatePayload, { merge: true })
      .then(() => {
        toast({
          title: '¡Perfil Actualizado!',
          description: 'Tus cambios han sido guardados con éxito.',
        });
      })
      .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: profileRef.path,
          operation: 'update',
          requestResourceData: updatePayload,
        }, error));
      })
      .finally(() => {
        setUploadProgress(null);
      });
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
    const recaptchaContainer = document.getElementById('recaptcha-container');
    if (!recaptchaContainer) return;

    if ((window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier.clear();
    }

    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainer, {
      'size': 'invisible',
      'callback': (response: any) => { },
      'expired-callback': () => {
        setIsSendingCode(false);
        setIsResending(false);
        toast({ title: 'reCAPTCHA expirado', description: 'Por favor, intenta enviar el código de nuevo.', variant: 'destructive' });
      }
    });

    return (window as any).recaptchaVerifier;
  }

  const handleSendVerificationCode = async (isResend = false) => {
    if (!user) return;

    const isValid = await trigger('phone');
    if (!isValid) {
      toast({
        title: 'Número de teléfono inválido',
        description: 'Por favor, corrige el número en tu perfil y vuelve a intentarlo.',
        variant: 'destructive',
      });
      setIsVerificationDialogOpen(false);
      return;
    }

    const phoneNumber = getValues('phone');
    if (!phoneNumber) {
      toast({ title: 'Número de teléfono requerido', description: 'Por favor, guarda un número de teléfono en tu perfil primero.', variant: 'destructive' });
      return;
    }

    if (isResend) setIsResending(true);
    else setIsSendingCode(true);

    const appVerifier = setupRecaptcha();

    try {
      const result = await linkWithPhoneNumber(user, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setIsCodeSent(true);
      setCountdown(60);
      toast({ title: 'Código SMS Enviado', description: `Se ha enviado un código a ${phoneNumber}.` });
    } catch (error: any) {
      console.error("Error sending phone verification code:", error);

      if (error.code === 'auth/provider-already-linked') {
        toast({
          title: 'Número Ya Verificado',
          description: 'Tu cuenta ya tiene un número de teléfono verificado. Estamos actualizando tu perfil.',
        });
        if (profileRef) {
          const payload = { isVerified: true };
          setDoc(profileRef, payload, { merge: true }).catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: profileRef.path,
              operation: 'update',
              requestResourceData: payload,
            }, err));
          });
        }
        setIsVerificationDialogOpen(false);
      } else {
        let description = 'No se pudo enviar el SMS. Verifica el número y el formato (+584121234567).';
        if (error.code === 'auth/invalid-phone-number') {
          description = 'El número de teléfono no es válido. Asegúrate de usar el formato internacional (ej: +584121234567).';
        } else if (error.code === 'auth/too-many-requests') {
          description = 'Demasiados intentos. Espera un momento antes de volver a intentarlo.';
        }
        toast({ title: 'Error de Verificación', description, variant: 'destructive' });
      }
    } finally {
      if (isResend) setIsResending(false);
      else setIsSendingCode(false);
    }
  };

  const handleConfirmVerificationCode = async () => {
    if (!confirmationResult || !verificationCode) return;
    setIsSubmittingCode(true);
    try {
      await confirmationResult.confirm(verificationCode);
      if (profileRef) {
        const payload = { isVerified: true };
        setDoc(profileRef, payload, { merge: true })
          .catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: profileRef.path,
              operation: 'update',
              requestResourceData: payload
            }, error));
          });
      }
      toast({ title: '¡Número Verificado!', description: 'Tu número ha sido verificado con éxito.', className: 'bg-green-100 dark:bg-green-900' });
      setIsVerificationDialogOpen(false);
    } catch (error) {
      console.error("Error confirming verification code:", error);
      toast({ title: 'Código Incorrecto', description: 'El código no es válido. Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setIsSubmittingCode(false);
    }
  }

  const handleDialogClose = () => {
    setIsCodeSent(false);
    setConfirmationResult(null);
    setVerificationCode('');
    setCountdown(0);
    if ((window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier.clear();
    }
  }

  const handleFixAccountType = async () => {
    if (!user || !profileRef) return;
    setIsFixing(true);
    const payload = { accountType: 'dealer' };
    setDoc(profileRef, payload, { merge: true })
      .then(() => {
        toast({
          title: "¡Cuenta Corregida!",
          description: "Tu cuenta ha sido actualizada a Concesionario. Por favor, recarga la página para ver los cambios."
        });
      })
      .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: profileRef.path,
          operation: 'update',
          requestResourceData: payload,
        }, error));
      })
      .finally(() => {
        setIsFixing(false);
      });
  };

  if (isAuthLoading || isProfileLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-12">
        <h1 className="font-headline text-3xl font-bold mb-8">Mi Perfil</h1>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2 space-y-8">
            <Card>
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent className="space-y-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent>
              <CardFooter><Skeleton className="h-10 w-32" /></CardFooter>
            </Card>
            <Card>
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
              <CardContent className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto py-12 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin" />
        <p className="mt-4">Redirigiendo...</p>
      </div>
    );
  }

  const isPhoneNumberVerified = (profileData as any)?.isVerified || false;

  return (
    <div className="container max-w-4xl mx-auto py-12">
      {user.email === 'zonamotores.concesionario@gmail.com' && !isDealer && (
        <Card className="mb-8 border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-300">Corrección de Cuenta de Concesionario</CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-400">
              Detectamos que tu cuenta fue afectada por un error anterior que la marcó incorrectamente como "Personal".
              Haz clic aquí para corregirla y restaurar tu acceso de concesionario.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleFixAccountType} disabled={isFixing} variant="outline" className="bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/50 dark:hover:bg-yellow-900/80 border-yellow-500/50">
              {isFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Convertir mi cuenta a Concesionario
            </Button>
          </CardFooter>
        </Card>
      )}

      <h1 className="font-headline text-3xl font-bold mb-8">Mi Perfil</h1>
      <div className="grid gap-8 md:grid-cols-3 items-start">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit(onSaveChanges)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Información General</CardTitle>
                <CardDescription>Esta información se mostrará públicamente en tus anuncios.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nombre Completo o del Concesionario</Label>
                  <Input id="displayName" {...register('displayName')} />
                  {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" type="email" value={user.email || ''} disabled />
                  <p className="text-xs text-muted-foreground">El correo no se puede cambiar.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Número de Teléfono</Label>
                  <Input id="phone" type="tel" {...register('phone')} placeholder="+584121234567" disabled={isPhoneNumberVerified} />
                  <p className="text-xs text-muted-foreground">
                    {isPhoneNumberVerified
                      ? "El número verificado no se puede cambiar."
                      : "Usa el formato internacional (ej: +584121234567)."}
                  </p>
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                </div>
              </CardContent>
            </Card>

            {isDealer && (
              <Card>
                <CardHeader>
                  <CardTitle>Perfil de Concesionario</CardTitle>
                  <CardDescription>Esta información se mostrará en tu página de concesionario.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input id="address" {...register('address')} placeholder="Ej: Av. Principal, Edif. XYZ, Local 1" />
                    {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
                  </div>
                  <div className="space-y-4">
                    <Label>Logo (recomendado: 1:1, ej: 400x400px)</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative h-24 w-24 rounded-full border-2 border-dashed bg-muted overflow-hidden">
                        {logoPreview ? (
                          <Image src={logoPreview} alt="Vista previa del logo" fill objectFit="cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center"><UploadCloud className="h-8 w-8 text-muted-foreground" /></div>
                        )}
                      </div>
                      <Input id="logo-upload" type="file" accept="image/*" onChange={(e) => handleImageSelect(e, 'logo')} className="hidden" />
                      <Button type="button" variant="outline" onClick={() => document.getElementById('logo-upload')?.click()}>
                        {logoPreview ? 'Cambiar Logo' : 'Subir Logo'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label>Imagen de Portada (recomendado: 16:9, ej: 1600x900px)</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative aspect-video w-full max-w-sm rounded-md border-2 border-dashed bg-muted overflow-hidden">
                        {heroPreview ? (
                          <Image src={heroPreview} alt="Vista previa de la portada" fill objectFit="cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center"><UploadCloud className="h-8 w-8 text-muted-foreground" /></div>
                        )}
                      </div>
                      <Input id="hero-upload" type="file" accept="image/*" onChange={(e) => handleImageSelect(e, 'hero')} className="hidden" />
                      <Button type="button" variant="outline" onClick={() => document.getElementById('hero-upload')?.click()}>
                        {heroPreview ? 'Cambiar Portada' : 'Subir Portada'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <CardFooter className="px-0">
              <div className="flex items-center gap-4">
                <Button type="submit" disabled={isSubmitting || uploadProgress !== null || isProfileLoading || isFormLoading}>
                  {(isSubmitting || uploadProgress !== null) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
                {uploadProgress !== null && (
                  <div className="w-48">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">Subiendo... {uploadProgress.toFixed(0)}%</p>
                  </div>
                )}
              </div>
            </CardFooter>
          </form>
        </div>
        <div className="space-y-6 md:sticky md:top-24">
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

          {/* Plan Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Mi Plan</CardTitle>
                <Badge
                  variant="secondary"
                  className={`${plan === 'ultra' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700' :
                      plan === 'pro' ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' :
                        ''
                    }`}
                >
                  {plan === 'ultra' ? <Crown className="h-3 w-3 mr-1" /> : plan === 'pro' ? <Zap className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                  {planName}
                </Badge>
              </div>
              {subscription?.activatedAt && plan !== 'basico' && (
                <CardDescription className="text-xs">
                  Activo desde {subscription.activatedAt.toDate().toLocaleDateString('es-VE')}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Publicaciones</span>
                <span className="font-medium">{limits.maxListings} máx.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contactos/mes</span>
                <span className="font-medium">{limits.maxContactsPerMonth === -1 ? 'Ilimitados' : `${contactsUsed}/${limits.maxContactsPerMonth}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Promociones/mes</span>
                <span className="font-medium">{limits.maxPromotionsPerMonth === 0 ? 'No incluidas' : `${promotionsUsed}/${limits.maxPromotionsPerMonth}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estadísticas</span>
                <span className="font-medium">{limits.hasAdvancedStats ? 'Avanzadas' : limits.hasStats ? 'Básicas' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Concesionario</span>
                <span className="font-medium">{limits.hasDealerProfile ? 'Sí' : 'No'}</span>
              </div>
              <div className="pt-2 space-y-2">
                <Button asChild className="w-full" size="sm">
                  <Link href="/pricing">
                    {plan === 'basico' ? 'Ver planes' : 'Mejorar plan'}
                    <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
                {plan !== 'basico' && (
                  <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={handleCancelPlan} disabled={isCanceling}>
                    {isCanceling ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                    Cancelar plan
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={isVerificationDialogOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); setIsVerificationDialogOpen(open); }}>
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
              <div className="text-center text-sm text-muted-foreground">
                {countdown > 0 ? (
                  `Puedes reenviar el código en ${countdown} segundos.`
                ) : (
                  <Button variant="link" onClick={() => handleSendVerificationCode(true)} disabled={isResending} className="p-0 h-auto">
                    {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reenviar código
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Button onClick={() => handleSendVerificationCode(false)} disabled={isSendingCode} className="w-full">
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
