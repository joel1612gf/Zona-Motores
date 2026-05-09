'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Clock,
  Phone,
  User,
  Building2,
  ArrowRight,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import {
  EVENTO_CATEGORIA_LABELS,
  EVENTO_VISIBILIDAD_LABELS,
  EVENTO_ESTADO_LABELS,
  canEditManualEvent,
  type UnifiedCalendarEvent,
  type EventoCalendario,
} from '@/lib/calendar-schemas';

type CalendarEventDetailDialogProps = {
  event: UnifiedCalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: UnifiedCalendarEvent) => void;
};

export function CalendarEventDetailDialog({
  event,
  open,
  onOpenChange,
  onEdit,
}: CalendarEventDetailDialogProps) {
  const router = useRouter();
  const { slug } = useParams();
  const { concesionario, currentRole, staff } = useBusinessAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!event) return null;
  const Icon = event.icon;

  const goToOrigin = () => {
    onOpenChange(false);
    if (event.source === 'cita') router.push(`/business/${slug}/consignment`);
    if (event.source === 'cxp') router.push(`/business/${slug}/payables`);
  };

  const isManual = event.source === 'manual';
  const manualData = isManual ? (event.raw as EventoCalendario) : null;
  const canEdit = manualData ? canEditManualEvent(manualData, currentRole, staff?.id ?? null) : false;

  const handleDelete = () => {
    if (!manualData || !concesionario) return;
    const ref = doc(firestore, 'concesionarios', concesionario.id, 'eventos_calendario', manualData.id);
    updateDocumentNonBlocking(ref, { estado: 'cancelado' });
    toast({ title: 'Evento cancelado', description: 'El evento se ocultó del calendario.' });
    setConfirmDelete(false);
    onOpenChange(false);
  };

  const handleComplete = () => {
    if (!manualData || !concesionario) return;
    const ref = doc(firestore, 'concesionarios', concesionario.id, 'eventos_calendario', manualData.id);
    updateDocumentNonBlocking(ref, { estado: 'completado' });
    toast({ title: 'Marcado como completado' });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md w-[90vw] bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center border-l-4 shrink-0',
                  event.tone.chipBg,
                  event.tone.borderLeft
                )}
              >
                <Icon className={cn('h-5 w-5', event.tone.iconColor)} />
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-0',
                  event.tone.chipBg,
                  event.tone.chipText
                )}
              >
                {event.source === 'cita' && 'Cita'}
                {event.source === 'cxp' && (event.meta?.overdue ? 'Vencido' : 'Por vencer')}
                {event.source === 'manual' && manualData && EVENTO_CATEGORIA_LABELS[manualData.categoria]}
              </Badge>
            </div>
            <DialogTitle className="font-headline text-xl tracking-tight">{event.title}</DialogTitle>
            {manualData?.descripcion && (
              <DialogDescription className="text-muted-foreground">{manualData.descripcion}</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-3 py-2">
            <DetailRow icon={<Clock className="h-4 w-4 text-primary" />} label="Cuándo">
              <span className="capitalize">
                {format(event.start, "EEEE d 'de' MMMM", { locale: es })}
                {!event.allDay && ` · ${format(event.start, 'HH:mm')}`}
                {event.allDay && ' · Todo el día'}
              </span>
            </DetailRow>

            {/* Source-specific details */}
            {event.source === 'cita' && (
              <>
                {event.raw?.publicador_nombre && (
                  <DetailRow icon={<User className="h-4 w-4 text-primary" />} label="Cliente">
                    {event.raw.publicador_nombre}
                  </DetailRow>
                )}
                {event.raw?.publicador_telefono && (
                  <DetailRow icon={<Phone className="h-4 w-4 text-primary" />} label="Teléfono">
                    {event.raw.publicador_telefono}
                  </DetailRow>
                )}
                {event.raw?.vendedor_nombre && (
                  <DetailRow icon={<User className="h-4 w-4 text-primary" />} label="Atiende">
                    {event.raw.vendedor_nombre}
                  </DetailRow>
                )}
              </>
            )}

            {event.source === 'cxp' && (
              <>
                {event.raw?.proveedor_nombre && (
                  <DetailRow icon={<Building2 className="h-4 w-4 text-primary" />} label="Proveedor">
                    {event.raw.proveedor_nombre}
                  </DetailRow>
                )}
                {event.meta?.monto !== undefined && (
                  <DetailRow icon={<ArrowRight className="h-4 w-4 text-primary" />} label="Monto">
                    <span className="font-bold font-headline">{formatCurrency(event.meta.monto, 'USD')}</span>
                  </DetailRow>
                )}
              </>
            )}

            {event.source === 'manual' && manualData && (
              <>
                {manualData.responsable_nombre && (
                  <DetailRow icon={<User className="h-4 w-4 text-primary" />} label="Responsable">
                    {manualData.responsable_nombre}
                  </DetailRow>
                )}
                {manualData.cliente_nombre && (
                  <DetailRow icon={<User className="h-4 w-4 text-primary" />} label="Cliente">
                    {manualData.cliente_nombre}
                  </DetailRow>
                )}
                {manualData.vehiculo_nombre && (
                  <DetailRow icon={<ArrowRight className="h-4 w-4 text-primary" />} label="Vehículo">
                    {manualData.vehiculo_nombre}
                  </DetailRow>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold uppercase tracking-tight">
                    {EVENTO_VISIBILIDAD_LABELS[manualData.visibilidad]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'rounded-full text-[10px] font-bold uppercase tracking-tight',
                      manualData.estado === 'completado' && 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    )}
                  >
                    {EVENTO_ESTADO_LABELS[manualData.estado]}
                  </Badge>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
            {!isManual && (
              <Button
                onClick={goToOrigin}
                className="rounded-xl shadow-lg shadow-primary/20 font-bold gap-2 w-full sm:w-auto"
              >
                Ir al origen <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {isManual && canEdit && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold gap-2 w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" /> Cancelar
                </Button>
                {manualData?.estado !== 'completado' && (
                  <Button
                    variant="outline"
                    onClick={handleComplete}
                    className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-bold gap-2 w-full sm:w-auto"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Completar
                  </Button>
                )}
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    onEdit?.(event);
                  }}
                  className="rounded-xl shadow-lg shadow-primary/20 font-bold gap-2 w-full sm:w-auto"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
              </>
            )}
            {(!isManual || !canEdit) && (
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl font-bold w-full sm:w-auto"
              >
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-white rounded-[2rem] border-slate-200 shadow-2xl w-[90vw] sm:w-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold font-headline">¿Cancelar evento?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              El evento se ocultará del calendario, pero el registro se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3 flex-row">
            <AlertDialogCancel className="rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-widest h-12 flex-1 sm:flex-none m-0">
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700 rounded-xl px-8 font-bold h-12 flex-1 sm:flex-none m-0 inline-flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" /> Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
      <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{children}</p>
      </div>
    </div>
  );
}
