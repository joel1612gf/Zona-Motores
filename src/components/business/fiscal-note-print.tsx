'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Concesionario } from '@/lib/business-types';
import { LegalRetentionVoucher } from './legal-retention-voucher';

interface FiscalNotePrintProps {
  printMode: 'summary' | 'retention';
  concesionario: Concesionario | null;
  noteData: any;
  rootId?: string;
}

export function FiscalNotePrint({ printMode, concesionario, noteData, rootId = 'fiscal-note-print-root' }: FiscalNotePrintProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!noteData || !concesionario || !mounted) return null;

  const now = new Date();
  const isBs = noteData.currency === 'VES';
  const sym = isBs ? 'Bs.' : '$';
  const rate = noteData.exchange_rate || 1;
  
  const noteNumber = `${noteData.invoice_number}-1`;
  const formatNoteCurrency = (amount: any) => (parseFloat(amount) || 0).toFixed(2);

  const formatDateYYYYMMDD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  };

  const content = (
    <div 
      id={rootId} 
      style={{ 
        display: 'none', 
        width: '210mm',
        background: 'white', 
        color: 'black', 
        margin: 0,
        padding: 0,
        boxSizing: 'border-box'
      }}
    >
      <style type="text/css">{`
        @media print {
          html, body { height: auto; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          body > * { display: none !important; }
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
              <h2 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Resumen de Nota de {noteData.type === 'DEBIT' ? 'Débito' : 'Crédito'}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, background: '#f9fafb', border: '1px solid #dbeafe', padding: 14, borderRadius: 6, fontSize: 12 }}>
              <div>
                <p style={{ margin: '2px 0' }}><strong>Número de Nota:</strong> {noteData.id?.slice(-8).toUpperCase() || 'N/A'}</p>
                <p style={{ margin: '2px 0' }}><strong>Factura Afectada:</strong> {noteData.invoice_number || 'N/A'}</p>
                <p style={{ margin: '2px 0' }}><strong>Proveedor:</strong> {noteData.provider_name} {noteData.provider_rif ? `(${noteData.provider_rif})` : ''}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '2px 0' }}><strong>Fecha Operación:</strong> {formatDateYYYYMMDD(now)}</p>
                <p style={{ margin: '2px 0' }}><strong>Tasa BCV:</strong> {noteData.exchange_rate ? `Bs ${parseFloat(noteData.exchange_rate).toFixed(2)}` : 'N/A'}</p>
                <p style={{ margin: '2px 0' }}><strong>Cargado por:</strong> {noteData.creado_por || 'Administrador'}</p>
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
              {noteData.reason || 'Sin descripción detallada.'}
            </div>

            <div style={{ marginLeft: 'auto', width: 260, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d1d5db', paddingTop: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Monto Exento:</span><span>{sym}{formatNoteCurrency(noteData.exempt_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Monto Gravable:</span><span>{sym}{formatNoteCurrency(noteData.taxable_amount)}</span>
              </div>
              {parseFloat(noteData.iva_amount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>IVA (16%):</span><span>{sym}{formatNoteCurrency(noteData.iva_amount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600 }}>IGTF (3%):</span>
                  <span>{sym}{formatNoteCurrency(noteData.igtf_amount || 0)}</span>
                </div>
                {!isBs && noteData.exchange_rate && parseFloat(noteData.igtf_amount) > 0 && (
                  <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>
                    Equiv: Bs {(parseFloat(noteData.igtf_amount) * noteData.exchange_rate).toFixed(2)}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '2px solid #d1d5db', paddingTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 'bold', fontSize: 15 }}>
                  <span>Total Nota:</span><span style={{ color: '#2563eb' }}>{sym}{formatNoteCurrency(noteData.total_amount)}</span>
                </div>
                {!isBs && noteData.exchange_rate && (
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    Equivalente: Bs {(parseFloat(noteData.total_amount) * noteData.exchange_rate).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RETENTION (LEGAL) */}
        {printMode === 'retention' && (
          <LegalRetentionVoucher 
            concesionario={concesionario} 
            data={{
              ...noteData,
              date: formatDateYYYYMMDD(now) // Current date for issuance
            }} 
          />
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
