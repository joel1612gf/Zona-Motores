'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import { hashSHA256, type StaffMember } from '@/lib/business-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  KeyRound,
  ImageIcon,
  Receipt,
  Coins,
  Crown,
  Loader2,
  Upload,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Building2,
} from 'lucide-react';

type StepDef = { n: number; label: string; icon: typeof KeyRound };

const STEPS: StepDef[] = [
  { n: 1, label: 'Clave', icon: KeyRound },
  { n: 2, label: 'Marca', icon: ImageIcon },
  { n: 3, label: 'Fiscal', icon: Receipt },
  { n: 4, label: 'Finanzas', icon: Coins },
  { n: 5, label: 'Dueño', icon: Crown },
];

const MIN_KEY_LENGTH = 6;

export default function OnboardingWizardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  const { concesionario, authenticateAfterOnboarding } = useBusinessAuth();

  const [step, setStep] = useState(1);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Step 1 — Master key
  const [masterKey, setMasterKey] = useState('');
  const [masterKeyConfirm, setMasterKeyConfirm] = useState('');

  // Step 2 — Branding
  const [nombreComercial, setNombreComercial] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 3 — Fiscal data
  const [rif, setRif] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  // Step 4 — Finance
  const [tasaCambioAuto, setTasaCambioAuto] = useState(
    concesionario?.configuracion?.tasa_cambio_auto ?? false,
  );

  // Step 5 — Owner profile
  const [ownerNombre, setOwnerNombre] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const [error, setError] = useState<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  // Returns an error message if the current step is invalid, otherwise null.
  const validateStep = (current: number): string | null => {
    switch (current) {
      case 1:
        if (masterKey.length < MIN_KEY_LENGTH)
          return `La clave maestra debe tener al menos ${MIN_KEY_LENGTH} caracteres.`;
        if (masterKey !== masterKeyConfirm) return 'Las claves no coinciden.';
        return null;
      case 2:
        if (!nombreComercial.trim()) return 'El nombre comercial es obligatorio.';
        return null;
      case 3:
        if (!rif.trim()) return 'El RIF es obligatorio.';
        if (!direccion.trim()) return 'La dirección es obligatoria.';
        return null;
      case 4:
        return null;
      case 5:
        if (!ownerNombre.trim()) return 'El nombre del dueño es obligatorio.';
        if (pin.length !== 4) return 'El PIN debe tener 4 dígitos.';
        if (pin !== pinConfirm) return 'Los PINs no coinciden.';
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    if (step < STEPS.length) {
      setStep((s) => s + 1);
    } else {
      void finalize();
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const finalize = async () => {
    if (!concesionario) return;
    setIsFinalizing(true);
    try {
      // 1. Upload logo (if provided) and resolve its URL.
      let logoUrl = concesionario.logo_url || '';
      if (logoFile) {
        const logoRef = ref(storage, `business-assets/${concesionario.id}/logo.png`);
        await uploadBytes(logoRef, logoFile);
        logoUrl = await getDownloadURL(logoRef);
      }

      // 2. Hash credentials.
      const masterHash = await hashSHA256(masterKey);
      const pinHash = await hashSHA256(pin);

      // 3. Atomic write: tenant config + owner staff in a single batch.
      const concRef = doc(firestore, 'concesionarios', concesionario.id);
      const ownerRef = doc(collection(firestore, 'concesionarios', concesionario.id, 'staff'));
      const batch = writeBatch(firestore);

      batch.update(concRef, {
        clave_maestra_hash: masterHash,
        nombre_empresa: nombreComercial.trim(),
        rif: rif.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        logo_url: logoUrl,
        'configuracion.tasa_cambio_auto': tasaCambioAuto,
        onboarding_completado: true,
      });

      batch.set(ownerRef, {
        nombre: ownerNombre.trim(),
        rol: 'dueno',
        pin_hash: pinHash,
        activo: true,
        created_at: serverTimestamp(),
      });

      await batch.commit();

      // 4. Auto-login the owner straight into the dashboard.
      const ownerStaff: StaffMember = {
        id: ownerRef.id,
        nombre: ownerNombre.trim(),
        rol: 'dueno',
        pin_hash: pinHash,
        activo: true,
        created_at: Timestamp.now(),
      };
      await authenticateAfterOnboarding(ownerStaff);

      router.replace(`/business/${slug}/dashboard`);
    } catch (err: any) {
      console.error('[Onboarding] Error finalizing:', err);
      setIsFinalizing(false);
      toast({
        title: 'Error al finalizar',
        description: 'No se pudo completar la configuración. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const currentStepDef = useMemo(() => STEPS[step - 1], [step]);

  // Premium loading screen while the atomic write runs.
  if (isFinalizing) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/20">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="relative h-20 w-20 rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/40">
            <Sparkles className="h-10 w-10 text-primary-foreground animate-pulse" />
          </div>
        </div>
        <p className="mt-8 text-2xl font-headline font-bold text-foreground">
          Generando experiencia personalizada…
        </p>
        <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Configurando tu concesionario
        </p>
      </div>
    );
  }

  if (!concesionario) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="w-full max-w-xl">
        {/* Brand header */}
        <div className="text-center mb-6 space-y-1">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-headline">Bienvenido a Zona Motores</h1>
          <p className="text-sm text-muted-foreground">
            Configura tu concesionario <span className="font-medium text-foreground">/{slug}</span> en
            unos pasos
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-1 mb-6">
          {STEPS.map((s, i) => {
            const done = s.n < step;
            const active = s.n === step;
            const Icon = s.icon;
            return (
              <div key={s.n} className="flex items-center gap-1">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center transition-all',
                      active && 'bg-primary text-primary-foreground shadow-md shadow-primary/30',
                      done && 'bg-primary/20 text-primary',
                      !active && !done && 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      'text-[10px] hidden sm:block',
                      active ? 'text-primary font-semibold' : 'text-muted-foreground',
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('h-px w-4 sm:w-8 mb-4', done ? 'bg-primary/40' : 'bg-muted')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-card/95 backdrop-blur-xl rounded-[2rem] border shadow-xl p-6 sm:p-8">
          <div
            key={step}
            className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <currentStepDef.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-headline text-lg font-bold">
                  {step === 1 && 'Clave Maestra'}
                  {step === 2 && 'Identidad de tu marca'}
                  {step === 3 && 'Datos fiscales'}
                  {step === 4 && 'Finanzas'}
                  {step === 5 && 'Perfil del dueño'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Paso {step} de {STEPS.length}
                </p>
              </div>
            </div>

            {/* Step 1 — Master key */}
            {step === 1 && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Anótala en un lugar seguro</AlertTitle>
                  <AlertDescription>
                    Esta clave protege el acceso de toda tu empresa.{' '}
                    <strong>No podrás cambiarla luego desde el sistema.</strong> Si la olvidas,
                    deberás pedir un reseteo al administrador de Zona Motores.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="master-key">Clave maestra</Label>
                  <Input
                    id="master-key"
                    type="password"
                    value={masterKey}
                    onChange={(e) => {
                      setMasterKey(e.target.value);
                      setError(null);
                    }}
                    placeholder="Mínimo 6 caracteres"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="master-key-confirm">Confirmar clave maestra</Label>
                  <Input
                    id="master-key-confirm"
                    type="password"
                    value={masterKeyConfirm}
                    onChange={(e) => {
                      setMasterKeyConfirm(e.target.value);
                      setError(null);
                    }}
                    placeholder="Repite la clave"
                  />
                </div>
              </div>
            )}

            {/* Step 2 — Branding */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre-comercial">Nombre comercial</Label>
                  <Input
                    id="nombre-comercial"
                    value={nombreComercial}
                    onChange={(e) => {
                      setNombreComercial(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ej: AutoMax Caracas"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Logo (opcional)</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-muted/40 border flex items-center justify-center overflow-hidden shrink-0">
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoPreview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <label className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" className="rounded-xl" asChild>
                        <span>
                          <Upload className="h-3.5 w-3.5 mr-2" /> Subir logo
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Fiscal data */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rif">RIF</Label>
                    <Input
                      id="rif"
                      value={rif}
                      onChange={(e) => {
                        setRif(e.target.value);
                        setError(null);
                      }}
                      placeholder="J-12345678-9"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="+58 412..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={direccion}
                    onChange={(e) => {
                      setDireccion(e.target.value);
                      setError(null);
                    }}
                    placeholder="Av. Principal, Caracas"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>
            )}

            {/* Step 4 — Finance */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border bg-muted/30 p-4">
                  <div className="pr-4">
                    <p className="text-sm font-medium">Tasa BCV automática</p>
                    <p className="text-xs text-muted-foreground">
                      Obtiene la tasa oficial del BCV automáticamente al registrar operaciones en
                      bolívares. Puedes cambiarlo luego en Configuración.
                    </p>
                  </div>
                  <Switch checked={tasaCambioAuto} onCheckedChange={setTasaCambioAuto} />
                </div>
              </div>
            )}

            {/* Step 5 — Owner profile */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="owner-nombre">Nombre del dueño</Label>
                  <Input
                    id="owner-nombre"
                    value={ownerNombre}
                    onChange={(e) => {
                      setOwnerNombre(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ej: Joel Eduardo"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="owner-pin">PIN (4 dígitos)</Label>
                    <Input
                      id="owner-pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value.replace(/\D/g, ''));
                        setError(null);
                      }}
                      placeholder="••••"
                      className="font-mono tracking-widest"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-pin-confirm">Confirmar PIN</Label>
                    <Input
                      id="owner-pin-confirm"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={pinConfirm}
                      onChange={(e) => {
                        setPinConfirm(e.target.value.replace(/\D/g, ''));
                        setError(null);
                      }}
                      placeholder="••••"
                      className="font-mono tracking-widest"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  El PIN se usa para autorizar transacciones dentro del sistema.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-2 mt-8">
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={handleBack}
              disabled={step === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
            </Button>
            <Button
              className="rounded-xl font-bold shadow-lg shadow-primary/20"
              onClick={handleNext}
            >
              {step < STEPS.length ? (
                <>
                  Siguiente <ArrowRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" /> Finalizar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
