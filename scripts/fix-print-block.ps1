$file = "src\components\business\purchase-order-dialog.tsx"
$lines = [System.IO.File]::ReadAllLines($file)

$before = $lines[0..1206]  # lines 1-1207 (0-indexed: 0..1206)
$after  = $lines[1411..($lines.Length - 1)]   # lines 1412-end (0-indexed: 1411+)

$newBlock = @"
      {/* Printable Sheets --- same logic as purchase-history-dialog.tsx */}
      {successData && (() => {
        const isBs = successData.moneda_original === 'bs';
        const sym = isBs ? 'Bs' : '$';
        const formatAmt = (usd: number) => (isBs && successData.tasa_cambio ? usd * successData.tasa_cambio : usd).toFixed(2);
        const hasIva = successData.iva_monto > 0;
        const hasRetention = !!successData.numero_comprobante;

        const formatDateVE = (dateStr: string) => {
          if (!dateStr) return 'N/A';
          if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-');
            return y + '/' + m.padStart(2, '0') + '/' + d.padStart(2, '0');
          }
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts[0].length === 4) return dateStr;
            const [d2, m2, y2] = parts;
            return y2 + '/' + m2.padStart(2, '0') + '/' + d2.padStart(2, '0');
          }
          return dateStr;
        };

        const montoExento = (successData.items || []).reduce((acc: number, item: any) => !item.aplica_iva ? acc + (item.subtotal_usd || 0) : acc, 0);
        const montoGravable = (successData.items || []).reduce((acc: number, item: any) => item.aplica_iva ? acc + (item.subtotal_usd || 0) : acc, 0);
        const getBsEquiv = (usd: number) => (usd * (successData.tasa_cambio || 1));
        const subtotalPlusIva = montoExento + montoGravable + (successData.iva_monto || 0);
        const igtfUsd = !isBs ? subtotalPlusIva * 0.03 : 0;
        const finalTotalUsd = subtotalPlusIva + igtfUsd;
        const now = new Date();
        const registeredAt = successData.created_at?.toDate ? successData.created_at.toDate() : now;

        return (
          <div id="purchase-print-root" style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '210mm', background: 'white', color: 'black', zIndex: 9999 }}>
            <style dangerouslySetInnerHTML={{ __html: '@media print { body * { visibility: hidden !important; } #purchase-print-root, #purchase-print-root * { visibility: visible !important; } #purchase-print-root { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; } } @page { size: A4 portrait; margin: 0; } .print-root { width: 100%; background: white !important; } .page-break-after { page-break-after: always; break-after: page; }' }} />
            <div key={`success-print-print`} className="print-root text-black font-sans bg-white w-[210mm]">

              {/* PAGE 1: PURCHASE SUMMARY */}
              {(printMode === 'both' || printMode === 'summary') && (
                <div
                  data-print-page="summary"
                  className={hasRetention && printMode === 'both' ? 'page-break-after' : ''}
                  style={{ padding: '8mm 15mm 5mm 15mm', height: '297mm', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>{concesionario?.logo_url
                      ? <img src={concesionario.logo_url} alt="Logo" crossOrigin="anonymous" style={{ width: 65, height: 65, objectFit: 'contain' }} />
                      : <div style={{ width: 65, height: 65, background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 22, borderRadius: 4 }}>ZM</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <h1 style={{ fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase', color: '#2563eb', letterSpacing: 1, margin: 0 }}>{concesionario?.nombre_empresa}</h1>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>RIF: {concesionario?.rif || 'N/A'}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Resumen de Compra</h2>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, background: '#f9fafb', border: '1px solid #dbeafe', padding: 14, borderRadius: 6, fontSize: 12 }}>
                    <div>
                      <p style={{ margin: '2px 0' }}><strong>N Factura:</strong> {successData.numero_factura || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>N Control:</strong> {successData.numero_control || 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Proveedor:</strong> {successData.proveedor_nombre} {successData.proveedor_rif ? '(' + successData.proveedor_rif + ')' : ''}</p>
                      {successData.fecha_factura && <p style={{ margin: '2px 0' }}><strong>Fecha Factura:</strong> {formatDateVE(successData.fecha_factura)}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '2px 0' }}><strong>Fecha Registro:</strong> {registeredAt.getFullYear() + '/' + String(registeredAt.getMonth() + 1).padStart(2, '0') + '/' + String(registeredAt.getDate()).padStart(2, '0')}</p>
                      <p style={{ margin: '2px 0' }}><strong>Tasa BCV:</strong> {successData.tasa_cambio ? 'Bs ' + successData.tasa_cambio.toFixed(2) : 'N/A'}</p>
                      <p style={{ margin: '2px 0' }}><strong>Cargado por:</strong> {successData.creado_por || 'Administrador'}</p>
                      {hasRetention && <p style={{ margin: '2px 0' }}><strong>N Retencion IVA:</strong> {successData.numero_comprobante}</p>}
                    </div>
                    <div style={{ gridColumn: '1 / span 2', textAlign: 'center', marginTop: 8, paddingTop: 6, borderTop: '0.5px solid #e5e7eb' }}>
                      <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>Este documento no tiene validez fiscal.</p>
                    </div>
                  </div>
                  <h3 style={{ fontWeight: 'bold', borderBottom: '1.5px solid #dbeafe', paddingBottom: 4, marginBottom: 7, fontSize: 12, color: '#2563eb', textTransform: 'uppercase' }}>Lista de Productos</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 18 }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>
                        <th style={{ padding: '4px 8px', textAlign: 'left', width: 80 }}>Codigo</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>Descripcion</th>
                        <th style={{ padding: '4px 8px', textAlign: 'center', width: 60 }}>Cant.</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right', width: 110 }}>P. Unit. {sym}</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right', width: 110 }}>Total {sym}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(successData.items || []).map((item: any, i: number) => (
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
                      <span style={{ fontWeight: 600 }}>Monto Exento:</span><span>{sym}{formatAmt(montoExento)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>Monto Gravable:</span><span>{sym}{formatAmt(montoGravable)}</span>
                    </div>
                    {hasIva && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>IVA (16%):</span><span>{sym}{formatAmt(successData.iva_monto || 0)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontWeight: 600 }}>IGTF (3%):</span>
                        <span>{sym}{formatAmt(igtfUsd)}</span>
                      </div>
                      {!isBs && successData.tasa_cambio && (
                        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>Equiv: Bs {getBsEquiv(igtfUsd).toFixed(2)}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '2px solid #d1d5db', paddingTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 'bold', fontSize: 15 }}>
                        <span>Total:</span><span style={{ color: '#2563eb' }}>{sym}{formatAmt(finalTotalUsd)}</span>
                      </div>
                      {!isBs && successData.tasa_cambio && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Equivalente: Bs {getBsEquiv(finalTotalUsd).toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE 2: COMPROBANTE DE RETENCION --- identical to history dialog */}
              {hasRetention && (printMode === 'both' || printMode === 'retention') && (
                <div data-print-page="retention" style={{ display: 'flex', flexDirection: 'column' }}>
                  <LegalRetentionVoucher
                    concesionario={concesionario}
                    data={{
                      currency: 'USD',
                      exchange_rate: successData.tasa_cambio,
                      iva_retention_number: successData.numero_comprobante || '',
                      invoice_number: successData.numero_factura || '',
                      control_number: successData.numero_control,
                      date: formatDateVE(successData.fecha_factura || ''),
                      original_invoice_date: formatDateVE(successData.fecha_factura || ''),
                      provider_name: successData.proveedor_nombre,
                      provider_rif: successData.proveedor_rif || '',
                      provider_direccion: successData.proveedor_direccion,
                      taxable_amount: montoGravable,
                      exempt_amount: montoExento,
                      iva_amount: successData.iva_monto,
                      total_amount: subtotalPlusIva,
                      igtf_amount: igtfUsd,
                      retention_iva_rate: successData.porcentaje_retencion_aplicado,
                      type: 'EXPENSE'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}
"@

$newLines = $newBlock -split "`n" | ForEach-Object { $_.TrimEnd("`r") }

$combined = $before + $newLines + $after
[System.IO.File]::WriteAllLines($file, $combined, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done. New total lines: $($combined.Length)"
