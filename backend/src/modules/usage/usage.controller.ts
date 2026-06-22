import type { Request, Response } from 'express';
import * as usageService from './usage.service';

export async function getUsage(req: Request, res: Response) {
  const usage = await usageService.getUsage(req.user!.id);
  res.json({ usage });
}
