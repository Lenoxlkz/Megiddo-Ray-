import { Tracker } from '@/types';

// Fetch and parse image into raw bytes for PDF embedding
async function getImageBufferForPdf(url: string): Promise<{ buffer: ArrayBuffer; format: 'JPEG' | 'PNG'; width: number; height: number }> {
  const fetchUrl = url.startsWith('/api/proxy-image')
    ? url
    : (url.startsWith('http://') || url.startsWith('https://'))
      ? `/api/proxy-image?url=${encodeURIComponent(url)}`
      : url;

  let res: Response;
  try {
    res = await fetch(fetchUrl);
    if (!res.ok) throw new Error('Fetch failed');
  } catch (e) {
    if (fetchUrl !== url) {
      res = await fetch(url);
      if (!res.ok) throw new Error('Fallback fetch failed');
    } else {
      throw e;
    }
  }

  const blob = await res.blob();
  const mime = blob.type.toLowerCase();

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const width = img.naturalWidth || 800;
      const height = img.naturalHeight || 1200;

      // If WebP, AVIF, or any format pdf-lib natively hates, convert via Canvas to JPEG
      if (mime.includes('webp') || mime.includes('avif') || mime.includes('html') || mime.includes('text')) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(async (newBlob) => {
            if (newBlob) {
              resolve({ buffer: await newBlob.arrayBuffer(), format: 'JPEG', width, height });
            } else {
              resolve({ buffer: await blob.arrayBuffer(), format: 'JPEG', width, height });
            }
          }, 'image/jpeg', 0.92);
          return;
        }
      }

      // If natively supported (JPEG/PNG)
      blob.arrayBuffer().then(buffer => {
        resolve({ buffer, format: mime.includes('png') ? 'PNG' : 'JPEG', width, height });
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      blob.arrayBuffer().then(buffer => resolve({ buffer, format: 'JPEG', width: 800, height: 1200 })).catch(reject);
    };

    img.src = objUrl;
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ ]/g, '_').trim().replace(/\s+/g, '_');
}

/**
 * Mode 1: PDF Generation using pdf-lib (Vector binary stream embedding)
 * Converts webp images to JPG/PNG via canvas so pdf-lib embeds natively without error.
 */
export async function exportWithPdfLib(tracker: Tracker, customImages?: string[], customTitle?: string): Promise<void> {
  const imagesToExport = customImages && customImages.length > 0 ? customImages : tracker.images;
  if (!imagesToExport || imagesToExport.length === 0) {
    throw new Error('No images to export');
  }

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();

  for (const imgUrl of imagesToExport) {
    try {
      const { buffer, format, width, height } = await getImageBufferForPdf(imgUrl);

      let image;
      try {
        if (format === 'PNG') {
          image = await pdfDoc.embedPng(buffer);
        } else {
          image = await pdfDoc.embedJpg(buffer);
        }
      } catch {
        try {
          image = await pdfDoc.embedJpg(buffer);
        } catch {
          try {
            image = await pdfDoc.embedPng(buffer);
          } catch {
            continue;
          }
        }
      }

      if (image) {
        const w = image.width || width;
        const h = image.height || height;
        const page = pdfDoc.addPage([w, h]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: w,
          height: h,
        });
      }
    } catch (e) {
      console.error('pdf-lib failed for image:', imgUrl, e);
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  
  const baseName = customTitle || tracker.title || `comic-${tracker.id.substring(0, 6)}`;
  a.download = `${sanitizeFilename(baseName)}.pdf`;
  a.click();
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Mode 2: PDF Generation using img2pdf (Direct Image-to-PDF packaging)
 */
export async function exportWithImg2Pdf(tracker: Tracker, customImages?: string[], customTitle?: string): Promise<void> {
  const imagesToExport = customImages && customImages.length > 0 ? customImages : tracker.images;
  if (!imagesToExport || imagesToExport.length === 0) {
    throw new Error('No images to export');
  }

  const { default: jsPDF } = await import('jspdf');
  let doc: InstanceType<typeof jsPDF> | null = null;

  for (let i = 0; i < imagesToExport.length; i++) {
    const imgUrl = imagesToExport[i];
    try {
      const { buffer, width, height, format } = await getImageBufferForPdf(imgUrl);
      const orientation = width > height ? 'landscape' : 'portrait';

      if (!doc) {
        doc = new jsPDF({
          orientation,
          unit: 'px',
          format: [width, height],
          hotfixes: ['px_scaling'],
        });
      } else {
        doc.addPage([width, height], orientation);
      }

      const imgData = new Uint8Array(buffer);
      doc.addImage(imgData, format, 0, 0, width, height, undefined, 'FAST');
    } catch (err) {
      console.error('img2pdf failed for image index ' + i, imgUrl, err);
    }
  }

  if (doc) {
    const baseName = customTitle || tracker.title || `comic-${tracker.id.substring(0, 6)}`;
    doc.save(`${sanitizeFilename(baseName)}_img2pdf.pdf`);
  }
}
