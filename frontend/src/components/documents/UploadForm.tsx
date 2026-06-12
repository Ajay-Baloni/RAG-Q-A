import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { uploadPdf, uploadUrl } from '../../api/documents';
import { ApiError } from '../../lib/apiClient';

type Mode = 'pdf' | 'url';

export function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [mode, setMode] = useState<Mode>('pdf');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }
    setError(null);
    setFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'pdf') {
        if (!file) throw new Error('Choose or drop a PDF file');
        await uploadPdf(file);
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
      } else {
        if (!url.trim()) throw new Error('Enter a URL');
        await uploadUrl(url.trim());
        setUrl('');
      }
      onUploaded();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Upload failed'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <div className="inline-flex rounded-lg bg-surface-2 p-0.5 text-sm">
        {(['pdf', 'url'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === m ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'
            }`}
          >
            {m === 'pdf' ? 'Upload PDF' : 'From URL'}
          </button>
        ))}
      </div>

      {mode === 'pdf' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging
              ? 'border-accent bg-accent-soft'
              : 'border-line bg-bg hover:border-accent/60 hover:bg-surface-2'
          }`}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
            <path d="M20 16.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5" />
          </svg>
          {file ? (
            <p className="text-sm font-medium text-ink">{file.name}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">
                Drag &amp; drop a PDF, or <span className="text-accent">browse</span>
              </p>
              <p className="font-mono text-xs text-muted">PDF · up to 10 MB</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>
      ) : (
        <Input
          id="doc-url"
          label="Page URL"
          type="url"
          placeholder="https://example.com/article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Button type="submit" loading={loading} className="w-full">
        Add document
      </Button>
    </form>
  );
}
