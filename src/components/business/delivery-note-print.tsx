'use client';

import React from 'react';
import { Separator } from '@/components/ui/separator';

interface DeliveryNotePrintProps {
  data: any;
  concesionario: any;
  id?: string;
}

export function DeliveryNotePrint({ data, concesionario, id = "delivery-print-root" }: DeliveryNotePrintProps) {
  if (!data) return null;

  const isBs = data.moneda_original === 'bs';
  const sym = isBs ? 'Bs' : '$';
  const formatAmt = (usd: number) => (isBs && data.tasa_cambio ? usd * data.tasa_cambio : usd).toFixed(2);

  const formatDateVE = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    if (dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('-');
      return y + '/' + m.padStart(2, '0') + '/' + d.padStart(2, '0');
    }
    return dateStr;
  };

  const montoExento = (data.items || []).reduce((acc: number, item: any) => !item.aplica_iva ? acc + (item.subtotal_usd || 0) : acc, 0);
  const montoGravable = (data.items || []).reduce((acc: number, item: any) => item.aplica_iva ? acc + (item.subtotal_usd || 0) : acc, 0);
  const getBsEquiv = (usd: number) => (usd * (data.tasa_cambio || 1));

  const now = new Date();
  const registeredAt = data.created_at?.toDate ? data.created_at.toDate() : now;

  return (
    <div id={id} style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '210mm', background: 'white', color: 'black', zIndex: 9999 }}>
      <style dangerouslySetInnerHTML={{ __html: `@media print { body * { visibility: hidden !important; } #${id}, #${id} * { visibility: visible !important; } #${id} { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; } } @page { size: A4 portrait; margin: 0; } .print-root { width: 100%; background: white !important; }` }} />
      <div className="print-root text-black font-sans bg-white w-[210mm]">
        <div
          style={{ padding: '8mm 15mm 5mm 15mm', height: '297mm', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>{concesionario?.logo_url
              ? <img src={concesionario.logo_url} alt="Logo" crossOrigin="anonymous" loading="eager" style={{ width: 65, height: 65, objectFit: 'contain' }} />
              : <div style={{ width: 65, height: 65, background: '#64748b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 22, borderRadius: 4 }}>ZM</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', letterSpacing: 1, margin: 0 }}>{concesionario?.nombre_empresa}</h1>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>RIF: {concesionario?.rif || 'N/A'}</p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Resumen de Nota de Entrega</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, background: '#f8fafc', border: '1px solid #e2e8f0', padding: 14, borderRadius: 6, fontSize: 12 }}>
            <div>
              <p style={{ margin: '2px 0' }}><strong>N° Nota de Entrega:</strong> {data.numero_factura || 'N/A'}</p>
              <p style={{ margin: '2px 0' }}><strong>Proveedor:</strong> {data.proveedor_nombre}</p>
              {data.fecha_factura && <p style={{ margin: '2px 0' }}><strong>Fecha Nota de Entrega:</strong> {formatDateVE(data.fecha_factura)}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '2px 0' }}><strong>Fecha Registro:</strong> {registeredAt.getFullYear() + '/' + String(registeredAt.getMonth() + 1).padStart(2, '0') + '/' + String(registeredAt.getDate()).padStart(2, '0')}</p>
              <p style={{ margin: '2px 0' }}><strong>Tasa BCV:</strong> {data.tasa_cambio ? 'Bs ' + data.tasa_cambio.toFixed(2) : 'N/A'}</p>
              <p style={{ margin: '2px 0' }}><strong>Cargado por:</strong> {data.creado_por || 'Administrador'}</p>
            </div>
            <div style={{ gridColumn: '1 / span 2', textAlign: 'center', marginTop: 8, paddingTop: 6 }}>
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>Este documento es para control interno y no tiene validez fiscal.</p>
            </div>
          </div>

          <h3 style={{ fontWeight: 'bold', borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4, marginBottom: 7, fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Lista de Productos</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 18 }}>
            <thead>
              <tr style={{ background: '#f3f4f6', borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left', width: 80 }}>Código</th>
                <th style={{ padding: '4px 8px', textAlign: 'left' }}>Descripción</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', width: 60 }}>Cant.</th>
                <th style={{ padding: '4px 8px', textAlign: 'right', width: 110 }}>P. Unit. {sym}</th>
                <th style={{ padding: '4px 8px', textAlign: 'right', width: 110 }}>Total {sym}</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>{item.codigo || 'N/A'}</td>
                  <td style={{ padding: '6px 8px' }}>{item.nombre}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.cantidad}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{sym}{formatAmt(item.costo_unitario_usd || 0)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{sym}{formatAmt(item.subtotal_usd || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginLeft: 'auto', width: 260, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d1d5db', paddingTop: 6, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>Subtotal Neto:</span><span>{sym}{formatAmt(montoExento + montoGravable)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>IVA Referencial (16%):</span><span>{sym}{formatAmt(data.iva_monto || 0)}</span>
            </div>
            <Separator style={{ margin: '8px 0', background: '#d1d5db' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>
              <span>TOTAL:</span>
              <span>{sym}{formatAmt(data.total_usd || 0)}</span>
            </div>
            {isBs && data.total_usd && (
              <div style={{ textAlign: 'right', fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: 'bold' }}>
                REF: ${data.total_usd.toFixed(2)} USD
              </div>
            )}
            {!isBs && data.tasa_cambio && (
              <div style={{ textAlign: 'right', fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: 'bold' }}>
                EQUIV: Bs {(data.total_usd * data.tasa_cambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
