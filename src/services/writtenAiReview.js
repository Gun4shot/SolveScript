import { pdfjs } from 'react-pdf';

const MAX_PREPARED_BYTES = 6 * 1024 * 1024;

function canvasJpegBase64(canvas) {
  return canvas.toDataURL('image/jpeg', 0.86).split(',')[1];
}

/**
 * Flattens the original question pages and the student's Fabric annotations into
 * JPEGs. This runs only after explicit consent, and the generated images live
 * only in browser memory until the review request is complete.
 */
export async function prepareAnnotatedPaperImages({ questionUrl, pageAnnotations, onProgress }) {
  const loadingTask = pdfjs.getDocument(questionUrl);
  const documentPdf = await loadingTask.promise;
  const pages = [];
  let totalBytes = 0;
  const annotatedPageNumbers = Array.from({ length: documentPdf.numPages }, (_, index) => index + 1)
    .filter((pageNumber) => Array.isArray(pageAnnotations[pageNumber]?.objects) && pageAnnotations[pageNumber].objects.length > 0);
  if (!annotatedPageNumbers.length) throw new Error('Add at least one annotation before asking for AI review.');

  try {
    for (let index = 0; index < annotatedPageNumbers.length; index += 1) {
      const pageNumber = annotatedPageNumbers[index];
      onProgress?.({ completed: index, total: annotatedPageNumbers.length });
      const pdfPage = await documentPdf.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale: 1 });
      const pageCanvas = window.document.createElement('canvas');
      pageCanvas.width = Math.ceil(viewport.width);
      pageCanvas.height = Math.ceil(viewport.height);
      const context = pageCanvas.getContext('2d', { alpha: false });
      await pdfPage.render({ canvasContext: context, viewport }).promise;

      const annotation = pageAnnotations[pageNumber];
      if (annotation) {
        const annotationCanvas = window.document.createElement('canvas');
        const fabric = await import('fabric');
        const overlay = new fabric.StaticCanvas(annotationCanvas, {
          width: pageCanvas.width,
          height: pageCanvas.height,
          enableRetinaScaling: false,
          backgroundColor: 'transparent',
        });
        await overlay.loadFromJSON(annotation);
        overlay.renderAll();
        context.drawImage(overlay.lowerCanvasEl, 0, 0, pageCanvas.width, pageCanvas.height);
        overlay.dispose();
      }

      const jpegBase64 = canvasJpegBase64(pageCanvas);
      totalBytes += Math.ceil((jpegBase64.length * 3) / 4);
      if (totalBytes > MAX_PREPARED_BYTES) {
        throw new Error('This paper is too detailed to prepare within the free-review upload limit. Try a shorter paper or self-mark with the scheme.');
      }
      pages.push({ pageNumber, jpegBase64 });
      onProgress?.({ completed: index + 1, total: annotatedPageNumbers.length });
    }
    return pages;
  } finally {
    documentPdf.destroy();
  }
}
