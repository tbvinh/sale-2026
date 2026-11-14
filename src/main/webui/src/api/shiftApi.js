import { http } from '../core/http.js';

const toQS = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
  const qs = p.toString();
  return qs ? `?${qs}` : '';
};

export const shiftApi = {
  getCurrent: (warehouseId) => http.get('/shifts/current' + toQS({ warehouseId })),
  open: (payload) => http.post('/shifts/open', payload),
  close: (id, payload) => http.post(`/shifts/${id}/close`, payload),
  list: (params) => http.get('/shifts' + toQS(params)),
  get: (id) => http.get(`/shifts/${id}`),
};

export default shiftApi;

