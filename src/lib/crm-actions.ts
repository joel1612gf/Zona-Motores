import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import type {
  Cliente,
  Interaccion,
  InteraccionTipo,
  MatchOportunidad,
  MatchOportunidadStatus,
} from './business-types';
import { openWhatsApp, templateMatchVenta } from './whatsapp-helper';

export type StaffRef = { id: string; nombre: string };

export async function updateMatchStatus(
  firestore: Firestore,
  concesionarioId: string,
  matchId: string,
  status: MatchOportunidadStatus,
  staff: StaffRef,
): Promise<void> {
  const ref = doc(firestore, 'concesionarios', concesionarioId, 'matches', matchId);
  const patch: Record<string, unknown> = {
    status,
    updated_at: serverTimestamp(),
  };
  if (status === 'contactado') {
    patch.contactado_por_id = staff.id;
    patch.contactado_por_nombre = staff.nombre;
  }
  await updateDoc(ref, patch);
}

export async function addInteraccion(
  firestore: Firestore,
  concesionarioId: string,
  clienteId: string,
  data: Omit<Interaccion, 'id' | 'fecha'> & { fecha?: Timestamp },
): Promise<string> {
  const col = collection(
    firestore,
    'concesionarios',
    concesionarioId,
    'clientes',
    clienteId,
    'interacciones',
  );
  const docRef = await addDoc(col, {
    tipo: data.tipo,
    nota: data.nota,
    creado_por_id: data.creado_por_id,
    creado_por_nombre: data.creado_por_nombre,
    fecha: data.fecha ?? serverTimestamp(),
  });
  return docRef.id;
}

export async function sendMatchWhatsApp(
  firestore: Firestore,
  concesionarioId: string,
  concesionarioNombre: string,
  match: MatchOportunidad,
  telefono: string | undefined,
  staff: StaffRef,
  linkVehiculo?: string,
): Promise<void> {
  const [clienteNombre] = (match.cliente_nombre || '').split(' ');
  const text = templateMatchVenta({
    clienteNombre: clienteNombre || match.cliente_nombre,
    concesionarioNombre,
    vehiculoMake: match.vehiculo_make,
    vehiculoModel: match.vehiculo_model,
    vehiculoYear: match.vehiculo_year,
    precioUsd: match.vehiculo_precio_usd,
    linkVehiculo,
  });
  if (telefono) {
    openWhatsApp(telefono, text);
  }
  await Promise.all([
    updateMatchStatus(firestore, concesionarioId, match.id, 'contactado', staff),
    addInteraccion(firestore, concesionarioId, match.cliente_id, {
      tipo: 'whatsapp',
      nota: `Oferta enviada por WhatsApp: ${match.vehiculo_make} ${match.vehiculo_model}${match.vehiculo_year ? ` ${match.vehiculo_year}` : ''} (USD ${match.vehiculo_precio_usd}).`,
      creado_por_id: staff.id,
      creado_por_nombre: staff.nombre,
    }),
  ]);
}

export type FollowUpInput = {
  when: Date;
  nota: string;
  durationMinutes?: number;
};

export async function scheduleFollowUp(
  firestore: Firestore,
  concesionarioId: string,
  cliente: Cliente,
  staff: StaffRef,
  input: FollowUpInput,
): Promise<{ eventoId: string; interaccionId: string }> {
  const duration = (input.durationMinutes ?? 30) * 60 * 1000;
  const inicio = Timestamp.fromDate(input.when);
  const fin = Timestamp.fromDate(new Date(input.when.getTime() + duration));
  const clienteNombre = `${cliente.nombre} ${cliente.apellido}`.trim();

  const eventosCol = collection(
    firestore,
    'concesionarios',
    concesionarioId,
    'eventos_calendario',
  );
  const eventoDoc = await addDoc(eventosCol, {
    titulo: `Seguimiento: ${clienteNombre}`,
    descripcion: input.nota || undefined,
    categoria: 'recordatorio',
    inicio,
    fin,
    todo_el_dia: false,
    cliente_id: cliente.id,
    cliente_nombre: clienteNombre,
    visibilidad: 'equipo',
    estado: 'pendiente',
    creado_por_id: staff.id,
    creado_por_nombre: staff.nombre,
    creado_en: serverTimestamp(),
  });

  const fechaTexto = input.when.toLocaleString('es-VE', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const interaccionId = await addInteraccion(firestore, concesionarioId, cliente.id, {
    tipo: 'nota',
    nota: `Seguimiento agendado para ${fechaTexto}${input.nota ? `: ${input.nota}` : ''}.`,
    creado_por_id: staff.id,
    creado_por_nombre: staff.nombre,
  });

  return { eventoId: eventoDoc.id, interaccionId };
}
