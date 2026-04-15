/**
 * Robust PDF download utility for Zona Motores.
 * 
 * Uses an offscreen iframe to isolate the rendering from the main page,
 * preventing visual flashes and ensuring proper layout computation.
 * Works reliably on desktop and mobile browsers.
 */

interface DownloadPdfOptions {
  /** The DOM element ID of the portal print root (e.g. 'expense-print-root') */
  elementId: string;
  /** Output filename */
  filename: string;
  /** Maximum time in ms to wait for the element to appear in the DOM */
  maxWaitMs?: number;
}

export async function downloadPdf({ elementId, filename, maxWaitMs = 4000 }: DownloadPdfOptions): Promise<void> {
  // 1. Poll for the portal element to appear in the DOM
  let element: HTMLElement | null = null;
  const pollInterval = 100;
  const maxAttempts = Math.ceil(maxWaitMs / pollInterval);
  
  for (let i = 0; i < maxAttempts; i++) {
    element = document.getElementById(elementId);
    if (element) break;
    await new Promise(r => setTimeout(r, pollInterval));
  }

  if (!element) {
    console.error(`[downloadPdf] Element #${elementId} not found after ${maxWaitMs}ms`);
    return;
  }

  // 2. Create an offscreen iframe — completely invisible, no flash
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:210mm;height:297mm;border:none;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Could not access iframe document');

    // 3. Write a clean HTML document into the iframe with the element's content
    //    We get the outerHTML so it includes all inline styles.
    const htmlContent = element.outerHTML;

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 0; 
      background: white; 
      color: black;
      font-family: 'Helvetica', 'Arial', sans-serif;
    }
    /* Force the root element to be visible since the original has display:none */
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
      font-family: 'Helvetica', 'Arial', sans-serif;
      position: relative;
    }
    .print-root {
      display: block !important;
    }
    /* Ensure all table styles work */
    table { border-collapse: collapse; }
    /* Ensure grid/flex layouts work */
    [style*="display: grid"], [style*="display:grid"] { display: grid !important; }
    [style*="display: flex"], [style*="display:flex"] { display: flex !important; }
  </style>
</head>
<body>${htmlContent}</body>
</html>`);
    iframeDoc.close();

    // 4. Wait for iframe to fully load and compute layout
    await new Promise<void>(resolve => {
      if (iframe.contentWindow) {
        iframe.contentWindow.onload = () => resolve();
      }
      // Fallback timeout in case onload doesn't fire
      setTimeout(resolve, 500);
    });

    // 5. Wait for images inside the iframe to load
    const images = iframeDoc.querySelectorAll('img');
    if (images.length > 0) {
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete && img.naturalHeight > 0) return Promise.resolve();
          return new Promise<void>(resolve => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 3000); // Max 3s per image
          });
        })
      );
    }

    // 6. Additional layout stabilization — double rAF in iframe context
    const iframeWindow = iframe.contentWindow;
    if (iframeWindow) {
      await new Promise<void>(r => 
        iframeWindow.requestAnimationFrame(() => 
          iframeWindow.requestAnimationFrame(() => r())
        )
      );
    }

    // Extra wait for complex layouts
    await new Promise(r => setTimeout(r, 200));

    // 7. Get the target element inside the iframe
    const targetElement = iframeDoc.getElementById(elementId);
    if (!targetElement) {
      throw new Error(`Element #${elementId} not found inside iframe`);
    }

    // 8. Use html2canvas-pro to capture the element
    const html2canvas = (await import('html2canvas-pro')).default;
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,  // 210mm at 96dpi
      windowWidth: 794,
      // Capture from the iframe's window context
      foreignObjectRendering: false,
    });

    // 9. Convert canvas to PDF using jsPDF
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

    // Handle multi-page if content exceeds one page
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
    // 10. Clean up iframe
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}
