import { useSyncExternalStore } from 'react';

// Ma trận quyền chi tiết áp dụng cho vai trò người dùng.
// Nguồn dữ liệu thật là DB (bảng permissions + role_permissions) và được tải qua /api/auth/me.
// Vai trò admin luôn full quyền, Shell.can() short-circuit trước khi đọc bảng này.
export const PLUGIN_IDS = ['inventory', 'catalog', 'opening', 'cash', 'bank', 'general', 'reports', 'minibar', 'shifts', 'tables'];
export const ACTIONS = ['read', 'create', 'update', 'delete', 'import', 'export'];

const KEY = 'perms_user';

const normalize = (source) => {
  const out = {};
  PLUGIN_IDS.forEach((id) => {
    out[id] = {};
    ACTIONS.forEach((action) => { out[id][action] = !!source?.[id]?.[action]; });
  });
  return out;
};

function load() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { return normalize({}); }
}

let perms = load();
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());

export function setPermissions(source) {
  perms = normalize(source);
  localStorage.setItem(KEY, JSON.stringify(perms));
  emit();
}

export function clearPermissions() {
  perms = normalize({});
  localStorage.removeItem(KEY);
  emit();
}

export const usePermissions = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => perms);
