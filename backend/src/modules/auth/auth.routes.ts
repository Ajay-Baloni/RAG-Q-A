import { Router } from 'express';
import * as authController from './auth.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(authController.register));
authRouter.post('/login', asyncHandler(authController.login));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));

authRouter.post('/forgot-password', asyncHandler(authController.forgotPassword));
authRouter.post('/reset-password', asyncHandler(authController.resetPassword));
authRouter.post('/change-password', requireAuth, asyncHandler(authController.changePassword));
