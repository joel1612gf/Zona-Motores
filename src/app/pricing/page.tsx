'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Crown, Zap, Shield, Sparkles, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSubscription } from '@/context/subscription-context';
import { useUser } from '@/firebase';
import { PLAN_CONFIG, type PlanTier } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const planFeatures: Record<PlanTier, { icon: React.ReactNode; color: string; gradient: string; features: { text: string; included: boolean }[] }> = {
  basico: {
    icon: <Shield className="h-8 w-8" />,
    color: 'text-muted-foreground',
    gradient: 'from-slate-500/10 to-slate-600/5',
    features: [
      { text: '2 publicaciones simultáneas', included: true },
      { text: '50 contactos por mes', included: true },
      { text: 'Sin perfil de concesionario', included: false },
      { text: 'Sin estadísticas', included: false },
      { text: 'Sin publicaciones destacadas', included: false },
      { text: 'Sin soporte personalizado', included: false },
    ],
  },
  pro: {
    icon: <Zap className="h-8 w-8" />,
    color: 'text-blue-500',
    gradient: 'from-blue-500/15 to-indigo-500/5',
    features: [
      { text: '5 publicaciones simultáneas', included: true },
      { text: '100 contactos por mes', included: true },
      { text: 'Estadísticas de rendimiento', included: true },
      { text: '1 publicación destacada (7 días)', included: true },
      { text: 'Soporte personalizado', included: true },
      { text: 'Sin perfil de concesionario', included: false },
    ],
  },
  ultra: {
    icon: <Crown className="h-8 w-8" />,
    color: 'text-amber-500',
    gradient: 'from-amber-500/15 to-orange-500/5',
    features: [
      { text: '20 publicaciones simultáneas', included: true },
      { text: 'Contactos ilimitados', included: true },
      { text: 'Estadísticas avanzadas', included: true },
      { text: '5 publicaciones destacadas (7 días)', included: true },
      { text: 'Soporte personalizado', included: true },
      { text: 'Perfil de concesionario', included: true },
    ],
  },
};

export default function PricingPage() {
  const { plan: currentPlan, activatePlan, isLoading } = useSubscription();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSelectPlan = (plan: PlanTier) => {
    if (!user) {
      toast({
        title: 'Inicia sesión',
        description: 'Debes tener una cuenta para contratar un plan.',
        variant: 'destructive',
      });
      return;
    }
    if (plan === currentPlan) return;
    if (plan === 'basico') return; // Can't "subscribe" to free
    setSelectedPlan(plan);
    setCode('');
    setShowSuccess(false);
    setModalOpen(true);
  };

  const handleActivate = async () => {
    if (!selectedPlan) return;
    setIsActivating(true);
    const success = await activatePlan(selectedPlan, code);
    setIsActivating(false);
    if (success) {
      setShowSuccess(true);
      toast({
        title: '¡Plan activado!',
        description: `Tu plan ${PLAN_CONFIG[selectedPlan].name} está activo. ¡Disfrútalo!`,
      });
      setTimeout(() => {
        setModalOpen(false);
        router.push('/profile');
      }, 2500);
    }
  };

  const plans: PlanTier[] = ['basico', 'pro', 'ultra'];

  return (
    <div className="container max-w-6xl mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Sparkles className="h-4 w-4" />
          Planes de Suscripción
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">
          Elige el plan perfecto para ti
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Potencia tus ventas con herramientas avanzadas, más publicaciones y mayor visibilidad.
        </p>
      </div>

      {/* Current plan banner */}
      {user && !isLoading && currentPlan !== 'basico' && (
        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${currentPlan === 'ultra' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
              {currentPlan === 'ultra' ? <Crown className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-semibold">Plan {PLAN_CONFIG[currentPlan].name} activo</p>
              <p className="text-sm text-muted-foreground">Estás disfrutando de todas las ventajas de tu plan.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/profile')}>
            Ver detalles <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {plans.map((planKey) => {
          const config = PLAN_CONFIG[planKey];
          const features = planFeatures[planKey];
          const isCurrentPlan = currentPlan === planKey;
          const isPopular = planKey === 'pro';

          return (
            <Card
              key={planKey}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isPopular ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''
                } ${isCurrentPlan ? 'border-green-500/50 bg-green-500/5' : ''}`}
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${features.gradient} pointer-events-none`} />

              {/* Popular badge */}
              {isPopular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                  POPULAR
                </div>
              )}

              {/* Current plan badge */}
              {isCurrentPlan && (
                <div className="absolute top-0 left-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-br-lg">
                  TU PLAN
                </div>
              )}

              <CardHeader className="relative text-center pb-2">
                <div className={`mx-auto mb-3 p-3 rounded-xl bg-background/80 backdrop-blur-sm border w-fit ${features.color}`}>
                  {features.icon}
                </div>
                <CardTitle className="font-headline text-2xl">{config.name}</CardTitle>
                <CardDescription className="text-sm">
                  {planKey === 'basico' && 'Empieza sin costo'}
                  {planKey === 'pro' && 'Para vendedores activos'}
                  {planKey === 'ultra' && 'Para concesionarios y revendedores'}
                </CardDescription>
              </CardHeader>

              <CardContent className="relative text-center pb-4">
                <div className="mb-6">
                  <span className="font-headline text-5xl font-bold">
                    {config.price === 0 ? 'Gratis' : `$${config.price}`}
                  </span>
                  {config.price > 0 && (
                    <span className="text-muted-foreground text-sm ml-1">/ mes</span>
                  )}
                </div>

                <ul className="space-y-3 text-left">
                  {features.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      )}
                      <span className={feature.included ? '' : 'text-muted-foreground/60'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="relative pt-2">
                {isCurrentPlan ? (
                  <Button className="w-full" variant="outline" disabled>
                    <Check className="h-4 w-4 mr-2" /> Plan actual
                  </Button>
                ) : planKey === 'basico' ? (
                  <Button className="w-full" variant="ghost" disabled>
                    Plan gratuito
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${isPopular ? '' : 'variant-outline'}`}
                    variant={isPopular ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(planKey)}
                  >
                    {currentPlan === 'basico'
                      ? `Comenzar con ${config.name}`
                      : planKey === 'ultra' && currentPlan === 'pro'
                        ? 'Mejorar a Ultra'
                        : `Cambiar a ${config.name}`
                    }
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* FAQ / Extra info */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="font-headline text-2xl font-bold mb-3">¿Tienes preguntas?</h2>
        <p className="text-muted-foreground mb-2">
          Todos los planes incluyen acceso al marketplace, publicación de vehículos y contacto con compradores.
        </p>
        <p className="text-sm text-muted-foreground">
          Puedes cambiar o cancelar tu plan en cualquier momento desde tu perfil.
        </p>
      </div>

      {/* Activation Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          {showSuccess ? (
            <div className="text-center py-8">
              <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center animate-in zoom-in-50 duration-500">
                <Check className="h-10 w-10 text-green-500" />
              </div>
              <h3 className="font-headline text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                ¡Plan activado!
              </h3>
              <p className="text-muted-foreground">
                Tu plan {selectedPlan && PLAN_CONFIG[selectedPlan].name} está activo. Serás redirigido a tu perfil...
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-headline text-xl flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Activar Plan {selectedPlan && PLAN_CONFIG[selectedPlan].name}
                </DialogTitle>
                <DialogDescription>
                  Ingresa tu código de acceso para activar el plan.
                  {selectedPlan && (
                    <span className="block mt-1 font-semibold text-foreground">
                      ${PLAN_CONFIG[selectedPlan].price} / mes
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label htmlFor="activation-code" className="text-sm font-medium mb-1.5 block">
                    Código de acceso
                  </label>
                  <Input
                    id="activation-code"
                    type="text"
                    placeholder="Ingresa tu código"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                    className="text-center text-lg tracking-widest font-mono"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleActivate}
                  disabled={!code.trim() || isActivating}
                >
                  {isActivating ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Procesando...
                    </span>
                  ) : (
                    'Activar plan'
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  El código será validado y tu plan se activará al instante.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
