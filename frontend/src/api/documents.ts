import { apiFetch } from '../lib/apiClient';
import type { Document } from '../types';

export function listDocuments() {
  return apiFetch<{ documents: Document[] }>('/api/documents');
}

export function getDocument(id: string) {
  return apiFetch<{ document: Document & { _count: { chunks: number } } }>(
    `/api/documents/${id}`
  );
}

export function uploadPdf(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<{ id: string; status: string }>('/api/documents', {
    method: 'POST',
    body: form,
    form: true,
  });
}

export function uploadUrl(url: string) {
  return apiFetch<{ id: string; status: string }>('/api/documents', {
    method: 'POST',
    body: { url },
  });
}

export function deleteDocument(id: string) {
  return apiFetch<void>(`/api/documents/${id}`, { method: 'DELETE' });
}
