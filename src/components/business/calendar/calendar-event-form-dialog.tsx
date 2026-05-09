'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CalendarPlus } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useBusinessAuth } from '@/context/business-auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { format } from 'date-fns';
import {
  eventoCalendarioFormSchema,
  EVENTO_CATEGORIA_LABELS,
  EVENTO_VISIBILIDAD_LABELS,
  CATEGORIA_ICONS,
  CATEGORIA_TONES,
  getCreatableCategoriesForRole,
  type EventoCalendarioFormValues,
  type EventoCalendario,
  type EventoCategoria,
} from '@/lib/calendar-schemas';
import { cn } from '@/lib/utils';

type CalendarEventFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When editing an existing manual event */
  editing?: EventoCalendario | null;
  /** Pre-fill start date (when user clicks a slot) */
  initialDate?: Date;
};

const toLocalDateInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
const toLocalDayInput = (d: Date) => format(d, 'yyyy-MM-dd');

export function CalendarEventFormDialog({
  open,
  onOpenChange,
  editing,
  initialDate,
}: CalendarEventFormDialogProps) {
  const firestore = useFirestore();
  const { concesionario, staff, currentRole } = useBusinessAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const creatableCategories = useMemo(() => getCreatableCategoriesForRole(currentRole), [currentRole]);

  const defaultStart = initialDate ?? new Date();
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventoCalendarioFormValues>({
    resolver: zodResolver(eventoCalendarioFormSchema),
    defaultValues: {
      titulo: '',
      descripcion: '',
      categoria: creatableCategories[0] ?? 'recordatorio',
      inicio: defaultStart,
      fin: defaultEnd,
      todo_el_dia: false,
      visibilidad: 'equipo',
    },
  });

  const todoElDia = watch('todo_el_dia');
  const categoria = watch('categoria');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        titulo: editing.titulo,
        descripcion: editing.descripcion ?? '',
        categoria: editing.categoria,
        inicio: editing.inicio.toDate(),
        fin: editing.fin.toDate(),
        todo_el_dia: editing.todo_el_dia,
        responsable_id: editing.responsable_id,
        responsable_nombre: editing.responsable_nombre,
        cliente_id: editing.cliente_id,
        cliente_nombre: editing.cliente_nombre,
        vehiculo_id: editing.vehiculo_id,
        vehiculo_nombre: editing.vehiculo_nombre,
        visibilidad: editing.visibilidad,
      });
    } else {
      reset({
        titulo: '',
        descripcion: '',
        categoria: creatableCategories[0] ?? 'recordatorio',
        inicio: defaultStart,
        fin: defaultEnd,
        todo_el_dia: false,
        visibilidad: 'equipo',
      });
    }
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values: EventoCalendarioFormValues) => {
    if (!concesionario || !staff) return;
    setIsSaving(true);
    try {
      const baseDoc: Omit<EventoCalendario, 'id' | 'creado_en' | 'actualizado_en'> & {
        creado_en: any;
        actualizado_en?: any;
      } = {
        titulo: values.titulo.trim(),
        descripcion: values.descripcion?.trim() || undefined,
        categoria: values.categoria,
        inicio: Timestamp.fromDate(values.inicio),
        fin: Timestamp.fromDate(values.fin),
        todo_el_dia: values.todo_el_dia,
        responsable_id: values.responsable_id || undefined,
        responsable_nombre: values.responsable_nombre || undefined,
        cliente_id: values.cliente_id || undefined,
        cliente_nombre: values.cliente_nombre || undefined,
        vehiculo_id: values.vehiculo_id || undefined,
        vehiculo_nombre: values.vehiculo_nombre || undefined,
        visibilidad: values.visibilidad,
        estado: editing?.estado ?? 'pendiente',
        creado_por_id: editing?.creado_por_id ?? staff.id,
        creado_por_nombre: editing?.creado_por_nombre ?? staff.nombre,
        creado_en: editing ? editing.creado_en : serverTimestamp(),
      };
      // Strip undefined values (Firestore rejects them)
      const clean = Object.fromEntries(Object.entries(baseDoc).filter(([, v]) => v !== undefined));

      if (editing) {
        const ref = doc(firestore, 'concesionarios', concesionario.id, 'eventos_calendario', editing.id);
        await updateDoc(ref, { ...clean, actualizado_en: serverTimestamp() });
        toast({ title: 'Evento actualizado' });
      } else {
        const ref = collection(firestore, 'concesionarios', concesionario.id, 'eventos_calendario');
        await addDoc(ref, clean);
        toast({ title: 'Evento creado', description: values.titulo });
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al guardar', description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (creatableCategories.length === 0) {
    // Role can't create — guard
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-[90vw] max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <CalendarPlus className="h-5 w-5 text-primary-foreground" />
            </div>
            <DialogTitle className="font-headline text-xl tracking-tight">
              {editing ? 'Editar evento' : 'Nuevo evento'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Agenda un recordatorio, prueba de manejo, entrega o reunión.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="titulo" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Título
            </Label>
            <Input
              id="titulo"
              {...register('titulo')}
              placeholder="Ej. Entrega Toyota Corolla a Juan Pérez"
              className="rounded-xl h-12 border-slate-200 focus:border-primary/50"
            />
            {errors.titulo && <p className="text-xs text-red-600 font-medium">{errors.titulo.message}</p>}
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoría</Label>
            <Controller
              control={control}
              name="categoria"
              render={({ field }) => (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {creatableCategories.map((cat) => {
                    const Icon = CATEGORIA_ICONS[cat];
                    const tone = CATEGORIA_TONES[cat];
                    const isActive = field.value === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => field.onChange(cat)}
                        className={cn(
                          'rounded-xl border h-14 px-3 flex items-center gap-2 text-left transition-all',
                          isActive
                            ? cn(tone.chipBg, tone.chipText, 'border-current shadow-sm')
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                        )}
                      >
                        <Icon className={cn('h-4 w-4', isActive ? tone.iconColor : 'text-slate-400')} />
                        <span className="text-xs font-bold truncate">{EVENTO_CATEGORIA_LABELS[cat]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>

          {/* Todo el día */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 h-12 border border-slate-200">
            <Label htmlFor="todo_el_dia" className="text-sm font-bold cursor-pointer">
              Todo el día
            </Label>
            <Controller
              control={control}
              name="todo_el_dia"
              render={({ field }) => (
                <Switch id="todo_el_dia" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {/* Inicio / Fin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {todoElDia ? 'Día' : 'Inicio'}
              </Label>
              <Controller
                control={control}
                name="inicio"
                render={({ field }) => (
                  <Input
                    type={todoElDia ? 'date' : 'datetime-local'}
                    value={todoElDia ? toLocalDayInput(field.value) : toLocalDateInput(field.value)}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      field.onChange(newDate);
                      // Si fin < inicio, sincronizar
                      const fin = watch('fin');
                      if (fin < newDate) setValue('fin', new Date(newDate.getTime() + 60 * 60 * 1000));
                    }}
                    className="rounded-xl h-12 border-slate-200 focus:border-primary/50"
                  />
                )}
              />
              {errors.inicio && <p className="text-xs text-red-600 font-medium">{errors.inicio.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fin</Label>
              <Controller
                control={control}
                name="fin"
                render={({ field }) => (
                  <Input
                    type={todoElDia ? 'date' : 'datetime-local'}
                    value={todoElDia ? toLocalDayInput(field.value) : toLocalDateInput(field.value)}
                    onChange={(e) => field.onChange(new Date(e.target.value))}
                    className="rounded-xl h-12 border-slate-200 focus:border-primary/50"
                  />
                )}
              />
              {errors.fin && <p className="text-xs text-red-600 font-medium">{errors.fin.message}</p>}
            </div>
          </div>

          {/* Visibilidad */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Visibilidad
            </Label>
            <Controller
              control={control}
              name="visibilidad"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-xl h-12 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(['privada', 'equipo', 'todos'] as const).map((v) => (
                      <SelectItem key={v} value={v} className="font-bold">
                        {EVENTO_VISIBILIDAD_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Cliente / Vehículo opcionales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Cliente (opcional)
              </Label>
              <Input
                {...register('cliente_nombre')}
                placeholder="Nombre del cliente"
                className="rounded-xl h-12 border-slate-200 focus:border-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Vehículo (opcional)
              </Label>
              <Input
                {...register('vehiculo_nombre')}
                placeholder="Ej. Toyota Corolla 2020"
                className="rounded-xl h-12 border-slate-200 focus:border-primary/50"
              />
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Notas (opcional)
            </Label>
            <Textarea
              {...register('descripcion')}
              rows={3}
              placeholder="Detalles adicionales..."
              className="rounded-xl border-slate-200 focus:border-primary/50 resize-none"
            />
            {errors.descripcion && <p className="text-xs text-red-600 font-medium">{errors.descripcion.message}</p>}
          </div>

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl shadow-xl shadow-primary/20 font-bold w-full sm:w-auto gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Guardar cambios' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
