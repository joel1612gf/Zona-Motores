/**
 * Centralised WhatsApp deep-link helper and Spanish-language templates used by
 * CRM, CXC dashboard and any module that needs to nudge a customer.
 */

export function openWhatsApp(phone: string, text?: string): void {
  if (typeof window === 'undefined') return;
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return;
  const url = text
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${cleanPhone}`;
  window.open(url, '_blank');
}

export type CobranzaTemplateContext = {
  clienteNombre: string;
  empresaNombre: string;
  cuotaNumero: number;
  cuotasTotal: number;
  montoUsd: number;
  fechaVencimientoIso: string; // YYYY-MM-DD
  descripcion?: string;        // e.g. "2020 Toyota Corolla"
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtFecha(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function templateCobranza(ctx: CobranzaTemplateContext): string {
  const item = ctx.descripcion ? ` correspondiente a ${ctx.descripcion}` : '';
  return (
    `Hola ${ctx.clienteNombre}, le saluda ${ctx.empresaNombre}. ` +
    `Le recordamos que su cuota ${ctx.cuotaNumero}/${ctx.cuotasTotal}${item} ` +
    `por ${fmtUsd(ctx.montoUsd)} vence el ${fmtFecha(ctx.fechaVencimientoIso)}. ` +
    `Quedamos atentos para coordinar el pago.`
  );
}

export function templateRecordatorio3d(ctx: CobranzaTemplateContext): string {
  const item = ctx.descripcion ? ` (${ctx.descripcion})` : '';
  return (
    `Hola ${ctx.clienteNombre}, en ${ctx.empresaNombre} le recordamos amablemente que su cuota ${ctx.cuotaNumero}/${ctx.cuotasTotal}${item} ` +
    `por ${fmtUsd(ctx.montoUsd)} vence en 3 días (${fmtFecha(ctx.fechaVencimientoIso)}). ` +
    `Si ya realizó el pago, por favor ignore este mensaje.`
  );
}

export function templateVencido(ctx: CobranzaTemplateContext): string {
  const item = ctx.descripcion ? ` por ${ctx.descripcion}` : '';
  return (
    `Hola ${ctx.clienteNombre}, le escribimos desde ${ctx.empresaNombre}. ` +
    `Su cuota ${ctx.cuotaNumero}/${ctx.cuotasTotal}${item} (${fmtUsd(ctx.montoUsd)}) ` +
    `está vencida desde el ${fmtFecha(ctx.fechaVencimientoIso)}. ` +
    `Le agradecemos comunicarse con nosotros para regularizar su situación.`
  );
}

export type ConfirmacionContext = {
  clienteNombre: string;
  empresaNombre: string;
  montoUsd: number;
  cuotaNumero?: number;
  cuotasTotal?: number;
  referencia?: string;
};

export type MatchVentaTemplateContext = {
  clienteNombre: string;
  concesionarioNombre: string;
  vehiculoMake: string;
  vehiculoModel: string;
  vehiculoYear?: number;
  precioUsd: number;
  linkVehiculo?: string;
};

export function templateMatchVenta(ctx: MatchVentaTemplateContext): string {
  const year = ctx.vehiculoYear ? ` ${ctx.vehiculoYear}` : '';
  const link = ctx.linkVehiculo ? ` Míralo aquí: ${ctx.linkVehiculo}` : '';
  return (
    `Hola ${ctx.clienteNombre}, le escribimos de ${ctx.concesionarioNombre}. ` +
    `Recordamos que estaba buscando un ${ctx.vehiculoMake} ${ctx.vehiculoModel}${year}. ` +
    `¡Acaba de ingresar uno a nuestro inventario por ${fmtUsd(ctx.precioUsd)} que se ajusta a lo que necesitaba!` +
    `${link} Quedamos atentos para coordinar una cita.`
  );
}

export function templateConfirmacionPago(ctx: ConfirmacionContext): string {
  const cuotaInfo = ctx.cuotaNumero && ctx.cuotasTotal
    ? ` correspondiente a la cuota ${ctx.cuotaNumero}/${ctx.cuotasTotal}`
    : '';
  const ref = ctx.referencia ? ` (Ref: ${ctx.referencia})` : '';
  return (
    `Hola ${ctx.clienteNombre}, confirmamos la recepción de su pago por ${fmtUsd(ctx.montoUsd)}` +
    `${cuotaInfo}${ref}. Gracias por su preferencia — ${ctx.empresaNombre}.`
  );
}
