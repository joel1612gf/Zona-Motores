'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  DollarSign,
  Heart,
  History,
  Loader2,
  MessageCircle,
  Phone,
  Save,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Cliente, CuentaPorCobrar, Venta } from '@/lib/business-types';
import { ClientInteractionsTimeline } from './client-interactions-timeline';
import { ClientWishlistEditor } from './client-wishlist-editor';
import { openWhatsApp } from '@/lib/whatsapp-helper';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente | null;
  concesionarioId: string;
  onSaved?: () => void;
}

const RIESGO_LABEL: Record<NonNullable<Cliente['riesgo_credito']>, { label: string; className: string }> = {
  bajo: { label: 'Riesgo Bajo', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  medio: { label: 'Riesgo Medio', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  alto: { label: 'Riesgo Alto', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

function fmtUsd(n: number | undefined): string {
  if (!n) return '$0';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function ClientSheet360({ open, onOpenChange, cliente, concesionarioId, onSaved }: Props) {
  const firestore = useFirestore();
  const { staff } = useBusinessAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState('general');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cedulaRif, setCedulaRif] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [traspasoPendiente, setTraspasoPendiente] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cliente) {
      setNombre(cliente.nombre || '');
      setApellido(cliente.apellido || '');
      setCedulaRif(cliente.cedula_rif || '');
      setTelefono(cliente.telefono || '');
      setEmail(cliente.email || '');
      setTraspasoPendiente(!!cliente.traspaso_pendiente);
      setTab('general');
    }
  }, [cliente?.id]);

  const ventasQuery = useMemoFirebase(() => {
    if (!firestore || !concesionarioId || !cliente?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionarioId, 'ventas'),
      where('comprador_id', '==', cliente.id),
      orderBy('fecha', 'desc'),
    );
  }, [firestore, concesionarioId, cliente?.id]);

  const { data: ventas, isLoading: ventasLoading } = useCollection<Venta>(ventasQuery);

  const cxcQuery = useMemoFirebase(() => {
    if (!firestore || !concesionarioId || !cliente?.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionarioId, 'cuentas_por_cobrar'),
      where('cliente_id', '==', cliente.id),
    );
  }, [firestore, concesionarioId, cliente?.id]);

  const { data: cxcRows } = useCollection<CuentaPorCobrar>(cxcQuery);

  const cxcAbiertas = useMemo(
    () => (cxcRows ?? []).filter(r => r.status !== 'pagado' && (r.saldo_pendiente_usd ?? 0) > 0.01),
    [cxcRows],
  );

  const handleSaveGeneral = async () => {
    if (!cliente) return;
    if (!nombre.trim() || !apellido.trim() || !cedulaRif.trim()) {
      toast({ title: 'Campos requeridos', description: 'Nombre, apellido y cédula son obligatorios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'concesionarios', concesionarioId, 'clientes', cliente.id), {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        cedula_rif: cedulaRif.trim(),
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        traspaso_pendiente: traspasoPendiente,
        updated_at: serverTimestamp(),
      });
      toast({ title: 'Cliente actualizado' });
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!cliente) return null;

  const initials = `${cliente.nombre?.[0] ?? ''}${cliente.apellido?.[0] ?? ''}`.toUpperCase();
  const riesgo = cliente.riesgo_credito ? RIESGO_LABEL[cliente.riesgo_credito] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto p-0 bg-background"
      >
        {/* Header con chip primary (§3 adaptado a Sheet) */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b">
          <SheetHeader className="px-6 py-5 space-y-3 text-left">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25 flex-shrink-0">
                {initials ? (
                  <span className="text-primary-foreground font-bold text-base w-6 h-6 flex items-center justify-center">{initials}</span>
                ) : (
                  <User className="h-6 w-6 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-2xl font-bold font-headline tracking-tight truncate">
                  {cliente.nombre} {cliente.apellido}
                </SheetTitle>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                  {cliente.cedula_rif}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {cliente.tags?.map(t => <Badge key={t} variant="secondary" className="text-[10px] font-bold">{t}</Badge>)}
                  {riesgo && <Badge className={cn('text-[10px] border font-bold', riesgo.className)} variant="outline">{riesgo.label}</Badge>}
                  {cliente.traspaso_pendiente && (
                    <Badge variant="destructive" className="text-[10px] font-bold">
                      <AlertTriangle className="h-3 w-3 mr-1" />Título pendiente
                    </Badge>
                  )}
                </div>
              </div>
              {cliente.telefono && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl h-10 px-4 border-emerald-500/20 hover:bg-emerald-500/5 text-emerald-600 font-bold gap-2 flex-shrink-0"
                  onClick={() => openWhatsApp(cliente.telefono!)}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </Button>
              )}
            </div>
          </SheetHeader>
        </div>

        <div className="px-6 py-6 space-y-6">
          <Tabs value={tab} onValueChange={setTab}>
            {/* Tabs pill blanca §7B */}
            <TabsList className="bg-slate-100 p-1 rounded-2xl h-12 border border-slate-200/60 shadow-inner grid grid-cols-5 w-full">
              <TabsTrigger value="general" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold gap-1.5 text-xs sm:text-sm">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">General</span>
              </TabsTrigger>
              <TabsTrigger value="wishlist" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold gap-1.5 text-xs sm:text-sm">
                <Heart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Wishlist</span>
              </TabsTrigger>
              <TabsTrigger value="bitacora" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold gap-1.5 text-xs sm:text-sm">
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bitácora</span>
              </TabsTrigger>
              <TabsTrigger value="compras" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold gap-1.5 text-xs sm:text-sm">
                <ShoppingBag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Compras</span>
              </TabsTrigger>
              <TabsTrigger value="financiero" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold gap-1.5 text-xs sm:text-sm">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Financiero</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-6 space-y-4">
              <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem] overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Datos del cliente</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-bold">Nombre *</Label>
                      <Input value={nombre} onChange={e => setNombre(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">Apellido *</Label>
                      <Input value={apellido} onChange={e => setApellido(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">Cédula / RIF *</Label>
                      <Input value={cedulaRif} onChange={e => setCedulaRif(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">Teléfono</Label>
                      <Input value={telefono} onChange={e => setTelefono(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1" placeholder="+58 412..." />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-bold">Email</Label>
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                    <Checkbox id="traspaso" checked={traspasoPendiente} onCheckedChange={(v) => setTraspasoPendiente(!!v)} />
                    <Label htmlFor="traspaso" className="text-sm font-medium cursor-pointer">
                      Tiene traspaso de título pendiente
                    </Label>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveGeneral}
                      disabled={saving}
                      className="rounded-2xl h-11 px-6 shadow-lg shadow-primary/20 gap-2 font-bold"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar cambios
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="wishlist" className="mt-6">
              <ClientWishlistEditor cliente={cliente} concesionarioId={concesionarioId} onSaved={() => onSaved?.()} />
            </TabsContent>

            <TabsContent value="bitacora" className="mt-6">
              <ClientInteractionsTimeline cliente={cliente} concesionarioId={concesionarioId} />
            </TabsContent>

            <TabsContent value="compras" className="mt-6">
              <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem] overflow-hidden">
                <CardContent className="p-0">
                  {ventasLoading ? (
                    <div className="py-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    </div>
                  ) : !ventas || ventas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                      <div className="p-4 bg-muted/50 rounded-full mb-3">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground opacity-60" />
                      </div>
                      <p className="text-base font-bold font-headline">Sin compras registradas</p>
                      <p className="text-sm text-muted-foreground mt-1">Las ventas asociadas a este cliente aparecerán aquí.</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {ventas.map(v => (
                        <div key={v.id} className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-muted/30 transition-colors group">
                          <div className="w-11 h-11 bg-primary/5 rounded-2xl flex items-center justify-center border border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all flex-shrink-0">
                            <ShoppingBag className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{v.vehiculo_nombre}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                              {v.fecha?.toDate?.().toLocaleDateString('es-VE') ?? '—'}
                              {v.numero_factura_venta ? ` · Factura ${v.numero_factura_venta}` : ''}
                              {v.metodo_pago ? ` · ${v.metodo_pago}` : ''}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold font-headline text-primary text-base">{fmtUsd(v.precio_venta)}</p>
                            {v.status_pago && v.status_pago !== 'pagado' && (
                              <Badge variant="outline" className="text-[10px] mt-1 font-bold">{v.status_pago}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financiero" className="mt-6 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiMini icon={<DollarSign className="h-5 w-5" />} label="Invertido" value={fmtUsd(cliente.total_invertido)} accent="primary" />
                <KpiMini icon={<Wallet className="h-5 w-5" />} label="Deuda actual" value={fmtUsd(cliente.deuda_actual_usd)} accent={(cliente.deuda_actual_usd ?? 0) > 0.01 ? 'danger' : 'muted'} />
                <KpiMini icon={<ShieldAlert className="h-5 w-5" />} label="Créditos abiertos" value={String(cliente.ventas_credito_ids?.length ?? 0)} accent="muted" />
                <KpiMini icon={<Sparkles className="h-5 w-5" />} label="Riesgo" value={riesgo?.label ?? 'N/D'} accent={cliente.riesgo_credito === 'alto' ? 'danger' : cliente.riesgo_credito === 'medio' ? 'warning' : 'muted'} />
              </div>

              <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem] overflow-hidden">
                <CardContent className="p-0">
                  <div className="px-6 py-4 bg-muted/30 border-b">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuentas por cobrar abiertas</p>
                  </div>
                  {cxcAbiertas.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-muted-foreground">Sin saldos abiertos.</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {cxcAbiertas.map(r => (
                        <div key={r.id} className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-muted/30 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate">{r.descripcion || `Venta ${r.venta_id?.slice(0, 6)}`}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                              {r.cuotas_pagadas ?? 0}/{r.cuotas_total ?? 0} cuotas
                            </p>
                          </div>
                          <p className="font-bold font-headline text-red-600 text-base flex-shrink-0">{fmtUsd(r.saldo_pendiente_usd)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function KpiMini({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: 'primary' | 'danger' | 'warning' | 'muted' }) {
  const accentMap = {
    primary: { border: 'border-l-primary', text: 'text-primary' },
    danger: { border: 'border-l-red-500', text: 'text-red-600' },
    warning: { border: 'border-l-amber-500', text: 'text-amber-600' },
    muted: { border: 'border-l-slate-300', text: 'text-foreground' },
  }[accent];
  return (
    <Card className={cn('border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem] border-l-4', accentMap.border)}>
      <CardContent className="p-4">
        <div className={cn('flex items-center gap-1.5', accentMap.text)}>
          {icon}
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        </div>
        <p className={cn('text-xl font-bold font-headline tracking-tighter mt-2', accentMap.text)}>{value}</p>
      </CardContent>
    </Card>
  );
}
