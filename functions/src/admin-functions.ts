/**
 * Super Admin (God-Mode) Cloud Functions.
 * - deleteTenant: HTTPS callable → securely & recursively deletes a concesionario,
 *   all of its subcollections, and the owner's public SaaS marketplace listings.
 *   Runs with the Admin SDK (bypasses client rules) and is gated to active owners.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';

const db = () => getFirestore();

const LISTINGS_BATCH = 300;

export const deleteTenant = onCall(async (request) => {
  const fs = db();

  // 1) Authentication
  const email = request.auth?.token?.email?.toLowerCase();
  if (!email) throw new HttpsError('unauthenticated', 'No autenticado');

  // 2) Authorization — caller must be an ACTIVE super_admin with role 'owner'.
  //    Reads the super_admins collection (no hardcoded email).
  const adminSnap = await fs.doc(`super_admins/${email}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', 'No autorizado');
  const adm = adminSnap.data() as { role?: string; activo?: boolean };
  if (adm.role !== 'owner' || adm.activo !== true) {
    throw new HttpsError('permission-denied', 'Solo un propietario activo puede eliminar concesionarios');
  }

  // 3) Input + tenant lookup
  const { concesionarioId } = (request.data ?? {}) as { concesionarioId?: string };
  if (!concesionarioId) throw new HttpsError('invalid-argument', 'concesionarioId requerido');

  const concRef = fs.doc(`concesionarios/${concesionarioId}`);
  const concSnap = await concRef.get();
  if (!concSnap.exists) throw new HttpsError('not-found', 'Concesionario no encontrado');
  const ownerUid = (concSnap.data() as { owner_uid?: string }).owner_uid;

  try {
    // 4) Recursively delete the tenant document + ALL its subcollections
    //    (inventario, ventas, clientes, staff, kardex_movements, etc.).
    await fs.recursiveDelete(concRef);

    // 5) Delete the owner's PUBLIC SaaS marketplace listings, leaving any
    //    personal (non-SaaS) listings on the same account untouched.
    let removedListings = 0;
    if (ownerUid) {
      const listingsCol = fs.collection(`users/${ownerUid}/vehicleListings`);
      // Loop in batches until no SaaS listings remain.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batchSnap = await listingsCol.where('seller.isSaaSBusiness', '==', true).limit(LISTINGS_BATCH).get();
        if (batchSnap.empty) break;
        const writer = fs.batch();
        batchSnap.docs.forEach((d) => writer.delete(d.ref));
        await writer.commit();
        removedListings += batchSnap.size;
        if (batchSnap.size < LISTINGS_BATCH) break;
      }
    }

    logger.info('deleteTenant completed', { concesionarioId, ownerUid, removedListings, by: email });
    return { ok: true, concesionarioId, ownerUid: ownerUid ?? null, removedListings };
  } catch (err) {
    logger.error('deleteTenant failed', { concesionarioId, err });
    throw new HttpsError('internal', 'Falló la eliminación del concesionario');
  }
});
