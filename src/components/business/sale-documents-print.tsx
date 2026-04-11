'use client';

import { type Concesionario } from '@/lib/business-types';

interface SaleDocsPrintProps {
  printDoc: 'factura' | 'contrato' | 'acta' | null;
  concesionario: Concesionario | null;
  rootId?: string;  // defaults to 'sale-print-root'
  ventaData: {
    compradorNombre: string;
    compradorCedula: string;
    compradorTelefono: string;
    metodoPago: string;
    precioVenta: number;
    numFactura: string;
    numControl: string;
    tipoDocumento: 'factura_fiscal' | 'nota_entrega';
    vendedorNombre: string;
    fecha: Date;
    esDivisa: boolean;
    vehiculo: {
      make: string; model: string; year: number;
      placa: string; exteriorColor: string;
      serial_carroceria: string; serial_motor: string;
      clase: string; tipo: string; mileage: number;
    };
    precioEnLetras: string;
  } | null;
}

const FMT_DATE = (d: Date) => d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const FMT_TIME24 = (d: Date) => d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false });
const FMT_DATE8 = (d: Date) => {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
  return `${y}/${m}/${day}`;
};
const FMT_MONEY = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SaleDocumentsPrint({ printDoc, concesionario, ventaData, rootId = 'sale-print-root' }: SaleDocsPrintProps) {
  if (!ventaData || !concesionario) return null;

  const { compradorNombre, compradorCedula, precioVenta, numFactura, numControl, fecha,
    esDivisa, vehiculo, precioEnLetras, vendedorNombre } = ventaData;

  // IVA exento config (default: true — vehicles are exempt)
  const vehiculosExentosIva = concesionario.configuracion?.vehiculos_exentos_iva !== false;
  const montoGravable = vehiculosExentosIva ? 0 : precioVenta;
  const montoExento = vehiculosExentosIva ? precioVenta : 0;
  const iva = vehiculosExentosIva ? 0 : precioVenta * 0.16;
  const igtf = esDivisa ? (precioVenta + iva) * 0.03 : 0;
  const total = precioVenta + iva + igtf;

  const logoEl = concesionario.logo_url
    ? <img src={concesionario.logo_url} alt="Logo" style={{ width: 65, height: 65, objectFit: 'contain' }} />
    : <div style={{ width: 65, height: 65, background: '#1d4ed8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 22, borderRadius: 6 }}>ZM</div>;

  const cellStyle: React.CSSProperties = { padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: 12 };
  const thStyle: React.CSSProperties = { ...cellStyle, background: '#f3f4f6', fontWeight: 600 };

  // Signature block — placed at a fixed position instead of marginTop: 'auto' to avoid breaking to new page in print preview
  const signatureBlock = (leftLabel: string, rightLabel: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 30 }}>
      <div style={{ textAlign: 'center', width: '45%' }}>
        <div style={{ borderTop: '1px solid #374151', paddingTop: 6, fontSize: 11 }}>{leftLabel}</div>
      </div>
      <div style={{ textAlign: 'center', width: '45%' }}>
        <div style={{ borderTop: '1px solid #374151', paddingTop: 6, fontSize: 11 }}>{rightLabel}</div>
      </div>
    </div>
  );

  return (
    <div id={rootId} style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '210mm', background: 'white', color: 'black', zIndex: 9999 }}>
      <style type="text/css">{`
        @media print {
          body * { visibility: hidden !important; }
          #${rootId}, #${rootId} * { visibility: visible !important; }
          #${rootId} { position: absolute !important; left: 0 !important; top: 0 !important; display: block !important; width: 210mm !important; }
          .sale-doc-page { page-break-inside: avoid !important; overflow: hidden !important; }
        }
        @page { size: A4; margin: 0mm; }
        .sale-page-break { page-break-after: always; break-after: page; }
      `}</style>

      <div className="print-root" style={{ width: '210mm', background: 'white', color: 'black' }}>

        {/* ── DOC 1: FACTURA FISCAL ── */}
        {(printDoc === 'factura' || printDoc === null) && ventaData.tipoDocumento === 'factura_fiscal' && (
          <div id="sale-doc-factura" className={`sale-doc-page${printDoc === null ? ' sale-page-break' : ''}`} style={{ padding: '10mm 15mm', height: '297mm', boxSizing: 'border-box', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              {logoEl}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 'bold', color: '#1d4ed8', textTransform: 'uppercase' }}>{concesionario.nombre_empresa}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>RIF: {concesionario.rif}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{concesionario.direccion}</div>
              </div>
            </div>
            {/* Title */}
            <div style={{ textAlign: 'center', borderTop: '2px solid #1d4ed8', borderBottom: '2px solid #1d4ed8', padding: '6px 0', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold' }}>FACTURA DE VENTA N°: {numFactura}</div>
              <div style={{ fontSize: 11, color: '#4b5563' }}>N° CONTROL: {numControl}</div>
            </div>
            {/* Date + Client */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, fontSize: 12 }}>
              <div><strong>FECHA:</strong> {FMT_DATE(fecha)}</div>
              <div style={{ textAlign: 'right' }}><strong>Vendedor:</strong> {vendedorNombre}</div>
              <div><strong>Cliente:</strong> {compradorNombre}</div>
              <div style={{ textAlign: 'right' }}><strong>Cédula/RIF:</strong> {compradorCedula || '—'}</div>
            </div>
            {/* Vehicle table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
              <thead>
                <tr>
                  <th style={thStyle}>DESCRIPCIÓN DEL VEHÍCULO</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>PRECIO UNIT.</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={cellStyle}>
                    <div style={{ fontWeight: 600 }}>Vehículo Usado - {vehiculo.make} {vehiculo.model}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      Año: {vehiculo.year} &nbsp;|&nbsp; Color: {vehiculo.exteriorColor} &nbsp;|&nbsp; Placa: {vehiculo.placa || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Serial Carrocería: {vehiculo.serial_carroceria || '—'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Serial Motor: {vehiculo.serial_motor || '—'}</div>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>$ {FMT_MONEY(precioVenta)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>$ {FMT_MONEY(precioVenta)}</td>
                </tr>
              </tbody>
            </table>
            {/* Totals — IVA exento aware */}
            <div style={{ marginLeft: 'auto', width: 280, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>MONTO GRAVABLE:</span><span>$ {FMT_MONEY(montoGravable)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>MONTO EXENTO:</span><span>$ {FMT_MONEY(montoExento)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                {vehiculosExentosIva
                  ? <><span>I.V.A. (EXENTO):</span><span>$ 0,00</span></>
                  : <><span>I.V.A. (16%):</span><span>$ {FMT_MONEY(iva)}</span></>
                }
              </div>
              {esDivisa && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>IGTF (3%):</span><span>$ {FMT_MONEY(igtf)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1d4ed8', paddingTop: 6, fontWeight: 'bold', fontSize: 14 }}>
                <span>TOTAL A PAGAR:</span><span style={{ color: '#1d4ed8' }}>$ {FMT_MONEY(total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── DOC 2: CONTRATO COMPRA-VENTA ── */}
        {(printDoc === 'contrato' || printDoc === null) && (
          <div id="sale-doc-contrato" className={`sale-doc-page${printDoc === null ? ' sale-page-break' : ''}`} style={{ padding: '12mm 15mm', height: '297mm', boxSizing: 'border-box', overflow: 'hidden', fontSize: 11.5, lineHeight: 1.55 }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              {logoEl}
              <h2 style={{ fontSize: 13, fontWeight: 'bold', marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 }}>CONTRATO DE COMPRA-VENTA DE VEHÍCULO USADO</h2>
            </div>
            <p style={{ marginBottom: 10, textAlign: 'justify' }}>
              Nosotros, <strong>{concesionario.nombre_empresa}</strong>, titulares del RIF <strong>{concesionario.rif}</strong>, actuando en nombre del Concesionario (<em>El Vendedor</em>); y <strong>{compradorNombre}</strong>, titular de la Cédula/RIF <strong>{compradorCedula || '—'}</strong> (<em>El Comprador</em>), declaramos lo siguiente:
            </p>
            <p style={{ marginBottom: 9, textAlign: 'justify' }}>
              <strong>PRIMERA:</strong> El Vendedor da en venta pura y simple, perfecta e irrevocable al Comprador, el vehículo: Marca: <strong>{vehiculo.make}</strong>, Modelo: <strong>{vehiculo.model}</strong>, Año: <strong>{vehiculo.year}</strong>, Color: <strong>{vehiculo.exteriorColor}</strong>, Placa: <strong>{vehiculo.placa || '—'}</strong>, Serial Carrocería: <strong>{vehiculo.serial_carroceria || '—'}</strong>, Serial Motor: <strong>{vehiculo.serial_motor || '—'}</strong>, Clase: <strong>{vehiculo.clase || '—'}</strong>, Tipo: <strong>{vehiculo.tipo || '—'}</strong>. El cual a la fecha de la entrega tiene un kilometraje de <strong>{vehiculo.mileage?.toLocaleString() || '—'} km</strong>.
            </p>
            <p style={{ marginBottom: 9, textAlign: 'justify' }}>
              <strong>SEGUNDA:</strong> El precio de la venta es de <strong>{precioEnLetras}</strong> (<strong>$ {FMT_MONEY(total)}</strong>), recibidos en forma de pago a entera satisfacción.
            </p>
            <p style={{ marginBottom: 9, textAlign: 'justify' }}>
              <strong>TERCERA (Origen de Fondos):</strong> El Comprador declara que el dinero utilizado proviene de actividades lícitas de conformidad con la Ley contra la Delincuencia Organizada.
            </p>
            <p style={{ marginBottom: 9, textAlign: 'justify' }}>
              <strong>CUARTA (Estado del Bien):</strong> El Comprador declara recibir el vehículo en el estado en que se encuentra, habiendo realizado las pruebas mecánicas pertinentes.
            </p>
            <p style={{ marginBottom: 9, textAlign: 'justify' }}>
              <strong>QUINTA:</strong> El Vendedor transfiere la plena propiedad y queda obligado al saneamiento de Ley.
            </p>
            <p style={{ marginBottom: 18 }}>En {concesionario.direccion || 'Caracas'}, a la fecha del {FMT_DATE(fecha)}.</p>
            {signatureBlock(`VENDEDOR: ${concesionario.nombre_empresa}`, `COMPRADOR: ${compradorNombre}`)}
          </div>
        )}

        {/* ── DOC 3: ACTA DE ENTREGA ── */}
        {(printDoc === 'acta' || printDoc === null) && (
          <div id="sale-doc-acta" className="sale-doc-page" style={{ padding: '12mm 15mm', height: '297mm', boxSizing: 'border-box', overflow: 'hidden', fontSize: 11.5, lineHeight: 1.6 }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              {logoEl}
              <h2 style={{ fontSize: 12.5, fontWeight: 'bold', marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 }}>ACTA DE ENTREGA DE VEHÍCULO Y DESLINDE CIVIL/PENAL</h2>
            </div>
            <p style={{ marginBottom: 12, textAlign: 'justify' }}>
              Por medio de la presente, se hace constar que en fecha <strong>{FMT_DATE8(fecha)}</strong> a las <strong>{FMT_TIME24(fecha)}</strong> horas, se hace entrega física del vehículo Marca: <strong>{vehiculo.make}</strong>, Modelo: <strong>{vehiculo.model}</strong>, Placa: <strong>{vehiculo.placa || '—'}</strong>, Serial Carrocería: <strong>{vehiculo.serial_carroceria || '—'}</strong>, al ciudadano <strong>{compradorNombre}</strong>, C.I./RIF: <strong>{compradorCedula || '—'}</strong>.
            </p>
            <p style={{ fontWeight: 'bold', marginBottom: 6 }}>CLÁUSULAS DE SEGURIDAD:</p>
            <p style={{ marginBottom: 9, textAlign: 'justify' }}>
              <strong>Responsabilidad:</strong> A partir de este momento, el Comprador asume la total responsabilidad civil, penal y administrativa derivada del uso del vehículo, incluyendo multas e infracciones de tránsito.
            </p>
            <p style={{ marginBottom: 9 }}>
              <strong>Kilometraje de Entrega:</strong> {vehiculo.mileage?.toLocaleString() || '______'} Km.
            </p>
            <p style={{ marginBottom: 18, textAlign: 'justify' }}>
              <strong>Compromiso de Traspaso:</strong> El Comprador se compromete a formalizar el traspaso ante el INTT en un lapso no mayor a 30 días a partir de la presente fecha.
            </p>
            {signatureBlock(`VENDEDOR: ${vendedorNombre}`, `COMPRADOR: ${compradorNombre}`)}
          </div>
        )}
      </div>
    </div>
  );
}
