// Import the implementation directly to avoid pdf-parse's index.js debug code,
// which tries to read a bundled test file when required as the main module.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { AppError } from '../../utils/AppError';

export interface ExtractedPdf {
  text: string;
  pageCount: number;
}

/** Extract plain text from a PDF buffer. */
export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  try {
    const data = await pdfParse(buffer);
    const text = data.text.trim();
    if (!text) throw AppError.badRequest('No extractable text found in the PDF');
    return { text, pageCount: data.numpages };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.badRequest('Failed to parse the PDF file');
  }
}
