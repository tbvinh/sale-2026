import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, setUnauthorizedHandler } from './api.js';
import { configureHttp } from './http.js';
import { resetAllStores } from './masterdata.js';
import { setPermissions, clearPermissions } from './permissions.js';
import { clearTenant, getCompanyId, setActiveCompany } from './tenant.js';

// Đổi đường dẫn cho khớp với @Path của resource phía Java.
// Token nằm trong cookie HttpOnly do server set, JS không đọc/ghi được => KHÔNG lưu token ở localStorage nữa.
const AUTH = {
  login: '/api/auth/loginv1',
  me: '/api/auth/me',          // CẦN THÊM ở backend: trả {username, name, role} của người đang đăng nhập (đọc từ cookie)
  logout: '/api/auth/logout',  // CẦN THÊM ở backend: xóa cookie (set maxAge=0)
};

const KEY = 'user';   // chỉ cache thông tin hiển thị (tên, role) để render nhanh; không phải bí mật

// TẠM THỜI: chỉ dùng khi backend chưa có /me (loginv1 hiện không trả role). Xóa khi đã có /me.
// Lưu ý: role phía client chỉ để ẩn/hiện menu; quyền thật phải do server kiểm tra.
const TEMP_ROLES = { admin: 'admin' };
const isMissing = (e) => e?.status === 404 || e?.status === 405;

const readCached = () => {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
};
// Chuyển dữ liệu từ server sang dạng user của app; quyền chi tiết đi kèm /me
const toInfo = (d) => ({
  username: d.username,
  name: d.name ?? d.username,
  imageUrl: d.imageUrl ?? null,
  role: d.role ?? 'user',
  roleCode: d.roleCode ?? d.role ?? 'user',
  roleName: d.roleName ?? null,
  hasPin: !!d.hasPin,
  allowPublic: d.allowPublic !== undefined ? !!d.allowPublic : (d.role === 'admin'),
  defaultCompanyId: d.defaultCompanyId ?? null,
  allowedCompanyIds: Array.isArray(d.allowedCompanyIds) ? d.allowedCompanyIds : [],
  ownerCompanyIds: Array.isArray(d.ownerCompanyIds) ? d.ownerCompanyIds : [],
  companies: Array.isArray(d.companies) ? d.companies : [],
  permissions: d.permissions,
});

const Ctx = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(readCached);

  const persist = (info) => {
    setPermissions(info.permissions ?? {});
    const curCo = getCompanyId();
    const allowed = (info.allowedCompanyIds ?? []).map(String);
    if (info.role !== 'admin') {
      if (curCo && allowed.length > 0 && !allowed.includes(String(curCo))) {
        setActiveCompany(info.defaultCompanyId ?? allowed[0] ?? '');
      } else if (!curCo && (!info.allowPublic || info.defaultCompanyId != null)) {
        const target = info.defaultCompanyId ?? allowed[0] ?? '';
        if (target !== '') setActiveCompany(target);
      }
    }
    localStorage.setItem(KEY, JSON.stringify(info));
    setUser(info);
  };

  // Xóa phiên phía client + xóa phần `#...` sau URL
  const clearSession = () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem('pos_locked');
    clearPermissions();
    clearTenant();
    setUser(null);
    resetAllStores();   // xoá cache danh mục + phiếu kho (FE-ST6): không để lộ dữ liệu của người dùng trước
    history.replaceState(null, '', window.location.pathname);
  };

  // Mọi request bị 401 (cookie hết hạn/không hợp lệ) => tự về màn hình đăng nhập.
  // Gồm cả các request đi qua http.js (store danh mục / API kho) — trước đây chúng "chết im lặng" (FE-AP12).
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    configureHttp({ onUnauthorized: clearSession });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Mở lại trang khi đang có user cache: hỏi server xem cookie còn hiệu lực không.
  // 401 => đăng xuất; 404 (chưa có /me) hoặc lỗi mạng => giữ nguyên, request tiếp theo sẽ tự phát hiện.
  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    apiFetch(AUTH.me, { silent401: true })
      .then((d) => { if (alive) persist(toInfo(d)); })
      .catch((e) => { if (alive && e?.status === 401) clearSession(); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username, password) => {
    // 1. Server kiểm tra tài khoản và set cookie HttpOnly `token` (body chỉ có message)
    //    Giả định AuthRequest có field username/password — đổi lại nếu khác.
    await apiFetch(AUTH.login, { method: 'POST', body: { username, password }, silent401: true });

    // 2. Lấy thông tin user (cookie được trình duyệt tự gửi kèm)
    let info;
    try {
      info = toInfo(await apiFetch(AUTH.me, { silent401: true }));
    } catch (e) {
      if (!isMissing(e)) throw e;   // 401 ở đây thường nghĩa là cookie không được lưu (xem mục CORS/Secure)
      info = { username, name: username, role: TEMP_ROLES[username] ?? 'user', permissions: {} };   // TẠM THỜI, xem ghi chú trên
    }
    persist(info);
  };

  const logout = async () => {
    // HttpOnly cookie chỉ server mới xóa được; lỗi mạng/404 vẫn đăng xuất phía client
    try { await apiFetch(AUTH.logout, { method: 'POST', silent401: true }); } catch { /* bỏ qua */ }
    clearSession();
  };

  const updateProfile = async (body) => {
    const res = await apiFetch('/api/auth/profile', { method: 'PUT', body });
    const info = toInfo(res);
    persist(info);
    return info;
  };

  const verifyPin = async (pin) => {
    return await apiFetch('/api/auth/verify-pin', { method: 'POST', body: { pin } });
  };

  const verifyPassword = async (password) => {
    return await apiFetch('/api/auth/verify-password', { method: 'POST', body: { password } });
  };

  return <Ctx.Provider value={{ user, login, logout, updateProfile, verifyPin, verifyPassword }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);