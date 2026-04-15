'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Concesionario } from '@/lib/business-types';
import { LegalRetentionVoucher } from './legal-retention-voucher';

interface ExpensePrintProps {
  printMode: 'summary' | 'iva' | 'islr';
  concesionario: Concesionario | null;
  expenseData: any;
  rootId?: string;
}

export function ExpensePrint({ printMode, concesionario, expenseData, rootId = 'expense-print-root' }: ExpensePrintProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!expenseData || !concesionario || !mounted) return null;

  const now = new Date();
  const isBs = expenseData.currency === 'VES';
  const sym = isBs ? 'Bs.' : '$';
  const rate = expenseData.exchange_rate || 1;

  const formatAmt = (amount: any) => (parseFloat(amount) || 0).toFixed(2);

  const formatDateYYYYMMDD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  };

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '—';
    if (dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('-');
      return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts[0].length === 4) return dateStr;
      const [d, m, y] = parts;
      return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
    }
    return dateStr;
  };

  const content = (
    <div 
      id={rootId} 
      style={{ 
        display: 'none', 
        width: '210mm',
        background: 'white', 
        color: 'black'
      }}
    >
      <style type="text/css">{`
        @media print {
          html, body { height: auto !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          body > *:not(#${rootId}) { display: none !important; }
          #${rootId} { 
            display: block !important; 
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
        @page { size: A4 portrait; margin: 0; }
        .print-page { 
          width: 210mm; 
          min-height: 297mm; 
          padding: 15mm; 
          box-sizing: border-box;
          background: white !important;
          font-family: 'Helvetica', 'Arial', sans-serif;
          position: relative;
        }
      `}</style>

      <div className="print-root">
        {/* SUMMARY */}
        {printMode === 'summary' && (
          <div style={{ padding: '8mm 15mm 5mm 15mm', height: '297mm', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative', background: 'white', color: 'black' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>{concesionario?.logo_url
                ? <img src={concesionario.logo_url} alt="Logo" crossOrigin="anonymous" style={{ width: 65, height: 65, objectFit: 'contain' }} />
                : <div style={{ width: 65, height: 65, background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 22, borderRadius: 4 }}>ZM</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase', color: '#2563eb', letterSpacing: 1, margin: 0 }}>{concesionario?.nombre_empresa}</h1>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>RIF: {concesionario?.rif || '—'}</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Resumen de Gastos</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, background: '#f9fafb', border: '1px solid #dbeafe', padding: 14, borderRadius: 6, fontSize: 12 }}>
              <div>
                <p style={{ margin: '2px 0' }}><strong>N° Factura:</strong> {expenseData.invoice_number || 'N/A'}</p>
                <p style={{ margin: '2px 0' }}><strong>N° Control:</strong> {expenseData.control_number || 'N/A'}</p>
                <p style={{ margin: '2px 0' }}><strong>Proveedor:</strong> {expenseData.provider_name} {expenseData.provider_rif ? `(${expenseData.provider_rif})` : ''}</p>
                {expenseData.date && <p style={{ margin: '2px 0' }}><strong>Fecha Factura:</strong> {formatDateStr(expenseData.date)}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '2px 0' }}><strong>Fecha Registro:</strong> {formatDateYYYYMMDD(now)}</p>
                <p style={{ margin: '2px 0' }}><strong>Tasa BCV:</strong> {expenseData.exchange_rate ? `Bs ${expenseData.exchange_rate.toFixed(2)}` : 'N/A'}</p>
                <p style={{ margin: '2px 0' }}><strong>Cargado por:</strong> {expenseData.creado_por || expenseData.created_by_name || 'Administrador'}</p>
                {expenseData.iva_retention_number && <p style={{ margin: '2px 0' }}><strong>N° Retención IVA:</strong> {expenseData.iva_retention_number}</p>}
              </div>
              {/* Disclaimer centered at the bottom of the grid box */}
              <div style={{ gridColumn: '1 / span 2', textAlign: 'center', marginTop: 8, borderTop: '0.5px solid #ffffffff', paddingTop: 6 }}>
                <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>
                  Este documento no tiene validez fiscal.
                </p>
              </div>
            </div>

            <h3 style={{ fontWeight: 'bold', borderBottom: '1.5px solid #dbeafe', paddingBottom: 4, marginBottom: 7, fontSize: 12, color: '#2563eb', textTransform: 'uppercase' }}>Resumen de la operación:</h3>
            <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, lineHeight: 1.5, marginBottom: 18, minHeight: '60px' }}>
              {expenseData.description || 'Sin descripción detallada.'}
            </div>

            <div style={{ marginLeft: 'auto', width: 260, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d1d5db', paddingTop: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Monto Exento:</span><span>{sym}{formatAmt(expenseData.exempt_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Monto Gravable:</span><span>{sym}{formatAmt(expenseData.base_amount)}</span>
              </div>
              {parseFloat(expenseData.iva_amount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>IVA (16%):</span><span>{sym}{formatAmt(expenseData.iva_amount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600 }}>IGTF (3%):</span>
                  <span>{sym}{formatAmt(!isBs ? (parseFloat(expenseData.total_amount) * 0.03) : 0)}</span>
                </div>
                {!isBs && expenseData.exchange_rate && (
                  <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>
                    Equiv: Bs {(parseFloat(expenseData.total_amount) * 0.03 * expenseData.exchange_rate).toFixed(2)}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '2px solid #d1d5db', paddingTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 'bold', fontSize: 15 }}>
                  <span>Total:</span><span style={{ color: '#2563eb' }}>{sym}{formatAmt(!isBs ? parseFloat(expenseData.total_amount) * 1.03 : expenseData.total_amount)}</span>
                </div>
                {!isBs && expenseData.exchange_rate && (
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    Equivalente: Bs {(parseFloat(expenseData.total_amount) * 1.03 * expenseData.exchange_rate).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* IVA RETENTION (LEGAL) */}
        {printMode === 'iva' && expenseData.iva_retention_number && (
          <LegalRetentionVoucher 
            concesionario={concesionario} 
            data={{
              ...expenseData,
              original_invoice_date: expenseData.date, // Same as date for expenses
              taxable_amount: expenseData.base_amount, // Map base_amount to taxable_amount
              type: 'EXPENSE'
            }} 
          />
        )}

        {/* ISLR RETENTION (LEGAL) */}
        {printMode === 'islr' && expenseData.islr_retention_number && (
          <div className="print-page">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', textTransform: 'uppercase' }}>Comprobante de Retención de I.S.L.R.</h2>
              <p style={{ fontSize: '11px', color: '#4b5563' }}>Decreto 1808 - Ley de Impuesto Sobre la Renta</p>
              <div style={{ width: '60px', height: '3px', background: '#2563eb', margin: '10px auto' }}></div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '15px', borderRadius: '10px', marginBottom: '25px', fontSize: '13px' }}>
              <p><strong>Número de Comprobante ISLR:</strong> {expenseData.islr_retention_number}</p>
              <p><strong>Fecha de Operación:</strong> {formatDateStr(expenseData.date)}</p>
              <p><strong>Concepto de Retención:</strong> {ISLR_CONCEPTS.find(c => c.code === expenseData.islr_concept)?.label || 'OTROS'}</p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ border: '1px solid #94a3b8', padding: '10px', textAlign: 'right' }}>Base de Retención (Bs)</th>
                  <th style={{ border: '1px solid #94a3b8', padding: '10px', textAlign: 'center' }}>% Alícuota</th>
                  <th style={{ border: '1px solid #94a3b8', padding: '10px', textAlign: 'right' }}>Monto Retenido (Bs)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #cbd5e1', padding: '12px', textAlign: 'right' }}>
                    {(isBs ? (parseFloat(expenseData.base_amount) + parseFloat(expenseData.exempt_amount)) : (parseFloat(expenseData.base_amount) + parseFloat(expenseData.exempt_amount)) * rate).toFixed(2)}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '12px', textAlign: 'center' }}>{(parseFloat(expenseData.islr_percentage) * 100).toFixed(1)}%</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px', color: '#2563eb' }}>
                    {(isBs ? parseFloat(expenseData.islr_retention_amount) : parseFloat(expenseData.islr_retention_amount) * rate).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

const ISLR_CONCEPTS = [
  { label: 'Servicios (2%)', code: 'SERV' },
  { label: 'Honorarios PN (3%)', code: 'HPN' },
  { label: 'Honorarios PJ (5%)', code: 'HPJ' },
  { label: 'Fletes (3%)', code: 'FLET' },
  { label: 'Publicidad (5%)', code: 'PUBL' },
];
