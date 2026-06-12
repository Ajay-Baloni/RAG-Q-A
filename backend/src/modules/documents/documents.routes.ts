import { Router } from 'express';
import multer from 'multer';
import * as documentsController from './documents.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { MAX_PDF_BYTES } from '../../config/constants';
import { AppError } from '../../utils/AppError';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(AppError.badRequest('Only PDF files are supported'));
  },
});

export const documentsRouter = Router();

documentsRouter.use(requireAuth);

documentsRouter.post('/', upload.single('file'), asyncHandler(documentsController.create));
documentsRouter.get('/', asyncHandler(documentsController.list));
documentsRouter.get('/:id', asyncHandler(documentsController.getOne));
documentsRouter.delete('/:id', asyncHandler(documentsController.remove));
