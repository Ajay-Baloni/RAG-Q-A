import type { Request, Response } from 'express';
import { z } from 'zod';
import * as conversationsService from './conversations.service';

const createSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1, 'Select at least one document'),
  title: z.string().max(200).optional(),
});

export async function create(req: Request, res: Response) {
  const { documentIds, title } = createSchema.parse(req.body);
  const conversation = await conversationsService.createConversation(
    req.user!.id,
    documentIds,
    title
  );
  res.status(201).json({ conversation });
}

export async function list(req: Request, res: Response) {
  const conversations = await conversationsService.listConversations(req.user!.id);
  res.json({ conversations });
}

export async function getOne(req: Request, res: Response) {
  const conversation = await conversationsService.getConversation(
    req.user!.id,
    req.params.id!
  );
  res.json({ conversation });
}

export async function remove(req: Request, res: Response) {
  await conversationsService.deleteConversation(req.user!.id, req.params.id!);
  res.status(204).send();
}
