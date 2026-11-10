import { http } from '../core/http.js';

export const settingsApi = {
  getAll: () => http.get('/settings'),
  get: (key) => http.get(`/settings/${key}`),
  update: (key, value) => http.put(`/settings/${key}`, { value }),
};

export default settingsApi;
