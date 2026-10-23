const BASE = import.meta.env.VITE_API_BASE || 'https://medi-track-app-m33h.vercel.app/api/v1';

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthError() {
    return this.status === 401;
  }

  get isValidationError() {
    return this.status === 422 || this.code === 'VALIDATION_ERROR';
  }
}

let onUnauthorized = null;
/** Register a callback invoked when the API reports an expired session. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function parse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  const text = await response.text();
  return text ? { data: text } : null;
}

async function request(path, { method = 'GET', body, headers = {}, raw = false, signal } = {}) {
  const options = { method, credentials: 'include', headers: { ...headers }, signal };

  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE}${path}`, options);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the MediTrack API. Is the server running?', { status: 0 });
  }

  if (raw) {
    if (!response.ok) {
      const payload = await parse(response);
      throw new ApiError(payload?.error?.message || `Request failed (${response.status})`, {
        status: response.status,
      });
    }
    return response;
  }

  const payload = await parse(response);

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized && !path.startsWith('/auth/')) {
      onUnauthorized();
    }
    throw new ApiError(payload?.error?.message || `Request failed (${response.status})`, {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    });
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  raw: (path, options) => request(path, { ...options, raw: true }),

  /** Unwraps the `{ data }` envelope. */
  async data(path, options) {
    const payload = await request(path, options);
    return payload?.data;
  },

  upload(path, formData, options) {
    return request(path, { ...options, method: 'POST', body: formData });
  },
};

/** Build a query string, skipping empty values. */
export function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

/** Trigger a browser download for an authenticated text endpoint (CSV). */
export async function downloadFile(path, filename) {
  const response = await api.raw(path);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default api;
