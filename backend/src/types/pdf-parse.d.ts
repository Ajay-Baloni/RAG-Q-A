// The deep import path used in extraction/pdf.ts (to bypass pdf-parse's index
// debug code) isn't covered by @types/pdf-parse, which only types the package root.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
    text: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
