import { ApiErrorResponse } from '@voice-ai/shared';

export class ApiError extends Error {
  statusCode: number;
  error: string;
  messages: string[];
  requestId?: string;

  constructor(data: ApiErrorResponse) {
    const msg = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message || 'An error occurred';
    super(msg);
    this.name = 'ApiError';
    this.statusCode = data.statusCode;
    this.error = data.error;
    this.messages = Array.isArray(data.message) ? data.message : [msg];
    this.requestId = data.requestId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        window.location.href = '/login?expired=1';
      }
    }
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorResponse: ApiErrorResponse = data || {
      statusCode: res.status,
      error: res.statusText || 'Error',
      message: [res.statusText || 'Request failed'],
      requestId: res.headers.get('x-request-id') || '',
    };
    throw new ApiError(errorResponse);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'DELETE' }),
};
