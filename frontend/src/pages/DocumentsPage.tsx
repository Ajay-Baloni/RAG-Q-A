import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadForm } from '../components/documents/UploadForm';
import { DocumentList } from '../components/documents/DocumentList';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { deleteDocument, listDocuments } from '../api/documents';
import type { Document } from '../types';

export function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const { documents: docs } = await listDocuments();
    setDocuments(docs);
    setLoading(false);
    return docs;
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  // Poll while any document is still processing.
  useEffect(() => {
    const anyProcessing = documents.some((d) => d.status === 'PROCESSING');
    if (anyProcessing && !pollRef.current) {
      pollRef.current = setInterval(() => refresh().catch(() => undefined), 3000);
    } else if (!anyProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current && !anyProcessing) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [documents, refresh]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeleting(true);
    try {
      await deleteDocument(id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await refresh();
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  // Don't create a conversation yet — go to a draft and persist on first message.
  function startChat() {
    if (selected.size === 0) return;
    navigate('/chat/new', { state: { documentIds: Array.from(selected) } });
  }

  const readyCount = documents.filter((d) => d.status === 'READY').length;

  return (
    <div className="grid h-full gap-7 md:grid-cols-[minmax(280px,1fr)_2fr]">
      <section className="animate-fade-up space-y-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Library</h1>
          <p className="text-sm text-muted">Add sources, then chat with them.</p>
        </div>
        <UploadForm onUploaded={refresh} />
      </section>

      <section className="flex h-full flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {selected.size > 0 ? (
              <span className="font-medium text-ink">{selected.size} selected</span>
            ) : (
              `${readyCount} ready · select to chat`
            )}
          </p>
          <Button onClick={startChat} disabled={selected.size === 0}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Start chat
          </Button>
        </div>

        <div className="scroll-slim flex-1 overflow-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-7 w-7" />
            </div>
          ) : (
            <DocumentList
              documents={documents}
              selected={selected}
              onToggle={toggle}
              onDelete={(id) => setPendingDelete(documents.find((d) => d.id === id) ?? null)}
            />
          )}
        </div>
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete document"
        message={`"${pendingDelete?.title ?? ''}" and its embedded chunks will be permanently removed${
          pendingDelete?.sourceType === 'PDF' ? ', including the stored PDF' : ''
        }.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </div>
  );
}
