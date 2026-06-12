import { Router } from 'express';
import * as conversationsController from './conversations.controller';
import * as chatController from '../chat/chat.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

conversationsRouter.post('/', asyncHandler(conversationsController.create));
conversationsRouter.get('/', asyncHandler(conversationsController.list));
conversationsRouter.get('/:id', asyncHandler(conversationsController.getOne));
conversationsRouter.delete('/:id', asyncHandler(conversationsController.remove));

// Ask a question within a conversation (Phase 1: non-streaming JSON answer).
conversationsRouter.post('/:id/messages', asyncHandler(chatController.ask));
