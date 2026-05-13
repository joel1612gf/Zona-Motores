/**
 * Kárdex Cloud Functions
 * - onCompraCreate: Firestore trigger → registra movimiento de entrada con CPP.
 * - onVentaCreate: Firestore trigger → registra movimiento de salida.
 * - backfillKardex: HTTPS callable → reconstruye histórico (solo dueño).
 *
 * Idempotencia: cada KardexMovement lleva origen_doc_id; los triggers chequean existencia previa.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { weightedAverageCost, CompraItemLite, VentaItemLite } from './kardex';

const db = () => getFirestore();

type KardexWriteInput = {
  concesionarioId: string;
  producto_id: string;
  fecha: Timestamp;
  tipo: 'entrada' | 'salida';
  origen: 'compra' | 'venta' | 'ajuste';
  origen_doc_id: string;
  cantidad: number;
  costo_unitario: number;
};

/**
 * Core: atomically writes a kardex movement AND updates the product's
 * stock_actual + costo_usd (weighted average) in one transaction.
 * Returns false if a movement for this origen_doc_id+producto_id already exists (idempotent skip).
 */
async function writeKardexMovement(input: KardexWriteInput): Promise<boolean> {
  const { concesionarioId, producto_id, origen_doc_id, tipo } = input;
  const fs = db();

  const movCol = fs.collection(`concesionarios/${concesionarioId}/kardex_movements`);
  const dedupKey = `${origen_doc_id}_${producto_id}_${tipo}`;
  // Composite-key based dedup via doc id
  const movRef = movCol.doc(dedupKey);

  const prodRef = fs.doc(`concesionarios/${concesionarioId}/productos/${producto_id}`);

  await fs.runTransaction(async (tx) => {
    const movSnap = await tx.get(movRef);
    if (movSnap.exists) {
      logger.info('Kardex movement already exists, skipping', { dedupKey });
      return;
    }
    const prodSnap = await tx.get(prodRef);
    if (!prodSnap.exists) {
      logger.warn('Producto not found for kardex movement', { producto_id });
      return;
    }
    const prod = prodSnap.data() as { stock_actual?: number; costo_usd?: number };
    const currentQty = prod.stock_actual ?? 0;
    const currentCost = prod.costo_usd ?? 0;

    let newQty: number;
    let newCost: number;
    let movCostUnit: number;
    let movValor: number;

    if (input.tipo === 'entrada') {
      newCost = weightedAverageCost(currentQty, currentCost, input.cantidad, input.costo_unitario);
      newQty = currentQty + input.cantidad;
      movCostUnit = input.costo_unitario;
      movValor = input.cantidad * input.costo_unitario;
    } else {
      // salida → use current weighted average as cost of sale
      newCost = currentCost;
      newQty = currentQty - input.cantidad;
      movCostUnit = currentCost;
      movValor = input.cantidad * currentCost;
    }

    tx.set(movRef, {
      producto_id,
      fecha: input.fecha,
      tipo: input.tipo,
      origen: input.origen,
      origen_doc_id,
      cantidad: input.cantidad,
      costo_unitario: movCostUnit,
      valor_total: movValor,
      saldo_cantidad: newQty,
      saldo_costo_promedio: newCost,
      saldo_valor_total: newQty * newCost,
      created_at: FieldValue.serverTimestamp(),
    });

    tx.update(prodRef, {
      stock_actual: newQty,
      costo_usd: newCost,
      updated_at: FieldValue.serverTimestamp(),
    });
  });

  return true;
}

// ==================== TRIGGER: COMPRA CREATED ====================

export const onCompraCreated = onDocumentCreated(
  'concesionarios/{cid}/compras/{compraId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const cid = event.params.cid as string;
    const compraId = event.params.compraId as string;
    const compra = snap.data() as { items?: CompraItemLite[]; created_at?: Timestamp; fecha_factura?: string };

    const items = compra.items ?? [];
    if (!items.length) {
      logger.info('Compra has no items, skipping kardex', { compraId });
      return;
    }

    const fecha = compra.created_at ?? Timestamp.now();

    for (const item of items) {
      if (!item.producto_id || item.producto_id.startsWith('new-')) continue;
      if (!item.cantidad || item.cantidad <= 0) continue;
      try {
        await writeKardexMovement({
          concesionarioId: cid,
          producto_id: item.producto_id,
          fecha,
          tipo: 'entrada',
          origen: 'compra',
          origen_doc_id: compraId,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario_usd ?? 0,
        });
      } catch (err) {
        logger.error('Failed to write kardex entry from compra', { compraId, producto_id: item.producto_id, err });
      }
    }
  },
);

// ==================== TRIGGER: VENTA CREATED ====================

export const onVentaCreated = onDocumentCreated(
  'concesionarios/{cid}/ventas/{ventaId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const cid = event.params.cid as string;
    const ventaId = event.params.ventaId as string;
    const venta = snap.data() as { items?: VentaItemLite[]; fecha?: Timestamp; tipo_venta?: string };

    if (venta.tipo_venta && venta.tipo_venta !== 'producto') {
      // Vehicle sales don't move product kardex
      return;
    }

    const items = venta.items ?? [];
    if (!items.length) return;

    const fecha = venta.fecha ?? Timestamp.now();

    for (const item of items) {
      if (!item.producto_id) continue;
      if (!item.cantidad || item.cantidad <= 0) continue;
      try {
        await writeKardexMovement({
          concesionarioId: cid,
          producto_id: item.producto_id,
          fecha,
          tipo: 'salida',
          origen: 'venta',
          origen_doc_id: ventaId,
          cantidad: item.cantidad,
          costo_unitario: 0, // ignored for salidas (uses current avg)
        });
      } catch (err) {
        logger.error('Failed to write kardex salida from venta', { ventaId, producto_id: item.producto_id, err });
      }
    }
  },
);

// ==================== CALLABLE: BACKFILL KARDEX ====================

/**
 * Reconstructs the full kardex from existing compras + ventas history.
 * Only callable by the concesionario's `dueno` (verified via staff lookup).
 *
 * Steps:
 *  1) Auth check: caller is `dueno` of this concesionario.
 *  2) Delete the kardex_movements collection.
 *  3) Reset all productos: stock_actual=0, costo_usd=0.
 *  4) Merge compras+ventas chronologically and replay each through writeKardexMovement.
 */
export const backfillKardex = onCall(async (request) => {
  const { concesionarioId, staffId } = (request.data ?? {}) as { concesionarioId?: string; staffId?: string };
  if (!concesionarioId) throw new HttpsError('invalid-argument', 'concesionarioId requerido');

  const fs = db();

  // Auth: SaaS uses a PIN-based custom session decoupled from Firebase Auth, so
  // request.auth.uid may not match owner_uid. Accept either:
  //   (A) Firebase Auth UID matches concesionario.owner_uid (marketplace owner path), OR
  //   (B) A valid staffId with rol='dueno' and activo=true is provided (business session path).
  const concSnap = await fs.doc(`concesionarios/${concesionarioId}`).get();
  if (!concSnap.exists) throw new HttpsError('not-found', 'Concesionario no encontrado');
  const concData = concSnap.data() as { owner_uid?: string };

  const callerUid = request.auth?.uid;
  const matchesOwner = !!callerUid && concData.owner_uid === callerUid;

  let matchesStaffOwner = false;
  if (!matchesOwner && staffId) {
    const staffSnap = await fs.doc(`concesionarios/${concesionarioId}/staff/${staffId}`).get();
    if (staffSnap.exists) {
      const sd = staffSnap.data() as { rol?: string; activo?: boolean };
      matchesStaffOwner = sd.rol === 'dueno' && sd.activo !== false;
    }
  }

  if (!matchesOwner && !matchesStaffOwner) {
    throw new HttpsError('permission-denied', 'Solo el dueño puede reconstruir el kárdex');
  }

  // 1) Delete kardex_movements (batched)
  const movCol = fs.collection(`concesionarios/${concesionarioId}/kardex_movements`);
  let deleted = 0;
  while (true) {
    const batch = await movCol.limit(400).get();
    if (batch.empty) break;
    const writer = fs.batch();
    batch.docs.forEach((d) => writer.delete(d.ref));
    await writer.commit();
    deleted += batch.size;
    if (batch.size < 400) break;
  }
  logger.info('Backfill: deleted prior kardex movements', { deleted });

  // 2) Reset productos
  const prodSnap = await fs.collection(`concesionarios/${concesionarioId}/productos`).get();
  {
    const writer = fs.batch();
    prodSnap.docs.forEach((d) => writer.update(d.ref, { stock_actual: 0, costo_usd: 0 }));
    await writer.commit();
  }

  // 3) Load compras + ventas
  const comprasSnap = await fs.collection(`concesionarios/${concesionarioId}/compras`).get();
  const ventasSnap = await fs.collection(`concesionarios/${concesionarioId}/ventas`).get();

  type Event = { ts: number; kind: 'compra' | 'venta'; id: string; data: any };
  const events: Event[] = [];

  comprasSnap.forEach((d) => {
    const data = d.data() as any;
    const ts = data.created_at?.toMillis?.() ?? 0;
    events.push({ ts, kind: 'compra', id: d.id, data });
  });
  ventasSnap.forEach((d) => {
    const data = d.data() as any;
    const ts = data.fecha?.toMillis?.() ?? data.created_at?.toMillis?.() ?? 0;
    events.push({ ts, kind: 'venta', id: d.id, data });
  });

  events.sort((a, b) => a.ts - b.ts);

  // 4) Replay
  let processedCompras = 0;
  let processedVentas = 0;
  for (const ev of events) {
    const fecha = Timestamp.fromMillis(ev.ts || Date.now());
    if (ev.kind === 'compra') {
      const items: CompraItemLite[] = ev.data.items ?? [];
      for (const item of items) {
        if (!item.producto_id || item.producto_id.startsWith('new-')) continue;
        if (!item.cantidad || item.cantidad <= 0) continue;
        await writeKardexMovement({
          concesionarioId,
          producto_id: item.producto_id,
          fecha,
          tipo: 'entrada',
          origen: 'compra',
          origen_doc_id: ev.id,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario_usd ?? 0,
        });
      }
      processedCompras++;
    } else {
      if (ev.data.tipo_venta && ev.data.tipo_venta !== 'producto') continue;
      const items: VentaItemLite[] = ev.data.items ?? [];
      for (const item of items) {
        if (!item.producto_id) continue;
        if (!item.cantidad || item.cantidad <= 0) continue;
        await writeKardexMovement({
          concesionarioId,
          producto_id: item.producto_id,
          fecha,
          tipo: 'salida',
          origen: 'venta',
          origen_doc_id: ev.id,
          cantidad: item.cantidad,
          costo_unitario: 0,
        });
      }
      processedVentas++;
    }
  }

  return {
    processedCompras,
    processedVentas,
    productosActualizados: prodSnap.size,
    movimientosBorrados: deleted,
  };
});
