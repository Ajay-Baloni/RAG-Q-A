import * as cheerio from 'cheerio';
import { AppError } from '../../utils/AppError';

export interface ExtractedUrl {
  title: string;
  text: string;
}

/** Fetch a web page and extract its readable text content with cheerio. */
export async function extractUrlText(url: string): Promise<ExtractedUrl> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Document-QA/1.0)' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw AppError.badRequest('Could not fetch the URL');
  }

  if (!res.ok) throw AppError.badRequest(`URL returned status ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Drop non-content elements.
  $('script, style, noscript, nav, footer, header, iframe, svg').remove();

  const title = $('title').first().text().trim() || new URL(url).hostname;
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  if (!text) throw AppError.badRequest('No extractable text found at the URL');

  return { title, text };
}
