import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadedPdf {
  url: string;
  publicId: string;
}

/** Upload a PDF buffer to Cloudinary as a raw asset. */
export function uploadPdf(buffer: Buffer, filename: string): Promise<UploadedPdf> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'ai-document-qa',
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        format: 'pdf',
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/** Delete a previously uploaded raw PDF asset. */
export async function deletePdf(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
}
