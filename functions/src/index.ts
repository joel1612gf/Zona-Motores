import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { findMatches, ClienteLite } from './match-engine';

initializeApp();

export { onCompraCreated, onVentaCreated, backfillKardex } from './kardex-functions';
export { deleteTenant } from './admin-functions';
const db = getFirestore();

const HIDDEN_STATES = new Set(['vendido', 'oculto']);

export const onVehicleCreated = onDocumentCreated(
  'concesionarios/{cid}/inventario/{vid}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const cid = event.params.cid as string;
    const vid = event.params.vid as string;
    const veh = snap.data();
    if (!veh) return;
    if (HIDDEN_STATES.has(String(veh.estado_stock || ''))) {
      logger.info('Skip match: vehicle hidden/sold', { vid });
      return;
    }

    const precio_usd = Number(veh.precio_venta || 0);
    if (!precio_usd || !veh.make || !veh.model) {
      logger.info('Skip match: missing precio/make/model', { vid });
      return;
    }

    const clientesSnap = await db.collection(`concesionarios/${cid}/clientes`).get();
    const clientes: ClienteLite[] = [];
    clientesSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const reqs = (data.vehiculos_requeridos ?? []) as ClienteLite['vehiculos_requeridos'];
      if (!reqs || reqs.length === 0) return;
      clientes.push({
        id: d.id,
        nombre: String(data.nombre || ''),
        apellido: String(data.apellido || ''),
        telefono: data.telefono as string | undefined,
        vehiculos_requeridos: reqs,
      });
    });

    const matches = findMatches(
      { make: veh.make, model: veh.model, year: veh.year, precio_usd },
      clientes,
    );

    if (matches.length === 0) {
      logger.info('No matches', { vid, clientesCount: clientes.length });
      return;
    }

    const concRef = db.doc(`concesionarios/${cid}`);
    const concSnap = await concRef.get();
    const concData = concSnap.data() as Record<string, unknown> | undefined;
    const owner_uid = concData?.owner_uid as string | undefined;
    const slug = (concData?.slug as string | undefined) ?? cid;

    const matchesCol = db.collection(`concesionarios/${cid}/matches`);
    const now = FieldValue.serverTimestamp();
    let createdCount = 0;

    for (const m of matches) {
      const existing = await matchesCol
        .where('cliente_id', '==', m.cliente.id)
        .where('vehiculo_id', '==', vid)
        .where('requerido_id', '==', m.requerido.id)
        .limit(1)
        .get();
      if (!existing.empty) continue;

      const matchDoc: Record<string, unknown> = {
        cliente_id: m.cliente.id,
        cliente_nombre: `${m.cliente.nombre} ${m.cliente.apellido}`.trim(),
        vehiculo_id: vid,
        vehiculo_make: veh.make,
        vehiculo_model: veh.model,
        vehiculo_precio_usd: precio_usd,
        requerido_id: m.requerido.id,
        within_tolerance: m.within_tolerance,
        status: 'pendiente',
        created_at: now,
      };
      if (m.cliente.telefono) matchDoc.cliente_telefono = m.cliente.telefono;
      if (veh.year !== undefined) matchDoc.vehiculo_year = veh.year;
      if (m.requerido.budget !== undefined) matchDoc.budget = m.requerido.budget;

      await matchesCol.add(matchDoc);
      createdCount++;
    }

    if (createdCount === 0) {
      logger.info('All matches already existed (idempotent skip)', { vid });
      return;
    }

    if (owner_uid) {
      const vehLabel = `${veh.make} ${veh.model}${veh.year ? ` ${veh.year}` : ''}`;
      const title = '🔥 Match de venta';
      const message =
        createdCount === 1
          ? `Acaba de ingresar un ${vehLabel} y ${matches[0].cliente.nombre} ${matches[0].cliente.apellido} lo estaba buscando.`
          : `Acaba de ingresar un ${vehLabel} y tienes ${createdCount} cliente(s) buscándolo.`;

      await db.collection(`users/${owner_uid}/notifications`).add({
        userId: owner_uid,
        type: 'crm_match',
        title,
        message,
        read: false,
        createdAt: now,
        actionLabel: 'Ver oportunidades',
        actionUrl: `/business/${slug}/clients?tab=oportunidades`,
        vehicleId: vid,
        vehicleName: vehLabel,
      });
    }

    logger.info('Matches created', { vid, createdCount });
  },
);
