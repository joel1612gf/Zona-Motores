'use client';

import React from 'react';
import { Concesionario } from '@/lib/business-types';
import { formatCurrency } from '@/lib/utils';

interface FiscalNotePrintProps {
  printMode: 'summary' | 'retention';
  concesionario: Concesionario | null;
  noteData: any;
  rootId?: string;
}

export function FiscalNotePrint({ printMode, concesionario, noteData, rootId = 'fiscal-note-print-root' }: FiscalNotePrintProps) {
  if (!noteData || !concesionario) return null;

  const now = new Date();
  const isBs = noteData.currency === 'VES';
  const sym = isBs ? 'Bs.' : '$';
  const rate = noteData.exchange_rate || 1;
  
  // Note number logic: invoice_number + "-1"
  const noteNumber = `${noteData.invoice_number}-1`;

  const formatBs = (usd: number) => (usd * rate).toFixed(2);
  const formatNoteCurrency = (amount: number) => amount.toFixed(2);

  return (
    <div id={rootId} style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '210mm', background: 'white', color: 'black', zIndex: 9999 }}>
      <style type="text/css">{`
        @media print {
          body * { visibility: hidden !important; }
          #${rootId}, #${rootId} * { visibility: visible !important; }
          #${rootId} { position: absolute !important; left: 0 !important; top: 0 !important; display: block !important; width: 210mm !important; }
        }
        @page { size: A4; margin: 0mm; }
        .print-root { width: 100%; background: white !important; font-family: sans-serif; }
      `}</style>

      <div className="print-root">
        {/* SUMMARY PAGE */}
        {printMode === 'summary' && (
          <div style={{ padding: '15mm', minHeight: '297mm', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '20px' }}>
              <div>
                {concesionario.logo_url ? (
                  <img src={concesionario.logo_url} alt="Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: '70px', height: '70px', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', borderRadius: '8px' }}>ZM</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{concesionario.nombre_empresa}</h1>
                <p style={{ fontSize: '12px', margin: '2px 0' }}>RIF: {concesionario.rif}</p>
                <p style={{ fontSize: '10px', margin: '2px 0', color: '#666' }}>{concesionario.direccion}</p>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>RESUMEN DE NOTA DE {noteData.type === 'DEBIT' ? 'DÉBITO' : 'CRÉDITO'}</h2>
              <div style={{ width: '50px', height: '3px', background: '#2563eb', margin: '10px auto' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px', background: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div>
                <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>N° de Nota:</strong> {noteNumber}</p>
                <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Factura Afectada:</strong> {noteData.invoice_number}</p>
                <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Proveedor:</strong> {noteData.provider_name}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Fecha:</strong> {now.toLocaleDateString('es-VE')}</p>
                <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Moneda:</strong> {noteData.currency}</p>
                <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Tasa:</strong> {rate.toFixed(2)} Bs.</p>
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '10px' }}>MOTIVO DEL AJUSTE</h3>
              <p style={{ fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>{noteData.reason}</p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e5e7eb', fontSize: '12px' }}>DESCRIPCIÓN</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e5e7eb', fontSize: '12px', width: '150px' }}>MONTO ({noteData.currency})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #e5e7eb', fontSize: '13px' }}>MONTO GRAVABLE</td>
                  <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'right', fontSize: '13px' }}>{sym} {formatNoteCurrency(noteData.taxable_amount)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #e5e7eb', fontSize: '13px' }}>MONTO EXENTO</td>
                  <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'right', fontSize: '13px' }}>{sym} {formatNoteCurrency(noteData.exempt_amount)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #e5e7eb', fontSize: '13px' }}>I.V.A. (16%)</td>
                  <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'right', fontSize: '13px' }}>{sym} {formatNoteCurrency(noteData.iva_amount)}</td>
                </tr>
                {noteData.igtf_amount > 0 && (
                  <tr>
                    <td style={{ padding: '10px', border: '1px solid #e5e7eb', fontSize: '13px' }}>I.G.T.F. (3%)</td>
                    <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'right', fontSize: '13px' }}>{sym} {formatNoteCurrency(noteData.igtf_amount)}</td>
                  </tr>
                )}
                <tr style={{ background: '#f9fafb', fontWeight: 'bold' }}>
                  <td style={{ padding: '10px', border: '1px solid #e5e7eb', fontSize: '14px' }}>TOTAL NOTA</td>
                  <td style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'right', fontSize: '14px', color: '#2563eb' }}>{sym} {formatNoteCurrency(noteData.total_amount)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-around', paddingTop: '50px' }}>
              <div style={{ textAlign: 'center', width: '200px', borderTop: '1px solid #000', paddingTop: '8px', fontSize: '11px' }}>
                FIRMA AUTORIZADA
              </div>
              <div style={{ textAlign: 'center', width: '200px', borderTop: '1px solid #000', paddingTop: '8px', fontSize: '11px' }}>
                RECIBIDO POR
              </div>
            </div>
          </div>
        )}

        {/* RETENTION PAGE */}
        {printMode === 'retention' && (
          <div style={{ padding: '15mm', minHeight: '297mm', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                {concesionario.logo_url ? (
                  <img src={concesionario.logo_url} alt="Logo" style={{ width: '65px', height: '65px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: '65px', height: '65px', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '22px', borderRadius: '4px' }}>ZM</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', color: '#2563eb', margin: 0 }}>{concesionario.nombre_empresa}</h1>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>RIF: {concesionario.rif}</p>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Comprobante de Retención de I.V.A.</h2>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Providencia Administrativa N° SNAT/2015/0049 (Revisada 2026)</p>
              <div style={{ width: '60px', height: '3px', background: '#2563eb', margin: '6px auto' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px', background: '#f9fafb', border: '1px solid #dbeafe', padding: '14px', borderRadius: '6px' }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', margin: '0 0 6px 0' }}>Datos del Agente de Retención (Comprador)</p>
                <p style={{ fontSize: '12px', margin: '2px 0' }}><strong>Razón Social:</strong> {concesionario.nombre_empresa}</p>
                <p style={{ fontSize: '12px', margin: '2px 0' }}><strong>R.I.F.:</strong> {concesionario.rif}</p>
                <p style={{ fontSize: '12px', margin: '2px 0' }}><strong>Dirección:</strong> {concesionario.direccion}</p>
              </div>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', margin: '0 0 6px 0' }}>Datos del Sujeto Retenido (Proveedor)</p>
                <p style={{ fontSize: '12px', margin: '2px 0' }}><strong>Razón Social:</strong> {noteData.provider_name}</p>
                <p style={{ fontSize: '12px', margin: '2px 0' }}><strong>R.I.F.:</strong> {noteData.provider_rif || 'N/A'}</p>
                <p style={{ fontSize: '12px', margin: '2px 0' }}><strong>Dirección:</strong> {noteData.provider_direccion || '—'}</p>
              </div>
            </div>

            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '8px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '12px' }}>
              <p style={{ margin: '2px 0' }}><strong>Número de Comprobante:</strong> {noteData.iva_retention_number}</p>
              <p style={{ margin: '2px 0' }}><strong>Fecha de Emisión del Comprobante:</strong> {now.toLocaleDateString('es-VE')}</p>
              <p style={{ margin: '2px 0' }}><strong>Período Fiscal:</strong> Año {now.getFullYear()} / Mes {String(now.getMonth() + 1).padStart(2, '0')}</p>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', borderBottom: '1.5px solid #dbeafe', paddingBottom: '4px', marginBottom: '7px' }}>Documentos de Referencia</h3>
              <p style={{ fontSize: '12px', margin: 0 }}>
                <strong>N° Nota correspondiente a esta retención:</strong> {noteNumber}&emsp;
                <strong>N° Control correspondiente:</strong> {noteData.control_number || 'N/A'}&emsp;
                <br />
                <strong>Factura Original Afectada:</strong> {noteData.invoice_number}&emsp;
                <strong>Fecha de Operación:</strong> {now.toLocaleDateString('es-VE')}
              </p>
            </div>

            <table style={{ width: '60%', marginLeft: 'auto', borderCollapse: 'collapse', fontSize: '12px' }}>
              <tbody>
                {[
                  ['Total Nota (Incluyendo IVA):', `Bs ${formatBs(noteData.total_usd || 0)}`],
                  ['Monto Exento:', `Bs ${formatBs(noteData.exempt_amount / (isBs ? 1 : 1/rate))}`],
                  ['Base Imponible (Monto Gravable):', `Bs ${formatBs(noteData.taxable_amount / (isBs ? 1 : 1/rate))}`],
                  ['Alícuota %:', '16%'],
                  ['Impuesto Causado (I.V.A. Total):', `Bs ${formatBs(noteData.iva_amount / (isBs ? 1 : 1/rate))}`],
                  ['Porcentaje de Retención:', '75%'], // Hardcoded or from provider if available
                ].map(([label, value], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#374151' }}>{label}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', width: '120px' }}>{value}</td>
                  </tr>
                ))}
                <tr style={{ background: '#dbeafe' }}>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1d4ed8', fontWeight: 'bold' }}>I.V.A. RETENIDO:</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1d4ed8', fontWeight: 'bold', fontSize: '14px', width: '120px' }}>Bs {formatBs((noteData.iva_amount * 0.75) / (isBs ? 1 : 1/rate))}</td>
                </tr>
              </tbody>
            </table>

            <p style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', fontStyle: 'italic', padding: '20px 0' }}>
              Este comprobante se emite en función a lo establecido en la Providencia Administrativa N° SNAT/2015/0049.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px', marginTop: 'auto' }}>
              <div style={{ borderTop: '1px solid #374151', paddingTop: '8px', textAlign: 'center', fontSize: '11px' }}>
                <p style={{ margin: 0 }}>Firma y Sello Agente de Retención</p>
                <p style={{ margin: 0, color: '#6b7280' }}>({concesionario.nombre_empresa})</p>
              </div>
              <div style={{ borderTop: '1px solid #374151', paddingTop: '8px', textAlign: 'center', fontSize: '11px' }}>
                <p style={{ margin: 0 }}>Recibido por (Proveedor):</p>
                <p style={{ margin: 0, color: '#6b7280' }}>Nombre/Firma/Cédula/Fecha</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
