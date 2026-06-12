import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { conversationsRouter } from './modules/conversations/conversations.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/conversations', conversationsRouter);
