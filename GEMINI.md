 ZONA MOTORES - Documentación de Contexto Core
 Visión General
Zona Motores (ZM) es una plataforma híbrida que integra un Marketplace de vehículos y un sistema SaaS (Zona Business) bajo una arquitectura multi-tenant (/business/[slug]). El sistema está diseñado para digitalizar y automatizar la gestión contable, legal y de inventario de concesionarios en Venezuela.

Stack Tecnológico
Importante: Mantener siempre estas versiones para asegurar compatibilidad.

Frontend: Next.js 15 (App Router) y React 19.

Estilo: Tailwind CSS con enfoque en "Glassmorphism" y componentes Radix UI.

Backend: Firebase (Firestore, Auth, Storage, Hosting).

AI Integration: Google Genkit + Gemini Models (Flash/Pro).

Validación & Docs: Zod para esquemas de datos y html2pdf.js para reportes legales.

Reglas de Negocio & Contexto Legal (Venezuela 2026)
Este sistema debe cumplir estrictamente con las regulaciones venezolanas vigentes:

Finanzas y Tasas
Tasa de Cambio: Todas las operaciones en Bolívares (Bs) deben usar la tasa oficial del Banco Central de Venezuela (BCV).

Impuestos:

I.V.A.: Alícuota general del 16%.

I.G.T.F.: 3% aplicado a pagos realizados en divisas (USD/Efectivo).

Retenciones: Configurable en proveedores (75% o 100% del IVA).

Flujo Maestro de Ventas (Wizard de 5 Pasos)
Selección: Elección entre "Vehículo" o "Producto".

Negociación: Validación de precio final. Si es menor al margen mínimo, requiere PIN de autorización de un superior.

Verificación: Chequeo de documentación del vehículo en Firebase antes de proceder.

Cierre: Cambio automático de estatus a VENDIDO, salida de Marketplace y registro de ingreso en Caja.

Documentación: Generación obligatoria de Factura Fiscal (o Nota de Entrega), Contrato de Compra-Venta y Acta de Deslinde.

Estructura de Datos (Firestore)
vehicles: Posee estados STOCK_PRIVADO, PUBLICO_WEB y VENDIDO.

sales: Registra responsable (vendedor), comprador, método de pago, impuestos y documentos generados.

business_settings: Contiene los contadores secuenciales de Factura y Control (progresivos por concesionario).

Estándares de Desarrollo
Idioma: Código, funciones y comentarios en Ingles. Interfaz de Usuario (UI) y Documentos Legales en Español.

Seguridad: Los permisos se validan por roles: Dueño, Encargado, Secretario, Cajero, Vendedor.

Identidad Visual: Colores principales de Zona Motores (Azul (#2463eb) /Blanco/Gris), fuentes legibles y diseño profesional "Premium".

Resumen Técnico Adicional (Claude Analysis)

Resumen Técnico: Zona Motores (ZM)
Zona Motores es una plataforma híbrida de nueva generación que combina un Marketplace de Vehículos de alto rendimiento con un robusto sistema SaaS (Zona Business) diseñado específicamente para la gestión integral de concesionarios y vendedores profesionales.

1. Arquitectura y Stack Tecnológico
La aplicación está construida sobre los estándares más modernos de la web, priorizando la velocidad, la escalabilidad y una experiencia de usuario "premium".

Core: Next.js 15 con la infraestructura de App Router y React 19. Esto permite una carga híbrida (Server y Client Components) extremadamente eficiente.
Backend & Persistencia: El ecosistema completo de Firebase:
Firestore: Base de datos NoSQL en tiempo real.
Auth: Gestión de identidades (propietarios, staff y usuarios finales).
Storage: Almacenamiento optimizado para imágenes de vehículos de alta resolución.
App Hosting: Despliegue gestionado para máxima disponibilidad.
IA de Vanguardia: Integración de Google Genkit y los modelos Gemini (Flash/Pro) para automatizar la extracción de especificaciones técnicas y la generación de resúmenes atractivos para los anuncios.
Diseño y UI: Una estética moderna basada en Tailwind CSS, Radix UI (para componentes accesibles) y Lucide Icons. El diseño sigue una filosofía de "Glassmorphism" y micro-animaciones para transmitir profesionalismo.
2. Los Dos Pilares de la Plataforma
A. Marketplace ZM (La Web Normal)
Es la cara pública del proyecto. Su objetivo es conectar compradores con vendedores de forma sencilla y visualmente impactante.

Descubrimiento de Vehículos: Filtros avanzados por marca, modelo, año, categoría y ubicación.
Listados Inteligentes: Los anuncios no son solo texto; incluyen datos enriquecidos por IA, galerías de fotos optimizadas y contadores de visitas en tiempo real.
Perfiles de Concesionarios: Cada negocio registrado en la Zona Business tiene su propia "Landing Page" pública dentro del marketplace, mostrando su inventario actual, reputación y datos de contacto.
B. Zona Business (El SaaS de Gestión)
Ubicado bajo la ruta dinámica /business/[slug], es un ERP/CRM completo para la administración automotriz. Funciona bajo un modelo Multi-tenant, donde cada concesionario tiene su propio entorno aislado.

Módulo de Inventario: Gestión total de stock. Incluye un sistema de "Gastos de Adecuación" para calcular la inversión real en cada unidad antes de su venta.
Asistente AI: Al subir un vehículo, la IA puede auto-completar datos técnicos (motor, transmisión, extras) analizando la descripción o imágenes, ahorrando tiempo crítico al vendedor.
Gestión de Ventas (Wizard de 5 Pasos): Un flujo guiado para registrar ventas que maneja automáticamente:
Cálculo de impuestos (IVA, IGTF para pagos en divisas).
Generación de documentos legales en PDF (Factura, Nota de Entrega, Acta de Venta).
Cálculo de comisiones para el staff involucrado.
Módulo de Compras: Control de entrada de mercadería (repuestos o vehículos) con gestión de proveedores, tasas de cambio (Dólar/Bolívar) y retenciones de ley.
Caja y Flujo de Efectivo: Registro de ingresos y egresos, con cierres de caja diarios para garantizar la transparencia financiera.
3. Lógica de Datos y Sincronización
El sistema destaca por su integridad referencial inteligente en un entorno NoSQL:

Sincronización Web: Cuando un vehículo entra al stock del SaaS, el dueño puede decidir con un clic si se publica en el Marketplace. El sistema maneja dos estados: el "Stock Privado" (interno) y la "Publicación Web" (pública).
Cadenas de Eventos:
Una Venta cambia automáticamente el estatus del vehículo a vendido, lo retira del marketplace y genera un movimiento de ingreso en la Caja.
Una Compra de productos para el taller (Repuestos) incrementa el inventario y genera un egreso en la caja del negocio.
Multi-moneda: Soporte nativo para transacciones en USD y Bolívares (VES) con tasas de cambio dinámicas o manuales configurables por el administrador del negocio.
4. Seguridad y Roles
El sistema utiliza Firestore Security Rules para implementar un modelo de permisos granular:

Dueño: Acceso total a finanzas, configuración y personal.
Encargado/Gerente: Gestión de inventario y ventas, pero acceso limitado a configuración sensible.
Vendedor: Solo puede gestionar sus propios clientes y ver stock disponible.
Cajero: Enfocado exclusivamente en el registro de flujos de dinero y cierres de caja.
5. Detalles Técnicos de Implementación
Generación de Documentos: Uso de html2pdf.js y componentes de React diseñados exclusivamente para impresión (A4), garantizando que las facturas y contratos tengan un aspecto profesional.
Validación de Datos: Esquemas estrictos mediante Zod tanto en el cliente como en el servidor para evitar datos inconsistentes.
Hooks Personalizados: Se han desarrollado hooks como useCollection y useDoc que envuelven la lógica de Firebase para proporcionar actualizaciones en tiempo real (real-time updates) sin consumir recursos excesivos.
SEO Automático: Implementación de metadatos dinámicos para que cada anuncio de vehículo y cada concesionario sea fácilmente indexable por Google.
TIP

Enfoque de Negocio: Este código no es solo una base de datos de carros; es una herramienta de productividad. La lógica está diseñada para que el concesionario pueda llevar toda su contabilidad y gestión de personal desde la misma pestaña donde publica sus anuncios.

Notas Importantes para la IA
No inventar leyes: Si no se conoce una regla fiscal, preguntar a Joel Eduardo.

Optimización: Usar hooks personalizados (useCollection, useDoc) para actualizaciones en tiempo real.

Consistencia: Mantener la integridad referencial entre la venta y el inventario del Marketplace.