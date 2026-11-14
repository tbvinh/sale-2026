import { useState, useEffect } from 'react';
import { auditApi } from '../../api/auditApi.js';
import { formatDateTime } from '../../core/dateFormat.js';
import { Loading } from '../../core/ui.jsx';
import { useI18n } from '../../core/i18n.jsx';

const MODULE_MAP = {
  minibar: { labelKey: 'minibar.title', label: 'Minibar / Bàn ăn', icon: '🍹', bg: '#eff6ff', color: '#1e40af' },
  shifts: { labelKey: 'minibar.shifts', label: 'Bàn giao ca', icon: '⏱️', bg: '#fdf2f8', color: '#9d174d' },
  cash: { labelKey: 'cash.title', label: 'Quỹ tiền mặt', icon: '💵', bg: '#ecfdf5', color: '#065f46' },
  inventory: { labelKey: 'inv.title', label: 'Kho hàng', icon: '📦', bg: '#fefce8', color: '#854d0e' },
  catalog: { labelKey: 'cat.title', label: 'Danh mục', icon: '📋', bg: '#f3e8ff', color: '#6b21a8' },
  admin: { labelKey: 'admin.title', label: 'Quản trị hệ thống', icon: '🛡️', bg: '#f1f5f9', color: '#334155' },
};

const ACTION_MAP = {
  CREATE: { labelKey: 'admin.create', label: 'Tạo mới', color: '#16a34a', bg: '#dcfce7' },
  UPDATE: { labelKey: 'admin.update', label: 'Cập nhật', color: '#0284c7', bg: '#e0f2fe' },
  DELETE: { labelKey: 'admin.delete', label: 'Xóa', color: '#dc2626', bg: '#fee2e2' },
  CANCEL: { label: 'Hủy phiếu', color: '#ea580c', bg: '#ffedd5' },
  OPEN_SHIFT: { label: 'Mở ca', color: '#16a34a', bg: '#dcfce7' },
  CLOSE_SHIFT: { label: 'Kết thúc ca', color: '#7c3aed', bg: '#ede9fe' },
  UPDATE_PERMISSIONS: { label: 'Đổi quyền', color: '#d97706', bg: '#fef3c7' },
  CREATE_USER: { label: 'Tạo user', color: '#16a34a', bg: '#dcfce7' },
  UPDATE_USER: { label: 'Sửa user', color: '#0284c7', bg: '#e0f2fe' },
  DELETE_USER: { label: 'Xóa user', color: '#dc2626', bg: '#fee2e2' },
};

export function AuditLogView({ can }) {
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [q, setQ] = useState('');
  const [module, setModule] = useState('');
  const [username, setUsername] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const fetchLogs = async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.list({
        q: q.trim(),
        module: module || undefined,
        username: username.trim() || undefined,
        page: p,
        pageSize,
      });
      setLogs(res?.items || []);
      setTotal(res?.total || 0);
      setPage(res?.page || p);
    } catch (err) {
      setError(err?.message || (t('admin.loadFailed') || 'Không thể tải nhật ký hoạt động.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [module, pageSize]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div style={{ padding: '4px 0 24px 0' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📜</span> {t('admin.auditTitle') || 'Nhật ký hoạt động & Kiểm toán (Audit Trail)'}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            {t('admin.auditDesc') || 'Theo dõi chi tiết mọi thay đổi, ai đã tạo phiếu, kết ca, phân quyền hoặc xóa dữ liệu.'}
          </p>
        </div>
        <button
          type="button"
          className="tb"
          onClick={() => fetchLogs(page)}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: '600' }}
        >
          🔄 {loading ? (t('common.loading') || 'Đang tải…') : (t('common.refresh') || 'Làm mới')}
        </button>
      </div>

      {/* Filter bar */}
      <form onSubmit={handleSearch} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>{t('admin.auditKeyword') || 'Từ khóa'}:</label>
          <input
            type="text"
            className="inp"
            style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }}
            placeholder={t('admin.auditSearch') || 'Tìm theo nội dung, mã chứng từ, ca…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div style={{ width: '180px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>{t('admin.auditModule') || 'Phân hệ'}:</label>
          <select
            className="inp"
            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
            value={module}
            onChange={(e) => { setModule(e.target.value); }}
          >
            <option value="">{t('admin.auditAllModules') || 'Tất cả phân hệ'}</option>
            <option value="minibar">🍹 {t('minibar.title') || 'Minibar / Bàn ăn'}</option>
            <option value="shifts">⏱️ {t('minibar.shifts') || 'Bàn giao ca'}</option>
            <option value="cash">💵 {t('cash.title') || 'Quỹ tiền mặt'}</option>
            <option value="inventory">📦 {t('inv.title') || 'Kho hàng'}</option>
            <option value="admin">🛡️ {t('admin.title') || 'Quản trị hệ thống'}</option>
          </select>
        </div>

        <div style={{ width: '180px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>{t('admin.auditUser') || 'User'}:</label>
          <input
            type="text"
            className="inp"
            style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
            placeholder={t('admin.username') || 'Tên đăng nhập…'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn"
          style={{ padding: '6px 16px', fontSize: '13px', fontWeight: '600' }}
        >
          🔍 {t('common.search') || 'Tìm kiếm'}
        </button>
      </form>

      {/* Error alert */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '13px', marginBottom: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Logs Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 14px', width: '50px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>#</th>
                <th style={{ padding: '10px 14px', width: '160px', color: '#64748b', fontWeight: '600' }}>{t('admin.auditTime') || 'Thời gian'}</th>
                <th style={{ padding: '10px 14px', width: '140px', color: '#64748b', fontWeight: '600' }}>{t('admin.auditUser') || 'Người thực hiện'}</th>
                <th style={{ padding: '10px 14px', width: '160px', color: '#64748b', fontWeight: '600' }}>{t('admin.auditModule') || 'Phân hệ'}</th>
                <th style={{ padding: '10px 14px', width: '130px', color: '#64748b', fontWeight: '600' }}>{t('admin.auditAction') || 'Hành động'}</th>
                <th style={{ padding: '10px 14px', width: '150px', color: '#64748b', fontWeight: '600' }}>Mã đối tượng</th>
                <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: '600' }}>{t('admin.auditDetailDesc') || 'Nội dung chi tiết'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center' }}>
                    <Loading />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                    {t('admin.auditEmpty') || 'Không tìm thấy nhật ký hoạt động nào phù hợp.'}
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => {
                  const modMeta = MODULE_MAP[log.module] || { label: log.module || 'Hệ thống', icon: '🔹', bg: '#f1f5f9', color: '#475569' };
                  const actMeta = ACTION_MAP[log.action] || { label: log.action || 'THAO TÁC', color: '#475569', bg: '#f1f5f9' };
                  const modLabel = modMeta.labelKey ? t(modMeta.labelKey) : modMeta.label;
                  const actLabel = actMeta.labelKey ? t(actMeta.labelKey) : actMeta.label;

                  return (
                    <tr key={log.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#334155' }}>
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: '600', color: '#0f172a' }}>
                        👤 {log.username || 'system'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: modMeta.bg,
                          color: modMeta.color,
                        }}>
                          <span>{modMeta.icon}</span>
                          <span>{modLabel}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          background: actMeta.bg,
                          color: actMeta.color,
                        }}>
                          {actLabel}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                        {log.targetId ? `${log.targetType || ''}#${log.targetId}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#1e293b' }}>
                        <div>{log.description}</div>
                        {log.details && (
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                            {log.details.length > 90 ? `${log.details.slice(0, 90)}…` : log.details}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
              {t('common.total') || 'Tổng số'}: <b>{total}</b>
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                className="tb"
                disabled={page <= 1}
                onClick={() => fetchLogs(page - 1)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                ◀ {t('nav.back') || 'Trước'}
              </button>
              <span style={{ fontSize: '12.5px', color: '#475569', padding: '0 6px' }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="tb"
                disabled={page >= totalPages}
                onClick={() => fetchLogs(page + 1)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                {t('nav.forward') || 'Sau'} ▶
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLogView;

