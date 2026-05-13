'use client';

import { useMemo, useState } from 'react';
import { collection, orderBy, query, limit } from 'firebase/firestore';
import { Phone, MessageCircle, Users as UsersIcon, StickyNote, Mail, CalendarPlus, Send, Loader2 } from 'lucide-react';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { addInteraccion, scheduleFollowUp } from '@/lib/crm-actions';
import type { Cliente, Interaccion, InteraccionTipo } from '@/lib/business-types';

const TIPO_LABEL: Record<InteraccionTipo, string> = {
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  visita: 'Visita',
  nota: 'Nota',
  email: 'Email',
};

function TipoIcon({ tipo, className }: { tipo: InteraccionTipo; className?: string }) {
  const cls = cn('h-4 w-4', className);
  switch (tipo) {
    case 'llamada': return <Phone className={cn(cls, 'text-primary')} />;
    case 'whatsapp': return <MessageCircle className={cn(cls, 'text-emerald-600')} />;
    case 'visita': return <UsersIcon className={cn(cls, 'text-purple-500')} />;
    case 'email': return <Mail className={cn(cls, 'text-amber-500')} />;
    case 'nota':
    default: return <StickyNote className={cn(cls, 'text-slate-500')} />;
  }
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Ayer';
  if (d < 7) return `hace ${d} días`;
  return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  cliente: Cliente;
  concesionarioId: string;
}

export function ClientInteractionsTimeline({ cliente, concesionarioId }: Props) {
  const firestore = useFirestore();
  const { staff } = useBusinessAuth();
  const { toast } = useToast();

  const [tipo, setTipo] = useState<InteraccionTipo>('nota');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpWhen, setFollowUpWhen] = useState('');
  const [followUpNota, setFollowUpNota] = useState('');
  const [followUpSaving, setFollowUpSaving] = useState(false);

  const interaccionesQuery = useMemoFirebase(() => {
    if (!firestore || !concesionarioId || !cliente.id) return null;
    return query(
      collection(firestore, 'concesionarios', concesionarioId, 'clientes', cliente.id, 'interacciones'),
      orderBy('fecha', 'desc'),
      limit(50),
    );
  }, [firestore, concesionarioId, cliente.id]);

  const { data: interacciones, isLoading } = useCollection<Interaccion>(interaccionesQuery);
  const items = useMemo(() => interacciones ?? [], [interacciones]);

  const handleSubmit = async () => {
    if (!staff || !nota.trim()) return;
    setSaving(true);
    try {
      await addInteraccion(firestore, concesionarioId, cliente.id, {
        tipo,
        nota: nota.trim(),
        creado_por_id: staff.id,
        creado_por_nombre: staff.nombre,
      });
      setNota('');
      toast({ title: 'Interacción registrada' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'No se pudo registrar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleFollowUp = async () => {
    if (!staff || !followUpWhen) return;
    setFollowUpSaving(true);
    try {
      await scheduleFollowUp(firestore, concesionarioId, cliente, { id: staff.id, nombre: staff.nombre }, {
        when: new Date(followUpWhen),
        nota: followUpNota.trim(),
      });
      setFollowUpOpen(false);
      setFollowUpWhen('');
      setFollowUpNota('');
      toast({ title: 'Seguimiento agendado', description: 'Evento creado en el calendario.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'No se pudo agendar.', variant: 'destructive' });
    } finally {
      setFollowUpSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Form rápido */}
      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.5rem] overflow-hidden">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registrar interacción</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl h-9 px-3 border-primary/20 hover:bg-primary/5 font-bold gap-1.5"
              onClick={() => setFollowUpOpen(o => !o)}
            >
              <CalendarPlus className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs">Agendar seguimiento</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 items-start">
            <Select value={tipo} onValueChange={(v) => setTipo(v as InteraccionTipo)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(Object.keys(TIPO_LABEL) as InteraccionTipo[]).map(t => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-2">
                      <TipoIcon tipo={t} className="h-3.5 w-3.5" />
                      {TIPO_LABEL[t]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Detalle breve (ej: llamé, no contesta, intento mañana)"
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={2}
              className="resize-none rounded-xl border-slate-200 focus:border-primary/50"
            />
            <Button
              onClick={handleSubmit}
              disabled={!nota.trim() || saving || !staff}
              className="h-11 w-11 rounded-xl shadow-lg shadow-primary/20"
              size="icon"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {followUpOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-2 items-start pt-3 border-t border-border/50">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha y hora</Label>
                <Input
                  type="datetime-local"
                  value={followUpWhen}
                  onChange={e => setFollowUpWhen(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Motivo (opcional)</Label>
                <Input
                  placeholder="Ej: llamar para confirmar pago"
                  value={followUpNota}
                  onChange={e => setFollowUpNota(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 focus:border-primary/50 mt-1"
                />
              </div>
              <Button
                onClick={handleScheduleFollowUp}
                disabled={!followUpWhen || followUpSaving || !staff}
                className="h-11 rounded-xl mt-5 shadow-lg shadow-primary/20 px-5 font-bold"
              >
                {followUpSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agendar'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Historial</p>
        {isLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <Card className="bg-card/40 backdrop-blur-md border-dashed border-2 border-muted-foreground/20 rounded-[1.5rem]">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 bg-muted/50 rounded-full mb-3">
                <StickyNote className="h-7 w-7 text-muted-foreground opacity-60" />
              </div>
              <p className="text-base font-bold font-headline">Sin interacciones</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">Cada llamada, visita o nota queda registrada aquí para todo el equipo.</p>
            </CardContent>
          </Card>
        ) : (
          <ol className="relative border-l-2 border-border ml-3 space-y-3 pl-5">
            {items.map((it) => {
              const date = it.fecha?.toDate?.() ?? new Date();
              return (
                <li key={it.id} className="relative">
                  <span className="absolute -left-[31px] top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background ring-2 ring-border">
                    <TipoIcon tipo={it.tipo} />
                  </span>
                  <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[1.25rem] overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{TIPO_LABEL[it.tipo]}</span>
                        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">{formatRelative(date)}</span>
                      </div>
                      <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed">{it.nota}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">— {it.creado_por_nombre}</p>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
