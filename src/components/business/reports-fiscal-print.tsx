'use client';

import React from 'react';
import { Venta, Concesionario } from '@/lib/business-types';
import { calculateFiscalBreakdown } from '@/lib/fiscal-helpers';
import { formatCurrency } from '@/lib/utils';

interface ReportsFiscalPrintProps {
  sales: Venta[];
  concesionario: Concesionario | null;
  period: string;
  rootId?: string;
}

export function ReportsFiscalPrint({ sales, concesionario, period, rootId = 'fiscal-print-root' }: ReportsFiscalPrintProps) {
  if (!concesionario) return null;

  const bcvRate = concesionario.configuracion?.tasa_cambio_manual || 1;
  const isExempt = concesionario.configuracion?.vehiculos_exentos_iva !== false;

  return (
    <div id={rootId} style={{ display: 'none', padding: '15mm', background: 'white', color: 'black', width: '297mm', minHeight: '210mm', fontFamily: 'sans-serif' }}>
      <style type="text/css">{`
        @media print {
          body * { visibility: hidden !important; }
          #${rootId}, #${rootId} * { visibility: visible !important; }
          #${rootId} { position: absolute !important; left: 0 !important; top: 0 !important; display: block !important; width: 297mm !important; }
        }
        @page { size: A4 landscape; margin: 0mm; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <div>
          <h1 style={{ fontSize: '20px', margin: 0, fontWeight: 'bold' }}>{concesionario.nombre_empresa}</h1>
          <p style={{ fontSize: '12px', margin: '2px 0' }}>RIF: {concesionario.rif}</p>
          <p style={{ fontSize: '10px', margin: '2px 0', color: '#666' }}>{concesionario.direccion}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 'bold' }}>LIBRO DE VENTAS FISCAL</h2>
          <p style={{ fontSize: '12px', margin: '5px 0' }}>PERIODO: <span style={{ fontWeight: 'bold' }}>{period.toUpperCase()}</span></p>
          <p style={{ fontSize: '10px', margin: 0 }}>Tasa BCV: {formatCurrency(bcvRate, 'VES')}</p>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th style={thStyle}>Fecha</th>
            <th style={thStyle}>N° Factura</th>
            <th style={thStyle}>N° Control</th>
            <th style={thStyle}>Cliente / RIF</th>
            <th style={thStyle}>Base Imponible (USD)</th>
            <th style={thStyle}>IVA 16% (USD)</th>
            <th style={thStyle}>IGTF 3% (USD)</th>
            <th style={thStyle}>Total (USD)</th>
            <th style={thStyle}>Total (Bs.)</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const fiscal = calculateFiscalBreakdown(sale.precio_venta, sale.metodo_pago, isExempt);
            const totalBs = fiscal.totalAmount * bcvRate;
            
            return (
              <tr key={sale.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={tdStyle}>{sale.fecha?.toDate().toLocaleDateString('es-VE')}</td>
                <td style={tdStyle}>{sale.numero_factura_venta || '---'}</td>
                <td style={tdStyle}>{sale.numero_control_venta || '---'}</td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 'bold' }}>{sale.comprador_nombre}</div>
                  <div style={{ fontSize: '8px' }}>{sale.comprador_cedula || '---'}</div>
                </td>
                <td style={tdStyle}>{formatCurrency(fiscal.baseAmount, 'USD')}</td>
                <td style={tdStyle}>{formatCurrency(fiscal.taxIVA, 'USD')}</td>
                <td style={tdStyle}>{formatCurrency(fiscal.taxIGTF, 'USD')}</td>
                <td style={tdStyle}>{formatCurrency(fiscal.totalAmount, 'USD')}</td>
                <td style={tdStyle}>{formatCurrency(totalBs, 'VES')}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>
            <td colSpan={4} style={{ ...tdStyle, textAlign: 'right' }}>TOTALES DEL PERIODO:</td>
            <td style={tdStyle}>{formatCurrency(sales.reduce((acc, s) => acc + calculateFiscalBreakdown(s.precio_venta, s.metodo_pago, isExempt).baseAmount, 0), 'USD')}</td>
            <td style={tdStyle}>{formatCurrency(sales.reduce((acc, s) => acc + calculateFiscalBreakdown(s.precio_venta, s.metodo_pago, isExempt).taxIVA, 0), 'USD')}</td>
            <td style={tdStyle}>{formatCurrency(sales.reduce((acc, s) => acc + calculateFiscalBreakdown(s.precio_venta, s.metodo_pago, isExempt).taxIGTF, 0), 'USD')}</td>
            <td style={tdStyle}>{formatCurrency(sales.reduce((acc, s) => acc + calculateFiscalBreakdown(s.precio_venta, s.metodo_pago, isExempt).totalAmount, 0), 'USD')}</td>
            <td style={tdStyle}>{formatCurrency(sales.reduce((acc, s) => acc + calculateFiscalBreakdown(s.precio_venta, s.metodo_pago, isExempt).totalAmount * bcvRate, 0), 'VES')}</td>
          </tr>
        </tfoot>
      </table>

      {/* Footer / Signatures */}
      <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-around' }}>
        <div style={{ textAlign: 'center', width: '200px', borderTop: '1px solid #000', paddingTop: '10px', fontSize: '10px' }}>
          REVISADO POR (CONTABILIDAD)
        </div>
        <div style={{ textAlign: 'center', width: '200px', borderTop: '1px solid #000', paddingTop: '10px', fontSize: '10px' }}>
          FIRMA Y SELLO DEL CONTRIBUYENTE
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px',
  textAlign: 'left',
  border: '1px solid #000',
  fontSize: '9px',
  textTransform: 'uppercase'
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #000',
  verticalAlign: 'top'
};
