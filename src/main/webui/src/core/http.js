// HTTP client mỏng bọc fetch: gắn token, parse JSON, ném HttpError thống nhất.
// Vite: đặt VITE_API_URL trong .env (mặc định '/api'). CRA: đổi thành process.env.REACT_APP_API_URL.
import { tenantHeaders } from './tenant.js';

const BASE = import.meta.env?.VITE_API_URL ?? '/api';

export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;     // 0 = lỗi mạng, 401 = chưa đăng nhập, 409/422 = dữ liệu không hợp lệ...
    this.details = details;   // body lỗi từ server (ví dụ lỗi theo từng field)
  }
}

// Nơi lấy token và xử lý khi hết phiên: chỉnh cho khớp cách đăng nhập của app.
let getToken = () => localStorage.getItem('token');
let onUnauthorized = () => {};
export const configureHttp = (opts) => {
  if (opts.getToken) getToken = opts.getToken;
  if (opts.onUnauthorized) onUnauthorized = opts.onUnauthorized;   // ví dụ: () => { logout(); navigate('/login'); }
};

async function request(method, path, { body, signal } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...tenantHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new HttpError(0, 'Không kết nối được máy chủ');
  }

  if (res.status === 401) onUnauthorized();
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(res.status, data?.message ?? data?.error ?? res.statusText, data);
  return data;
}

export const http = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};

// Tải file nhị phân (Excel/CSV) bằng cookie phiên rồi lưu về máy.
export async function downloadFile(path, filename) {
  let res;
  try {
    res = await fetch(BASE + path, { credentials: 'include', headers: tenantHeaders() });
  } catch (e) {
    throw new HttpError(0, 'Không kết nối được máy chủ');
  }

  if (res.status === 401) onUnauthorized();
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new HttpError(res.status, data?.message ?? data?.error ?? res.statusText, data);
  }

  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Gửi file multipart/form-data lên máy chủ
export async function uploadFile(path, formData) {
  const token = getToken();
  let res;
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...tenantHeaders(),
      },
      body: formData,
    });
  } catch (e) {
    throw new HttpError(0, 'Không kết nối được máy chủ');
  }

  if (res.status === 401) onUnauthorized();
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(res.status, data?.message ?? data?.error ?? res.statusText, data);
  return data;
}
