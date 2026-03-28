'use client';

import type { Timestamp, GeoPoint } from 'firebase/firestore';

// ==================== ROLES ====================

export type BusinessRole = 'dueno' | 'encargado' | 'secretario' | 'vendedor' | 'cajero';

export const ROLE_LABELS: Record<BusinessRole, string> = {
  dueno: 'Dueño',
  encargado: 'Encargado',
  secretario: 'Secretario',
  vendedor: 'Vendedor',
  cajero: 'Cajero',
};

export type BusinessModule =
  | 'dashboard'
  | 'inventory'
  | 'sales'
  | 'clients'
  | 'staff'
  | 'settings'
  | 'cash_register'
  | 'consignment'
  | 'calendar'
  | 'web_sync'
  | 'commissions';

/**
 * Permission matrix defining which modules each role can access.
 * Values: 'full' = read/write, 'read' = read-only, 'own' = own data only, false = no access
 */
export type PermissionLevel = 'full' | 'read' | 'own' | false;

export const ROLE_PERMISSIONS: Record<BusinessRole, Record<BusinessModule, PermissionLevel>> = {
  dueno: {
    dashboard: 'full',
    inventory: 'full',
    sales: 'full',
    clients: 'full',
    staff: 'full',
    settings: 'full',
    cash_register: 'full',
    consignment: 'full',
    calendar: 'full',
    web_sync: 'full',
    commissions: 'full',
  },
  encargado: {
    dashboard: 'read',
    inventory: 'full',
    sales: 'full',
    clients: 'full',
    staff: 'full',
    settings: 'full',
    cash_register: 'read',
    consignment: 'full',
    calendar: 'full',
    web_sync: 'full',
    commissions: 'read',
  },
  secretario: {
    dashboard: false,
    inventory: 'read',
    sales: false,
    clients: 'full',
    staff: false,
    settings: false,
    cash_register: false,
    consignment: false,
    calendar: 'read',
    web_sync: 'full',
    commissions: false,
  },
  vendedor: {
    dashboard: false,
    inventory: 'read',
    sales: false,
    clients: 'own',
    staff: false,
    settings: false,
    cash_register: false,
    consignment: 'full',
    calendar: 'full',
    web_sync: false,
    commissions: 'own',
  },
  cajero: {
    dashboard: false,
    inventory: false,
    sales: 'full',
    clients: false,
    staff: false,
    settings: false,
    cash_register: 'full',
    consignment: false,
    calendar: false,
    web_sync: false,
    commissions: false,
  },
};

/** Whether a role can see internal purchase costs */
export const CAN_SEE_PURCHASE_COSTS: Record<BusinessRole, boolean> = {
  dueno: true,
  encargado: false,
  secretario: false,
  vendedor: false,
  cajero: false,
};

// ==================== DATA MODELS ====================

export type Concesionario = {
  id: string;
  slug: string; // URL-friendly name, e.g. 'mi-concesionario'
  nombre_empresa: string;
  rif: string;
  direccion: string;
  geolocalizacion?: GeoPoint;
  logo_url?: string;
  banner_url?: string;
  telefono?: string;
  email?: string;
  marketplaceEmail?: string; // Tightly coupled marketplace credential email
  clave_maestra_hash: string; // SHA-256
  owner_uid: string; // Firebase Auth UID of the owner's personal account
  plan_activo: boolean; // Manually controlled by admin
  configuracion: ConcesionarioConfig;
  created_at: Timestamp;
};

export type ConcesionarioConfig = {
  margen_minimo: number; // Minimum profit margin percentage
  estructura_comision: number; // Default commission percentage for sellers
  metodos_pago: string[]; // e.g. ['Zelle', 'Pago Móvil', 'Efectivo', 'Transferencia']
  margen_consignacion_porcentaje: number; // Default markup for consignment vehicles
};

export type StaffMember = {
  id: string;
  nombre: string;
  telefono?: string;
  foto_url?: string;
  rol: BusinessRole;
  pin_hash: string; // SHA-256 of 4-6 digit PIN
  activo: boolean;
  sueldo?: number;
  comision_porcentaje?: number;
  created_at: Timestamp;
};

export type StockStatus = 'privado_taller' | 'publico_web' | 'pausado' | 'reservado' | 'vendido';

export type GastoCategoria = 'mecanica' | 'pintura' | 'lavado' | 'tapiceria' | 'cauchos_frenos' | 'electrico' | 'otros';

export const GASTO_CATEGORIA_LABELS: Record<GastoCategoria, string> = {
  mecanica: 'Mecánica',
  pintura: 'Pintura',
  lavado: 'Lavado',
  tapiceria: 'Tapicería',
  cauchos_frenos: 'Cauchos / Frenos',
  electrico: 'Eléctrico',
  otros: 'Otros',
};

export type GastoAdecuacion = {
  categoria: GastoCategoria;
  descripcion: string;
  monto: number;
};

export type VehicleInfoExtra = {
  cedula_propietario?: string;
  placa?: string;
  serial_niv?: string;
  serial_carroceria?: string;
  serial_chasis?: string;
  serial_carrozado?: string;
  serial_motor?: string;
  clase?: string;
  tipo?: string;
};

export type StockVehicle = {
  id: string;
  // Vehicle info (same fields as public Vehicle)
  make: string;
  model: string;
  year: number;
  vehicleType?: string;
  bodyType: string;
  transmission: 'Automática' | 'Sincrónica';
  engine: string;
  exteriorColor: string;
  mileage: number;
  placa?: string;
  images: { url: string; alt: string; hint?: string }[];
  description: string;

  // Technical details (Marketplace sync)
  hadMajorCrash?: boolean;
  hasAC?: boolean;
  isOperational?: boolean;
  isSignatory?: boolean;
  doorCount?: number;
  is4x4?: boolean;
  hasSoundSystem?: boolean;
  isArmored?: boolean;
  acceptsTradeIn?: boolean;
  ownerCount?: number;
  tireLife?: number;

  // Stock-specific fields
  estado_stock: StockStatus;
  costo_compra: number;
  gastos_adecuacion: GastoAdecuacion[];
  precio_venta: number;
  ganancia_neta_estimada: number; // precio_venta - costo_compra - sum(gastos)

  // Consignment
  es_consignacion: boolean;
  consignacion_info?: {
    vendedor_particular_id: string;
    comision_acordada: number;
  };

  // Assigned seller
  asignado_a?: string; // staffId

  // Extra legal/document info (for delivery notes)
  info_extra?: VehicleInfoExtra;

  // Link to public listing
  publicacion_web_id?: string;

  created_at: Timestamp;
  updated_at?: Timestamp;
};

export type Venta = {
  id: string;
  vehiculo_id: string;
  vehiculo_nombre: string; // e.g. "2020 Toyota Corolla"
  comprador_nombre: string;
  comprador_telefono?: string;
  comprador_cedula?: string;
  vendedor_staff_id: string;
  vendedor_nombre: string;
  precio_venta: number;
  metodo_pago: string;
  comision_vendedor: number;
  ganancia_neta: number;
  fecha: Timestamp;
  recibo_url?: string;
};

export type RegistroCaja = {
  id: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  metodo_pago: string;
  cajero_staff_id: string;
  cajero_nombre: string;
  referencia_pago?: string; // Capture reference for Zelle/Pago Móvil
  fecha: Timestamp;
};

export type CierreCaja = {
  id: string;
  fecha: Timestamp;
  cajero_staff_id: string;
  cajero_nombre: string;
  numero_cierre: number; // For multiple closures per day (1, 2, 3...)
  conteo_manual: Record<string, number>; // metodo_pago -> monto_informado
  sistema_esperado: Record<string, number>; // metodo_pago -> monto_calculado
  diferencias: Record<string, number>; // manual - sistema
  total_manual: number;
  total_sistema: number;
  total_diferencia: number;
  estado: 'pendiente' | 'aprobado';
  aprobado_por_id?: string;
  aprobado_por_nombre?: string;
  aprobado_at?: Timestamp;
};

// ==================== HELPERS ====================

/**
 * Hash a string using SHA-256 (browser-compatible)
 */
export async function hashSHA256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a string against a SHA-256 hash
 */
export async function verifySHA256(input: string, hash: string): Promise<boolean> {
  const inputHash = await hashSHA256(input);
  return inputHash === hash;
}

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens
}
