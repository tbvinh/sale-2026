import { http } from '../core/http.js';

const toQS = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
  const qs = p.toString();
  return qs ? `?${qs}` : '';
};

export const auditApi = {
  list: (params) => http.get('/admin/audit-logs' + toQS(params)),
};

export default auditApi;

