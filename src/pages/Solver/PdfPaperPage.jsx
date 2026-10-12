import { Document, Page, pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfPaperPage({ file, pageNumber, onLoadSuccess, onRenderSuccess }) {
  return (
    <Document
      file={file}
      onLoadSuccess={onLoadSuccess}
      loading={<div className="pdf-loading"><div className="spinner" /></div>}
    >
      <Page
        pageNumber={pageNumber}
        scale={1}
        renderAnnotationLayer={false}
        renderTextLayer={false}
        onRenderSuccess={onRenderSuccess}
      />
    </Document>
  );
}
