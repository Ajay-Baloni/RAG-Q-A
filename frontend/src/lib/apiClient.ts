import { API_URL, TOKEN_STORAGE_KEY } from './constants';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** When true, sends FormData (body must be FormData) without JSON headers. */
  form?: boolean;
}

/** Typed fetch wrapper that attaches the bearer token and unwraps JSON/errors. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form = false } = options;
  const headers: Record<string, string> = {};

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (form && body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Request failed');
  }
  return data as T;
}
