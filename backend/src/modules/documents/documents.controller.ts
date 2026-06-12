import type { Request, Response } from 'express';
import { z } from 'zod';
import * as documentsService from './documents.service';
import { AppError } from '../../utils/AppError';

const urlSchema = z.object({ url: z.string().url('A valid URL is required') });

/** POST /api/documents — accepts a multipart PDF (field "file") OR a JSON { url }. */
export async function create(req: Request, res: Response) {
  const userId = req.user!.id;

  if (req.file) {
    const result = await documentsService.createPdfDocument(userId, req.file);
    return res.status(202).json(result);
  }

  if (req.body && typeof req.body.url === 'string') {
    const { url } = urlSchema.parse(req.body);
    const result = await documentsService.createUrlDocument(userId, url);
    return res.status(202).json(result);
  }

  throw AppError.badRequest('Provide a PDF file (field "file") or a JSON body with a "url"');
}

export async function list(req: Request, res: Response) {
  const documents = await documentsService.listDocuments(req.user!.id);
  res.json({ documents });
}

export async function getOne(req: Request, res: Response) {
  const doc = await documentsService.getDocument(req.user!.id, req.params.id!);
  res.json({ document: doc });
}

export async function remove(req: Request, res: Response) {
  await documentsService.deleteDocument(req.user!.id, req.params.id!);
  res.status(204).send();
}
