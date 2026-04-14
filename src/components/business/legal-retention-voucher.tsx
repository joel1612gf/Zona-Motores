'use client';

import React from 'react';
import { Concesionario } from '@/lib/business-types';

interface LegalRetentionVoucherProps {
  concesionario: Concesionario | null;
  data: {
    currency: 'USD' | 'VES';
    exchange_rate: number;
    iva_retention_number: string;
    invoice_number: string;
    control_number?: string;
    date: string;
    provider_name: string;
    provider_rif: string;
    provider_direccion?: string;
    taxable_amount: any;
    exempt_amount: any;
    iva_amount: any;
    total_amount: any;
    igtf_amount?: any;
    retention_iva_rate?: any;
    type?: 'EXPENSE' | 'DEBIT' | 'CREDIT';
  };
}

export function LegalRetentionVoucher({ concesionario, data }: LegalRetentionVoucherProps) {
  if (!concesionario) return null;

  const now = new Date();
  const isBs = data.currency === 'VES';
  const rate = parseFloat(data.exchange_rate as any) || 1;

  const toVes = (val: any) => {
    const num = parseFloat(val) || 0;
    return isBs ? num : num * rate;
  };

  const formatBsVal = (num: number) => {
    return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  // Technical values in Bs.
  const totalBsNum = toVes(data.total_amount);
  const gravableBsNum = toVes(data.taxable_amount);
  const exentoBsNum = toVes(data.exempt_amount);
  const ivaBsNum = toVes(data.iva_amount);
  const igtfBsNum = toVes(data.igtf_amount || 0);

  const pctRet = parseInt(data.retention_iva_rate || '75');
  const ivaRetBsNum = (ivaBsNum * pctRet) / 100;
  const netoAPagarBsNum = totalBsNum - ivaRetBsNum;

  // Note numbers logic
  const isNote = data.type === 'DEBIT' || data.type === 'CREDIT';
  const noteNumber = isNote ? `${data.invoice_number}-1` : '';

  const formatDate = (val: Date | string) => {
    if (!val) return '—';
    
    // If it's a Date object
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}/${m}/${d}`;
    }

    // If it's a string (ISO, YYYY-MM-DD or DD/MM/YYYY)
    if (val.includes('-')) {
      const [y, m, d] = val.split('T')[0].split('-');
      return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
    }
    if (val.includes('/')) {
      const parts = val.split('/');
      if (parts[0].length === 4) return val; // already YYYY/MM/DD
      const [d, m, y] = parts;
      return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
    }
    return val;
  };

  return (
    <div className="print-page" style={{
      padding: '8mm 15mm 5mm 15mm',
      height: '284mm',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      position: 'relative',
      background: 'white',
      color: 'black',
      fontFamily: 'sans-serif',
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact'
    } as any}>
      {/* HEADER - IDENTICAL TO PURCHASES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          {concesionario?.logo_url ? (
            <img
              src={concesionario.logo_url}
              alt="Logo"
              crossOrigin="anonymous"
              loading="eager"
              style={{ width: 65, height: 65, objectFit: 'contain' }}
            />
          ) : (
            <div style={{ width: 65, height: 65, background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 22, borderRadius: 4 }}>ZM</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase', color: '#2563eb', letterSpacing: 1, margin: 0 }}>{concesionario?.nombre_empresa}</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>RIF: {concesionario?.rif || '—'}</p>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Comprobante de Retención de I.V.A.</h2>
        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Providencia Administrativa N° SNAT/2025/000054 de fecha 02/07/2025</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, background: '#f9fafb', border: '1px solid #dbeafe', padding: '12px 14px', borderRadius: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: 10, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Datos del Agente de Retención (Comprador)</p>
          <p style={{ fontSize: 12, margin: '1px 0', lineHeight: 1.2 }}><strong>Razón Social:</strong> {concesionario.nombre_empresa}</p>
          <p style={{ fontSize: 12, margin: '1px 0', lineHeight: 1.2 }}><strong>R.I.F.:</strong> {concesionario.rif || '—'}</p>
          <p style={{ fontSize: 12, margin: '1px 0', lineHeight: 1.2 }}><strong>Dirección:</strong> {concesionario.direccion || '—'}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: 10, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Datos del Sujeto Retenido (Proveedor)</p>
          <p style={{ fontSize: 12, margin: '1px 0', lineHeight: 1.2 }}><strong>Razón Social:</strong> {data.provider_name}</p>
          <p style={{ fontSize: 12, margin: '1px 0', lineHeight: 1.2 }}><strong>R.I.F.:</strong> {data.provider_rif || '—'}</p>
          <p style={{ fontSize: 12, margin: '1px 0', lineHeight: 1.2 }}><strong>Dirección:</strong> {data.provider_direccion || '—'}</p>
        </div>
      </div>

      <div style={{ 
        background: '#f9fafb', 
        border: '1px solid #e5e7eb', 
        padding: '10px 14px', 
        borderRadius: 6, 
        marginBottom: 14, 
        fontSize: 12,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '40px'
      }}>
        <p style={{ margin: '1px 0', lineHeight: 1.2 }}><strong>Número de Comprobante:</strong> {data.iva_retention_number}</p>
        <p style={{ margin: '1px 0', lineHeight: 1.2 }}><strong>Fecha de Emisión:</strong> {formatDate(now)}</p>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: 12, fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', borderBottom: '1.5px solid #dbeafe', paddingBottom: 4, marginBottom: 7 }}>Documentos de Referencia</h3>
        <p style={{ fontSize: 12, margin: 0 }}>
          {isNote ? (
            <>
              <strong>N° Nota correspondiente a esta retención:</strong> {noteNumber}&emsp;
              <strong>N° Control correspondiente:</strong> {data.control_number || '—'}&emsp;
              <br />
              <strong>Factura Original Afectada:</strong> {data.invoice_number}&emsp;
              <strong>Fecha de Operación:</strong> {formatDate(data.date)}
            </>
          ) : (
            <>
              <strong>N° Factura:</strong> {data.invoice_number || '—'}&emsp;
              <strong>N° Control:</strong> {data.control_number || '—'}&emsp;
              <strong>Fecha Factura:</strong> {formatDate(data.date)}
            </>
          )}
        </p>
      </div>

      <table style={{ width: '58%', marginLeft: 'auto', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {([
            [igtfBsNum > 0 ? 'Total Factura (Compras Incluyendo IVA e IGTF):' : 'Total Factura (Compras Incluyendo IVA):', `Bs ${formatBsVal(totalBsNum)}`],
            ['Base Imponible (Total Compras Gravadas):', `Bs ${formatBsVal(gravableBsNum)}`],
            ['Monto Exento (Sin Derecho a Crédito Fiscal):', `Bs ${formatBsVal(exentoBsNum)}`],
            ['Alícuota %:', '16%'],
            ['Impuesto Causado (I.V.A. Total):', `Bs ${formatBsVal(ivaBsNum)}`],
            ['Porcentaje de Retención (SENIAT):', `${pctRet}%`],
            ['I.G.T.F. (3%):', `Bs ${formatBsVal(igtfBsNum)}`],
          ] as [string, string][]).map(([label, value], i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#374151' }}>{label}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', width: 120 }}>{value}</td>
            </tr>
          ))}
          <tr style={{ background: '#dbeafe' }}>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1d4ed8', fontWeight: 'bold' }}>I.V.A. RETENIDO (A ENTERAR AL SENIAT):</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1d4ed8', fontWeight: 'bold', fontSize: 14, width: 120 }}>Bs {formatBsVal(ivaRetBsNum)}</td>
          </tr>
          <tr style={{ borderTop: '2px solid #d1d5db' }}>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>Neto a Pagar a Proveedor:</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', width: 120 }}>Bs {formatBsVal(netoAPagarBsNum)}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', fontStyle: 'italic', padding: '4px 0' }}>
        Este comprobante se emite en función a lo establecido en la Providencia Administrativa N° SNAT/2025/000054 de fecha 02/07/2025 Publicada en Gaceta Oficial Nro. 43.171 de fecha 16 de Julio de 2025
      </p>
      <div style={{ marginTop: 'auto', paddingBottom: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: '2mm' }}>
          <div style={{ borderTop: '1px solid #374151', paddingTop: 8, textAlign: 'center', fontSize: 11 }}>
            <p style={{ margin: 0 }}>Firma y Sello Agente de Retención</p>
            <p style={{ margin: 0, color: '#6b7280' }}>({concesionario?.nombre_empresa})</p>
          </div>
          <div style={{ borderTop: '1px solid #374151', paddingTop: 8, textAlign: 'center', fontSize: 11 }}>
            <p style={{ margin: 0 }}>Recibido por (Proveedor):</p>
            <p style={{ margin: 0, color: '#6b7280' }}>Nombre/Firma/Cédula/Fecha</p>
          </div>
        </div>
      </div>
    </div>
  );
}
