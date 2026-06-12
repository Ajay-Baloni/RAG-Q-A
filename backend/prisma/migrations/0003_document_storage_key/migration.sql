-- Store the Cloudinary public_id so PDF assets can be deleted along with the document.
ALTER TABLE "Document" ADD COLUMN "storageKey" TEXT;
