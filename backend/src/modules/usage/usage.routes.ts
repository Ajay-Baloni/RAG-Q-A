import { Router } from 'express';
import * as usageController from './usage.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';

export const usageRouter = Router();

usageRouter.use(requireAuth);
usageRouter.get('/', asyncHandler(usageController.getUsage));
