/**
 * Robust PDF download and Print utility for Zona Motores.
 * 
 * Uses an offscreen iframe to isolate the rendering from the main page,
 * preventing visual flashes, hiding the background UI, and ensuring 
 * proper layout computation (including Tailwind styles).
 */

interface PdfOptions {
  /** The DOM element ID of the portal print root (e.g. 'expense-print-root') */
  elementId: string;
  /** Output filename (only used for download) */
  filename?: string;
  /** Maximum time in ms to wait for the element to appear in the DOM */
  maxWaitMs?: number;
}

/**
 * Creates an offscreen iframe containing the target element and all page styles.
 */
async function createPrintIframe(elementId: string, maxWaitMs: number): Promise<{ iframe: HTMLIFrameElement, targetElement: HTMLElement } | null> {
  let element: HTMLElement | null = null;
  const pollInterval = 100;
  const maxAttempts = Math.ceil(maxWaitMs / pollInterval);
  
  for (let i = 0; i < maxAttempts; i++) {
    element = document.getElementById(elementId);
    if (element) break;
    await new Promise(r => setTimeout(r, pollInterval));
  }

  if (!element) {
    console.error(`[PdfUtils] Element #${elementId} not found after ${maxWaitMs}ms`);
    return null;
  }

  const sourceImages = element.querySelectorAll('img');
  if (sourceImages.length > 0) {
    await Promise.all(
      Array.from(sourceImages).map(img => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 2000); 
        });
      })
    );
  }

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:210mm;height:297mm;border:none;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Could not access iframe document');
  }

  const htmlContent = element.outerHTML;
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(node => node.outerHTML)
    .join('\n');

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${styles}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 0; 
      background: white; 
      color: black;
    }
    #${elementId} {
      display: block !important;
      position: static !important;
      width: 210mm !important;
      background: white !important;
      color: black !important;
    }
    .print-page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      box-sizing: border-box;
      background: white !important;
      position: relative;
    }
    .print-root { display: block !important; }
    table { border-collapse: collapse; }
    [style*="display: grid"], [style*="display:grid"] { display: grid !important; }
    [style*="display: flex"], [style*="display:flex"] { display: flex !important; }
    @media print {
      body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 0; size: A4 portrait; }
      .print-page { padding: 15mm !important; margin: 0 !important; border: none !important; box-shadow: none !important; }
    }
  </style>
</head>
<body>${htmlContent}</body>
</html>`);
  iframeDoc.close();

  await new Promise<void>(resolve => {
    if (iframe.contentWindow) {
      iframe.contentWindow.onload = () => resolve();
    }
    setTimeout(resolve, 500);
  });

  const images = iframeDoc.querySelectorAll('img');
  if (images.length > 0) {
    await Promise.all(
      Array.from(images).map(img => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 3000);
        });
      })
    );
  }

  const iframeWindow = iframe.contentWindow;
  if (iframeWindow) {
    await new Promise<void>(r => 
      iframeWindow.requestAnimationFrame(() => 
        iframeWindow.requestAnimationFrame(() => r())
      )
    );
  }

  await new Promise(r => setTimeout(r, 200));

  const targetElement = iframeDoc.getElementById(elementId);
  if (!targetElement) {
    document.body.removeChild(iframe);
    throw new Error(`Element #${elementId} not found inside iframe`);
  }

  return { iframe, targetElement };
}

export async function downloadPdf({ elementId, filename = 'document.pdf', maxWaitMs = 4000 }: PdfOptions): Promise<void> {
  let iframeRef: HTMLIFrameElement | null = null;
  
  try {
    const result = await createPrintIframe(elementId, maxWaitMs);
    if (!result) return;
    
    iframeRef = result.iframe;
    const { targetElement } = result;

    const html2canvas = (await import('html2canvas-pro')).default;
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      foreignObjectRendering: false,
    });

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = 0;
      let page = 0;

      while (heightLeft > 0) {
        if (page > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position -= pageHeight;
        page++;
      }
    }

    pdf.save(filename);
  } catch (err) {
    console.error('[downloadPdf] Error generating PDF:', err);
  } finally {
    if (iframeRef && document.body.contains(iframeRef)) {
      document.body.removeChild(iframeRef);
    }
  }
}

export async function printPdf({ elementId, maxWaitMs = 4000 }: PdfOptions): Promise<void> {
  let iframeRef: HTMLIFrameElement | null = null;
  
  try {
    const result = await createPrintIframe(elementId, maxWaitMs);
    if (!result) return;
    
    iframeRef = result.iframe;
    const iframeWindow = iframeRef.contentWindow;
    
    if (iframeWindow) {
      iframeWindow.focus();
      iframeWindow.print();
    }
  } catch (err) {
    console.error('[printPdf] Error printing document:', err);
  } finally {
    // We delay the removal so the print dialog has time to open
    setTimeout(() => {
      if (iframeRef && document.body.contains(iframeRef)) {
        document.body.removeChild(iframeRef);
      }
    }, 2000);
  }
}
