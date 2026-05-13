'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, HandCoins, Percent, Repeat } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatCurrency } from '@/lib/utils';
import { generarCuotas, type GeneratedCuota } from '@/lib/receivable-schemas';
import type { CreditFrequency } from '@/lib/business-types';
import { CREDIT_FREQUENCY_LABELS } from '@/lib/business-types';

export type CreditPlanDraft = {
  cuotas_total: number;
  frecuencia: CreditFrequency;
  tasa_interes_anual: number;
  inicial_usd: number;
  fecha_primera_cuota: Date;
  saldo_financiado_usd: number;
  monto_cuota_usd: number;
  total_con_interes_usd: number;
};

export type CreditPlanResult = {
  valido: boolean;
  plan: CreditPlanDraft | null;
  cuotas: GeneratedCuota[];
};

interface CreditTermsConfigProps {
  totalVenta: number;
  onChange: (result: CreditPlanResult) => void;
  defaultValues?: Partial<CreditPlanDraft>;
}

const DEFAULT_FREQUENCY: CreditFrequency = 'mensual';

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function CreditTermsConfig({ totalVenta, onChange, defaultValues }: CreditTermsConfigProps) {
  const [cuotas, setCuotas] = useState<number>(defaultValues?.cuotas_total ?? 3);
  const [frecuencia, setFrecuencia] = useState<CreditFrequency>(defaultValues?.frecuencia ?? DEFAULT_FREQUENCY);
  const [tasa, setTasa] = useState<number>(defaultValues?.tasa_interes_anual ?? 0);
  const [inicial, setInicial] = useState<number>(defaultValues?.inicial_usd ?? 0);
  const [primeraFecha, setPrimeraFecha] = useState<Date>(() => {
    if (defaultValues?.fecha_primera_cuota) return defaultValues.fecha_primera_cuota;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  });

  const result = useMemo<CreditPlanResult>(() => {
    const saldoFinanciado = Math.max(0, totalVenta - inicial);
    const errores: string[] = [];

    if (!Number.isFinite(totalVenta) || totalVenta <= 0) errores.push('totalVenta');
    if (!Number.isInteger(cuotas) || cuotas < 1 || cuotas > 60) errores.push('cuotas');
    if (tasa < 0 || tasa > 100) errores.push('tasa');
    if (inicial < 0 || inicial >= totalVenta) errores.push('inicial');
    if (!(primeraFecha instanceof Date) || Number.isNaN(primeraFecha.getTime())) errores.push('fecha');

    if (errores.length > 0 || saldoFinanciado <= 0) {
      return { valido: false, plan: null, cuotas: [] };
    }

    const generadas = generarCuotas(saldoFinanciado, tasa, cuotas, frecuencia, primeraFecha);
    const totalConInteres = generadas.reduce((s, c) => s + c.monto_usd, 0);
    const montoCuota = generadas[0]?.monto_usd ?? 0;

    return {
      valido: true,
      plan: {
        cuotas_total: cuotas,
        frecuencia,
        tasa_interes_anual: tasa,
        inicial_usd: inicial,
        fecha_primera_cuota: primeraFecha,
        saldo_financiado_usd: saldoFinanciado,
        monto_cuota_usd: montoCuota,
        total_con_interes_usd: totalConInteres,
      },
      cuotas: generadas,
    };
  }, [totalVenta, cuotas, frecuencia, tasa, inicial, primeraFecha]);

  useEffect(() => {
    onChange(result);
    // intentionally omitting onChange from deps to avoid loops with non-memoized callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const totalInteres = (result.plan?.total_con_interes_usd ?? 0) - (result.plan?.saldo_financiado_usd ?? 0);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border bg-card/60 backdrop-blur-md ring-1 ring-border shadow-xl p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">
          Términos del Financiamiento
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cuotas" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Repeat className="h-3 w-3" />
              Cuotas
            </Label>
            <Input
              id="cuotas"
              type="number"
              min={1}
              max={60}
              value={cuotas}
              onChange={(e) => setCuotas(parseInt(e.target.value, 10) || 0)}
              className="h-11 rounded-xl bg-background/60 font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3" />
              Frecuencia
            </Label>
            <Select value={frecuencia} onValueChange={(v) => setFrecuencia(v as CreditFrequency)}>
              <SelectTrigger className="h-11 rounded-xl bg-background/60 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CREDIT_FREQUENCY_LABELS) as CreditFrequency[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {CREDIT_FREQUENCY_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tasa" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Percent className="h-3 w-3" />
              Interés anual %
            </Label>
            <Input
              id="tasa"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={tasa}
              onChange={(e) => setTasa(parseFloat(e.target.value) || 0)}
              className="h-11 rounded-xl bg-background/60 font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inicial" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <HandCoins className="h-3 w-3" />
              Inicial USD
            </Label>
            <Input
              id="inicial"
              type="number"
              min={0}
              step={10}
              value={inicial}
              onChange={(e) => setInicial(parseFloat(e.target.value) || 0)}
              className="h-11 rounded-xl bg-background/60 font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primera-fecha" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3" />
              Primera cuota
            </Label>
            <Input
              id="primera-fecha"
              type="date"
              value={toIsoDate(primeraFecha)}
              onChange={(e) => {
                const next = e.target.valueAsDate ?? new Date(e.target.value);
                if (next && !Number.isNaN(next.getTime())) setPrimeraFecha(next);
              }}
              className="h-11 rounded-xl bg-background/60 font-bold"
            />
          </div>
        </div>

        {!result.valido && (
          <p className="mt-4 text-xs font-bold text-rose-500">
            Revise los valores: la inicial debe ser menor al total y las cuotas entre 1 y 60.
          </p>
        )}

        {result.valido && result.plan && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Mini label="Saldo financiado" value={formatCurrency(result.plan.saldo_financiado_usd, 'USD')} />
            <Mini label="Cuota fija" value={formatCurrency(result.plan.monto_cuota_usd, 'USD')} accent />
            <Mini label="Total intereses" value={formatCurrency(totalInteres, 'USD')} />
            <Mini label="Total a cobrar" value={formatCurrency(result.plan.total_con_interes_usd, 'USD')} />
          </div>
        )}
      </div>

      {result.valido && result.cuotas.length > 0 && (
        <div className="rounded-[2rem] border bg-card/60 backdrop-blur-md ring-1 ring-border shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Plan de Amortización
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">#</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vence</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Capital</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Interés</th>
                  <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Cuota</th>
                </tr>
              </thead>
              <tbody>
                {result.cuotas.map((c) => (
                  <tr key={c.numero} className="border-t border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-2.5 font-bold">{c.numero}</td>
                    <td className="px-6 py-2.5 text-muted-foreground">{c.fecha_vencimiento.toLocaleDateString('es-VE')}</td>
                    <td className="px-6 py-2.5 text-right font-medium">{formatCurrency(c.capital, 'USD')}</td>
                    <td className="px-6 py-2.5 text-right text-muted-foreground">{formatCurrency(c.interes, 'USD')}</td>
                    <td className="px-6 py-2.5 text-right font-bold text-primary">{formatCurrency(c.monto_usd, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn(
      'rounded-2xl border bg-background/40 p-3',
      accent && 'border-primary/30 bg-primary/5'
    )}>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn('text-base font-bold mt-1', accent && 'text-primary')}>{value}</p>
    </div>
  );
}
