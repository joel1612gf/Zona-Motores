'use client';

import type { Timestamp, GeoPoint } from 'firebase/firestore';

// ==================== ROLES ====================

export type BusinessRole = 'dueno' | 'encargado' | 'secretario' | 'vendedor' | 'cajero' | 'contador';

export const ROLE_LABELS: Record<BusinessRole, string> = {
  dueno: 'Dueño',
  encargado: 'Encargado',
  secretario: 'Secretario',
  vendedor: 'Vendedor',
  cajero: 'Cajero',
  contador: 'Contador',
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
  | 'products'
  | 'reports'
  | 'finance'
  | 'banks'
  | 'payables'
  | 'receivables'
  | 'accounting';

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
    reports: 'full',
    finance: 'full',
    banks: 'full',
    payables: 'full',
    receivables: 'full',
    accounting: 'full',
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
    reports: 'read',
    finance: 'full',
    banks: 'full',
    payables: 'full',
    receivables: 'full',
    accounting: 'full',
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
    calendar: 'full',
    web_sync: 'full',
    commissions: false,
    products: 'read',
    reports: false,
    finance: false,
    banks: 'full',
    payables: false,
    receivables: 'read',
    accounting: 'read',
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
    reports: false,
    finance: false,
    banks: false,
    payables: false,
    receivables: 'read',
    accounting: false,
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
    calendar: 'read',
    web_sync: false,
    commissions: false,
    products: 'read',
    reports: 'read',
    finance: 'read',
    banks: false,
    payables: 'read',
    receivables: 'full',
    accounting: 'read',
  },
  contador: {
    dashboard: 'read',
    inventory: 'read',
    sales: false,
    clients: 'read',
    staff: false,
    settings: false,
    cash_register: false,
    consignment: false,
    calendar: false,
    web_sync: false,
    commissions: false,
    products: 'read',
    reports: 'full',
    finance: 'read',
    banks: 'read',
    payables: 'full',
    receivables: 'full',
    accounting: 'full',
  },
};

/** Whether a role can see internal purchase costs */
export const CAN_SEE_PURCHASE_COSTS: Record<BusinessRole, boolean> = {
  dueno: true,
  encargado: false,
  secretario: false,
  vendedor: false,
  cajero: false,
  contador: true,
};

// ==================== DATA MODELS ====================

export type Concesionario = {
  id: string;
  slug: string; // URL-friendly name, e.g. 'mi-concesionario'
  nombre_empresa?: string; // Optional: empty when created blank from /admin, filled during onboarding
  rif?: string; // Optional: filled during onboarding (fiscal step)
  direccion?: string; // Optional: filled during onboarding (fiscal step)
  geolocalizacion?: GeoPoint;
  logo_url?: string;
  banner_url?: string;
  telefono?: string;
  email?: string;
  marketplaceEmail?: string; // Tightly coupled marketplace credential email
  clave_maestra_hash?: string | null; // SHA-256. Null when created blank from /admin or after a master-key reset
  owner_uid: string; // Firebase Auth UID of the owner's personal account ('' for admin-created tenants)
  plan_activo: boolean; // Manually controlled by admin
  precio_mensual_usd?: number; // Custom B2B monthly fee for this tenant (drives the global MRR). Set from /admin/dealerships.
  dia_cobro_mensual?: number; // Day of month (1-31) the SaaS fee is billed. Set from /admin/dealerships.
  onboarding_completado?: boolean; // false when created blank; true once the client finishes the onboarding wizard. Legacy tenants leave this undefined.
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
  sujeto_pasivo_especial?: boolean; // SENIAT — if true, the company collects IGTF on USD payments to providers
  igtf_trigger_entry_methods?: BankEntryMethod[]; // Bank entry methods that trigger IGTF when account is es_divisa (default: efectivo_fisico, zelle, crypto, transferencia)
  ultimo_periodo_cerrado?: string; // YYYYMM. Locks creation/edition/anulation of fiscal docs (compras/ventas/notas) with date <= this period. Only the owner can close/reopen.
};

// Safe default config seeded when an admin creates a blank tenant. The app reads
// concesionario.configuracion.* everywhere, so a tenant must never have it empty.
// The owner refines these later in Settings; the onboarding wizard only toggles tasa_cambio_auto.
export const DEFAULT_CONCESIONARIO_CONFIG: ConcesionarioConfig = {
  margen_minimo: 0,
  estructura_comision: 0,
  metodos_pago: ['Efectivo', 'Pago Móvil', 'Transferencia', 'Zelle'],
  metodos_pago_divisa: ['Zelle', 'Efectivo USD'],
  margen_consignacion_porcentaje: 0,
  tasa_cambio_auto: false,
  tasa_cambio_manual: 0,
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
  saldo_pendiente?: number;
  estado_pago?: 'pendiente' | 'pagada';
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

export type CreditFrequency = 'semanal' | 'quincenal' | 'mensual';

export const CREDIT_FREQUENCY_LABELS: Record<CreditFrequency, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
};

export type CreditTerms = {
  cuotas_total: number;
  frecuencia: CreditFrequency;
  tasa_interes_anual: number; // % anual; 0 = sin interés
  inicial_usd: number;
  monto_cuota_usd: number; // Equal installment amount (simple interest distribution)
  fecha_primera_cuota: Timestamp;
};

export type SaleModalidadPago = 'contado' | 'credito';
export type SaleStatusPago = 'pagado' | 'parcial' | 'pendiente';

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
  // Credit / receivables (CXC)
  modalidad_pago?: SaleModalidadPago; // default 'contado' if omitted (backwards compatible)
  status_pago?: SaleStatusPago;       // default 'pagado' if omitted
  paid_usd?: number;                   // amount already received in USD
  saldo_pendiente_usd?: number;        // outstanding balance in USD
  credit_terms?: CreditTerms;
  cuenta_cobrar_id?: string;           // FK to cuentas_por_cobrar
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

export type RiesgoCredito = 'bajo' | 'medio' | 'alto';

export type InteraccionTipo = 'llamada' | 'whatsapp' | 'visita' | 'nota' | 'email';

export type Interaccion = {
  id: string;
  tipo: InteraccionTipo;
  nota: string;
  fecha: Timestamp;
  creado_por_id: string;
  creado_por_nombre: string;
};

export type MatchOportunidadStatus = 'pendiente' | 'contactado' | 'descartado' | 'convertido';

export type MatchOportunidad = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  vehiculo_id: string;
  vehiculo_make: string;
  vehiculo_model: string;
  vehiculo_year?: number;
  vehiculo_precio_usd: number;
  requerido_id: string;
  budget?: number;
  within_tolerance: boolean;
  status: MatchOportunidadStatus;
  created_at: Timestamp;
  updated_at?: Timestamp;
  contactado_por_id?: string;
  contactado_por_nombre?: string;
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
  // Receivables / credit health
  deuda_actual_usd?: number;            // Current outstanding USD across all CXC
  ventas_credito_ids?: string[];         // FKs to credit-mode sales still open
  riesgo_credito?: RiesgoCredito;
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
  is_fiscal?: boolean;
  estado: 'pendiente' | 'pagada';
  saldo_pendiente?: number; // Added to support partial payments and fiscal notes
  creado_por: string;
  created_at: Timestamp;
  // Retention fields (only present when proveedor is a retention agent and iva > 0)
  numero_comprobante?: string; // e.g. "20260400000001"
  porcentaje_retencion_aplicado?: number; // 75 or 100
  monto_retenido?: number; // iva_monto * porcentaje / 100
  neto_a_pagar?: number; // total_usd - monto_retenido - islr_retenido
  // ISLR retention (income tax withholding, Venezuela)
  islr_concept?: 'SERV' | 'HPN' | 'HPJ' | 'FLET' | 'PUBL';
  islr_percentage?: number; // 0.02 .. 0.05
  islr_base?: number; // base imponible ISLR in USD
  islr_retenido?: number; // base * percentage
};

// ==================== KARDEX (Inventory accounting ledger) ====================

export type KardexMovement = {
  id: string;
  producto_id: string;
  fecha: Timestamp;
  tipo: 'entrada' | 'salida';
  origen: 'compra' | 'venta' | 'ajuste';
  origen_doc_id: string; // id of source Compra/Venta document
  cantidad: number;
  costo_unitario: number; // USD
  valor_total: number; // cantidad * costo_unitario
  // Post-movement balance (denormalized for audit trail)
  saldo_cantidad: number;
  saldo_costo_promedio: number;
  saldo_valor_total: number;
  created_at: Timestamp;
};

// ==================== BANKS MODULE ====================

export type BankAccountType = 'banco' | 'efectivo' | 'otro';

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  banco: 'Banco',
  efectivo: 'Efectivo',
  otro: 'Otro',
};

export const BANK_ACCOUNT_TYPE_ICONS: Record<BankAccountType, string> = {
  banco: '🏦',
  efectivo: '💵',
  otro: '💳',
};

/** Currency defaults — users can toggle in form */
export const BANK_ACCOUNT_CURRENCY: Record<BankAccountType, 'USD' | 'VES'> = {
  banco: 'VES',
  efectivo: 'USD',
  otro: 'USD',
};

export type BankEntryMethod = 'pago_movil' | 'transferencia' | 'punto_de_venta' | 'efectivo_fisico' | 'zelle' | 'crypto';
export type BankExitMethod = 'pago_movil' | 'transferencia' | 'efectivo_fisico' | 'zelle' | 'crypto';

export const BANK_ENTRY_METHOD_LABELS: Record<BankEntryMethod, string> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia',
  punto_de_venta: 'Punto de Venta',
  efectivo_fisico: 'Efectivo',
  zelle: 'Zelle',
  crypto: 'Criptomoneda',
};

export const BANK_EXIT_METHOD_LABELS: Record<BankExitMethod, string> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia',
  efectivo_fisico: 'Efectivo',
  zelle: 'Zelle',
  crypto: 'Criptomoneda',
};

export type BankAccount = {
  id: string;
  tipo: BankAccountType;
  nombre: string;                  // Display name e.g. "BANCAMIGA", "EFECTIVO Bs"
  banco?: string;                  // Bank name (for banco_nacional)
  numero_cuenta?: string;          // Full account number
  titular?: string;                // Account holder name
  cedula_rif_titular?: string;     // Holder ID
  telefono_pago_movil?: string;    // Phone number for Pago Móvil
  moneda: 'USD' | 'VES';          // Derived from tipo, but stored explicitly
  saldo_inicial: number;           // Opening balance set at creation
  saldo_actual: number;            // Current balance (updated on each transaction)
  // Enabled entry/exit methods
  metodos_entrada: Partial<Record<BankEntryMethod, boolean>>;
  metodos_salida: Partial<Record<BankExitMethod, boolean>>;
  // IGTF flag: if true, payments received via this account trigger 3% IGTF on fiscal invoices
  es_divisa: boolean;
  activa: boolean;                 // Soft-delete
  orden: number;                   // Display order in the grid
  color?: string;                  // Optional accent color for card (hex)
  notas?: string;                  // Internal notes
  created_at: Timestamp;
  updated_at?: Timestamp;
};

export type BankTransactionType = 'ingreso_venta' | 'egreso_compra' | 'ajuste_manual' | 'ingreso_manual' | 'egreso_manual' | 'egreso_cxp' | 'egreso_igtf' | 'ingreso_cxc';

export const BANK_TRANSACTION_TYPE_LABELS: Record<BankTransactionType, string> = {
  ingreso_venta: 'Ingreso por Venta',
  egreso_compra: 'Egreso por Compra',
  ajuste_manual: 'Ajuste de Saldo',
  ingreso_manual: 'Ingreso Manual',
  egreso_manual: 'Egreso Manual',
  egreso_cxp: 'Pago Cuenta por Pagar',
  egreso_igtf: 'IGTF (3% Divisas)',
  ingreso_cxc: 'Cobro Cuenta por Cobrar',
};

export type BankTransaction = {
  id: string;
  cuenta_id: string;               // Parent bank account ID
  tipo: BankTransactionType;
  flujo: 'entrada' | 'salida';     // Direction
  monto: number;                   // Amount in account's currency
  metodo_pago?: BankEntryMethod | BankExitMethod; // The payment method used
  concepto: string;                // Description
  referencia?: string;             // Reference number
  // Links to other documents
  venta_id?: string;
  compra_id?: string;
  cuenta_cobrar_id?: string;       // FK to cuentas_por_cobrar (CXC payments)
  cuota_id?: string;                // FK to cuotas subcollection
  // IGTF withholding when collecting in divisa from a special-taxpayer fiscal invoice
  igtf_retenido?: number;           // USD amount withheld for SENIAT reporting
  // BCV rates snapshot for audit
  tasa_bcv_cobro?: number;          // Live BCV used at collection time (CXC only)
  tasa_bcv_venta?: number;          // Historical BCV recorded at sale time (CXC audit)
  // Audit
  registrado_por_id: string;
  registrado_por_nombre: string;
  saldo_anterior: number;          // Balance before transaction
  saldo_posterior: number;         // Balance after transaction
  fecha: Timestamp;
};

// ==================== ACCOUNTS PAYABLE (CXP) ====================

/**
 * Auto-generated when a consigned vehicle is sold.
 * Lives in: concesionarios/{id}/consignaciones_por_pagar
 * is_fiscal is always false — consignor payouts are exempt from IGTF and IVA retentions.
 */
export type ConsignacionPorPagar = {
  id: string;
  vehiculo_id: string;
  vehiculo_nombre: string;                   // e.g. "2024 Toyota Hilux"
  // Consignor info
  propietario_nombre: string;
  propietario_telefono?: string;
  // Amounts (all in USD)
  precio_venta_final: number;                // Final sale price achieved
  comision_acordada_porcentaje: number;      // Commission % agreed at consignment entry
  comision_monto: number;                    // precio_venta * comision / 100
  monto_a_pagar: number;                     // precio_venta - comision_monto
  monto_pagado: number;
  saldo_pendiente: number;
  // Status
  estado: 'pendiente' | 'parcial' | 'pagada';
  // Fiscal flag — ALWAYS false: consignor payouts are exempt from IGTF and IVA
  is_fiscal: false;
  // References
  venta_id: string;
  // Audit
  created_at: Timestamp;
  updated_at?: Timestamp;
};

// ==================== ACCOUNTS RECEIVABLE (CXC) ====================

export type ReceivableOrigen = 'venta_credito_vehiculo' | 'venta_credito_producto' | 'nota_debito_cliente';

export const RECEIVABLE_ORIGEN_LABELS: Record<ReceivableOrigen, string> = {
  venta_credito_vehiculo: 'Financiamiento Vehículo',
  venta_credito_producto: 'Crédito Comercial',
  nota_debito_cliente: 'Nota de Débito',
};

export type CuentaPorCobrarStatus = 'pendiente' | 'parcial' | 'pagado';
export type CuotaEstado = 'pendiente' | 'parcial' | 'pagada' | 'vencida';

export const CUOTA_ESTADO_LABELS: Record<CuotaEstado, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagada: 'Pagada',
  vencida: 'Vencida',
};

/**
 * Lives in: concesionarios/{id}/cuentas_por_cobrar/{id}
 * Generated automatically when a sale is closed with modalidad_pago === 'credito'.
 */
export type CuentaPorCobrar = {
  id: string;
  venta_id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  cliente_cedula?: string;
  origen: ReceivableOrigen;
  // Descripción del bien o concepto
  descripcion: string;
  vehiculo_id?: string;
  vehiculo_info?: VehicleInfoSnapshot;
  // Amounts (USD canonical)
  monto_original_usd: number;       // Total saldo financiado (sin inicial)
  paid_usd: number;
  saldo_pendiente_usd: number;
  // Plan
  cuotas_total: number;
  cuotas_pagadas: number;
  frecuencia: CreditFrequency;
  tasa_interes_anual: number;
  fecha_emision: Timestamp;
  fecha_primera_cuota: Timestamp;
  fecha_ultima_cuota: Timestamp;
  // Fiscal
  is_fiscal: boolean;
  // Status
  status: CuentaPorCobrarStatus;
  // BCV snapshot al momento de la venta (para auditoría; NO usar para conversiones)
  tasa_cambio_venta: number;
  // Audit
  created_at: Timestamp;
  updated_at?: Timestamp;
};

/**
 * Lives in: concesionarios/{id}/cuentas_por_cobrar/{id}/cuotas/{id}
 * One document per scheduled payment.
 * Denormalized parent keys (`concesionario_id`, `cuenta_cobrar_id`) enable
 * collectionGroup queries from the CXC dashboard.
 */
export type Cuota = {
  id: string;
  concesionario_id: string;         // Denormalized for collectionGroup filtering
  cuenta_cobrar_id: string;         // FK to parent CuentaPorCobrar
  numero: number;                   // 1-indexed
  monto_usd: number;                 // Total a pagar en esta cuota (capital + interes)
  capital: number;                   // USD del principal en esta cuota
  interes: number;                   // USD de interés
  saldo_usd: number;                 // Outstanding portion of monto_usd
  paid_usd: number;                  // Amount already collected for this installment
  fecha_vencimiento: Timestamp;
  estado: CuotaEstado;
  calendar_event_id?: string;        // FK to eventos_calendario
  pagada_at?: Timestamp;
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
