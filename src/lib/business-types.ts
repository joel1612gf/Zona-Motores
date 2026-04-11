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
  | 'commissions'
  | 'products';

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
    products: 'full',
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
    products: 'full',
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
    products: 'read',
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
    products: 'read',
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
    products: 'read',
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
  metodos_pago_divisa?: string[]; // Subset of metodos_pago that are USD/foreign currency (triggers IGTF)
  margen_consignacion_porcentaje: number; // Default markup for consignment vehicles
  tasa_cambio_manual?: number; // Manual Bs/$ exchange rate
  tasa_cambio_auto?: boolean; // If true, auto-fetch from BCV
  ultimo_numero_factura_ventas?: number; // Auto-incrementing invoice counter for sales
  vehiculos_exentos_iva?: boolean; // If true, vehicles are IVA-exempt (no 16% IVA applied to sales invoices)
};

export type StaffMember = {
  id: string;
  nombre: string;
  telefono?: string;
  foto_url?: string;
  rol: BusinessRole;
  pin_hash: string; // SHA-256 of 4-6 digit PIN
  activo: boolean;
  // Payroll & Commissions (New fields for 2026)
  base_salary_usd?: number;
  commission_type?: 'total_price' | 'net_profit';
  commission_percentage?: number;
  monthly_goal?: number;
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
  fecha_venta?: Timestamp; // Set when estado_stock becomes 'vendido' — used to auto-delete images after 30 days
};

export type VehicleInfoSnapshot = {
  make: string;
  model: string;
  year: number;
  placa?: string;
  exteriorColor?: string;
  serial_carroceria?: string;
  serial_motor?: string;
  clase?: string;
  tipo?: string;
  mileage?: number;
};

export type Venta = {
  id: string;
  vehiculo_id?: string;
  vehiculo_nombre: string; // e.g. "2020 Toyota Corolla"
  comprador_id?: string; // Reference to the Cliente document
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
  // New fields for the 5-step wizard
  tipo_venta?: 'vehiculo' | 'producto';
  tipo_documento_emitido?: 'factura_fiscal' | 'nota_entrega';
  numero_factura_venta?: string;   // e.g. "0000001" (progressive)
  numero_control_venta?: string;   // e.g. "00-0000001" (progressive)
  vehiculo_info?: VehicleInfoSnapshot; // Snapshot of vehicle data at sale time
};

export type VehiculoRequerido = {
  id: string;
  make: string;
  model: string;
  year_min?: number;
  year_max?: number;
  budget?: number;
  status: 'pendiente' | 'completado' | 'cancelado';
  created_at: Timestamp;
};

export type Cliente = {
  id: string;
  nombre: string;
  apellido: string;
  cedula_rif: string;
  telefono?: string;
  email?: string;
  compras_ids: string[]; // List of sale IDs associated with this client
  documentos_urls?: string[]; // URLs to PDFs of invoices/contracts
  total_invertido: number; // Sum of all purchases
  ultima_compra_fecha?: Timestamp;
  traspaso_pendiente: boolean; // If true, the client hasn't delivered the new title yet
  traspaso_fecha_limite?: Timestamp; // 30 days after last vehicle purchase
  tags: string[]; // e.g. ["Comprador de Carros", "Cliente de Taller", "Inversionista"]
  vehiculos_requeridos?: VehiculoRequerido[];
  created_at: Timestamp;
  updated_at?: Timestamp;
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

// ==================== PRODUCTS MODULE ====================

export type ProductCategory =
  | 'aceites_lubricantes'
  | 'repuestos_mecanicos'
  | 'electrico_electronico'
  | 'accesorios'
  | 'herramientas'
  | 'limpieza_detailing'
  | 'otros';

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  aceites_lubricantes: 'Aceites y Lubricantes',
  repuestos_mecanicos: 'Repuestos Mecánicos',
  electrico_electronico: 'Eléctrico / Electrónico',
  accesorios: 'Accesorios',
  herramientas: 'Herramientas',
  limpieza_detailing: 'Limpieza y Detailing',
  otros: 'Otros',
};

export type Producto = {
  id: string;
  codigo: string; // barcode or internal code
  nombre: string;
  descripcion?: string;
  categoria: ProductCategory;
  precio_venta_usd: number;
  costo_usd: number; // last purchase cost
  stock_actual: number;
  stock_minimo: number;
  aplica_iva: boolean;
  proveedor_id?: string;
  created_at: Timestamp;
  updated_at?: Timestamp;
};

export type Proveedor = {
  id: string;
  nombre: string;
  rif: string;
  isRetentionAgent: boolean; // True if subject to IVA retention
  porcentaje_retencion_iva: number; // 0, 75, or 100
  direccion?: string;
  contacto_nombre?: string;
  contacto_telefono?: string;
  created_at: Timestamp;
};

export type CompraItem = {
  producto_id: string;
  codigo?: string;
  nombre: string;
  cantidad: number;
  costo_unitario_usd: number;
  subtotal_usd: number;
  aplica_iva: boolean;
};

export type Compra = {
  id: string;
  proveedor_id: string;
  proveedor_nombre: string;
  proveedor_rif?: string;
  proveedor_direccion?: string;
  numero_factura?: string;
  numero_control?: string;
  fecha_factura?: string; // ISO date string e.g. "2026-03-15"
  items: CompraItem[];
  tipo_pago: 'contado' | 'credito';
  dias_credito?: number;
  fecha_vencimiento?: Timestamp;
  subtotal_usd: number;
  iva_monto: number;
  total_usd: number;
  total_bs: number;
  tasa_cambio: number;
  moneda_original?: 'usd' | 'bs';
  estado: 'pendiente' | 'pagada';
  creado_por: string;
  created_at: Timestamp;
  // Retention fields (only present when proveedor is a retention agent and iva > 0)
  numero_comprobante?: string; // e.g. "20260400000001"
  porcentaje_retencion_aplicado?: number; // 75 or 100
  monto_retenido?: number; // iva_monto * porcentaje / 100
  neto_a_pagar?: number; // total_usd - monto_retenido
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
