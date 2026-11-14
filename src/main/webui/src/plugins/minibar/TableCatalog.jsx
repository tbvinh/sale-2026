import { useState, useMemo } from 'react';
import { diningTablesStore, vnd } from '../../core/masterdata.js';
import { useConfirm } from '../../core/confirm.jsx';

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const cleanDigits = (s) => String(s ?? '').replace(/\D/g, '');

const getStatusLabel = (status, t = (k) => k) => {
  switch (status) {
    case 'occupied':
      return { label: t('minibar.statusOccupied') || 'Đang có khách', color: '#ea580c', bg: '#ffedd5' };
    case 'reserved':
      return { label: t('minibar.statusReserved') || 'Đặt trước', color: '#ca8a04', bg: '#fef9c3' };
    default:
      return { label: t('minibar.statusEmpty') || 'Trống', color: '#16a34a', bg: '#dcfce7' };
  }
};

const DEFAULT_AREAS = [
  'Tầng 1 (Trong nhà)',
  'Sân vườn (Ngoài trời)',
  'Quầy Bar',
  'Khu VIP Lầu 1',
];

export function TableCatalog({ can, t = (k) => k, onOpenAreas }) {
  const confirm = useConfirm();
  const tablesState = diningTablesStore.use();
  const tables = tablesState.items || [];

  const canCreate = can?.('tables', 'create') ?? false;
  const canUpdate = can?.('tables', 'update') ?? false;
  const canDelete = can?.('tables', 'delete') ?? false;
  const isReadOnly = !canCreate && !canUpdate && !canDelete;

  const [q, setQ] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [editing, setEditing] = useState(null); // null or table object
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Extract unique areas
  const areas = useMemo(() => {
    const set = new Set(DEFAULT_AREAS);
    tables.forEach((t) => { if (t.area) set.add(t.area); });
    return Array.from(set);
  }, [tables]);

  const filteredTables = useMemo(() => {
    return tables.filter((item) => {
      if (selectedArea && item.area !== selectedArea) return false;
      if (selectedStatus && item.status !== selectedStatus) return false;
      if (q) {
        const query = fold(q.trim());
        const digits = cleanDigits(q);
        const code = fold(item.code);
        const name = fold(item.name);
        const area = fold(item.area);
        const note = fold(item.note);
        const resName = fold(item.reservedCustomerName);
        const resPhone = fold(item.reservedCustomerPhone);
        const phoneDigits = cleanDigits(item.reservedCustomerPhone);

        const matchText = code.includes(query) ||
          name.includes(query) ||
          area.includes(query) ||
          note.includes(query) ||
          resName.includes(query) ||
          resPhone.includes(query);

        const matchPhone = digits.length >= 3 && phoneDigits.includes(digits);

        return matchText || matchPhone;
      }
      return true;
    });
  }, [tables, selectedArea, selectedStatus, q]);

  const handleOpenAdd = () => {
    // Generate next code
    const prefix = 'BAN-';
    let max = 0;
    tables.forEach((t) => {
      const m = (t.code || '').match(/BAN-(\d+)/);
      if (m) {
        const v = parseInt(m[1], 10);
        if (v > max) max = v;
      }
    });
    const nextCode = `${prefix}${String(max + 1).padStart(2, '0')}`;

    setEditing({
      code: nextCode,
      name: `Bàn ${String(max + 1).padStart(2, '0')}`,
      area: selectedArea || (areas[0] || 'Tầng 1 (Trong nhà)'),
      capacity: 4,
      status: 'empty',
      active: true,
      note: '',
    });
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.name?.trim()) {
      setError('Tên bàn không được để trống.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing.id) {
        await diningTablesStore.update(editing.id, editing);
      } else {
        await diningTablesStore.add(editing);
      }
      setEditing(null);
    } catch (err) {
      setError(err?.message || 'Lỗi khi lưu thông tin bàn.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (table) => {
    if (table.status === 'occupied') {
      alert(t('minibar.statusOccupiedHint') || 'Bàn đang có khách, vui lòng thanh toán hoặc chuyển bàn trước khi xóa!');
      return;
    }
    const ok = await confirm((t('minibar.confirmDeleteTable') || 'Bạn có chắc chắn muốn xóa bàn này?') + ` (${table.name} - ${table.code})`);
    if (ok) {
      try {
        await diningTablesStore.remove(table.id);
      } catch (err) {
        alert(err?.message || (t('minibar.deleteTableFailed') || 'Không thể xóa bàn.'));
      }
    }
  };

  return (
    <div className="mb-catalog-wrap" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
            {t('minibar.manageTables') || 'Quản lý Danh mục Bàn'}
          </h2>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {t('minibar.manageTablesSub') || 'Thiết lập danh sách bàn, khu vực và sức chứa cho quán'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onOpenAreas && (
            <button
              type="button"
              className="tb"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13.5px', borderRadius: '6px', fontWeight: '600' }}
              onClick={onOpenAreas}
            >
              <span>🏢</span> {t('minibar.manageAreasBtn') || 'Quản lý & Đổi tên tầng'}
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              className="pb"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '14px', borderRadius: '6px', fontWeight: '600' }}
              onClick={handleOpenAdd}
            >
              <span>➕</span> {t('minibar.addTable') || 'Thêm bàn mới'}
            </button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px', color: '#64748b', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🛡️</span>
          <span>{t('minibar.readOnlyTableHint') || 'Bạn đang xem danh mục bàn ở chế độ Chỉ xem (Không có quyền Thêm/Sửa/Xóa). Liên hệ Quản trị viên nếu cần thay đổi danh mục bàn.'}</span>
        </div>
      )}

      {/* Filter toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
        <div className="searchbox" style={{ flex: '1 1 220px', maxWidth: '350px' }}>
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            value={q}
            placeholder={t('minibar.searchTablePlaceholder') || 'Tìm theo mã, tên bàn, người đặt, SĐT...'}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', height: '36px', padding: '0 28px', borderRadius: '6px' }}
          />
          {q && (
            <button type="button" className="xbtn" onClick={() => setQ('')}>✕</button>
          )}
        </div>

        <select
          value={selectedArea}
          onChange={(e) => setSelectedArea(e.target.value)}
          style={{ height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13.5px' }}
        >
          <option value="">{t('minibar.allAreas') || 'Tất cả khu vực'}</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13.5px' }}
        >
          <option value="">{t('minibar.allStatuses') || 'Tất cả trạng thái'}</option>
          <option value="empty">{t('minibar.statusEmpty') || 'Trống'}</option>
          <option value="occupied">{t('minibar.statusOccupied') || 'Đang có khách'}</option>
          <option value="reserved">{t('minibar.statusReserved') || 'Đặt trước'}</option>
        </select>

        {(q || selectedArea || selectedStatus) && (
          <button
            type="button"
            className="tb"
            style={{ height: '36px', padding: '0 12px', fontSize: '13px' }}
            onClick={() => { setQ(''); setSelectedArea(''); setSelectedStatus(''); }}
          >
            ✕ {t('minibar.clearFilter') || 'Xóa bộ lọc'}
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>
          {t('common.total') || 'Tổng'}: <b>{filteredTables.length}</b> {t('minibar.table') || 'bàn'}
        </div>
      </div>

      {/* Table grid */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
              <th style={{ padding: '12px 14px', width: '60px', textAlign: 'center' }}>#</th>
              <th style={{ padding: '12px 14px', width: '120px' }}>{t('minibar.tableCode') || 'Mã bàn'}</th>
              <th style={{ padding: '12px 14px' }}>{t('minibar.tableName') || 'Tên bàn'}</th>
              <th style={{ padding: '12px 14px' }}>{t('minibar.area') || 'Khu vực'}</th>
              <th style={{ padding: '12px 14px', width: '100px', textAlign: 'center' }}>{t('minibar.capacity') || 'Sức chứa'}</th>
              <th style={{ padding: '12px 14px', width: '140px', textAlign: 'center' }}>{t('common.status') || 'Trạng thái'}</th>
              <th style={{ padding: '12px 14px' }}>{t('common.note') || 'Ghi chú'}</th>
              <th style={{ padding: '12px 14px', width: '120px', textAlign: 'center' }}>{t('common.actions') || 'Thao tác'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTables.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                  {t('minibar.noTablesFound') || 'Không tìm thấy bàn nào phù hợp.'}
                </td>
              </tr>
            ) : (
              filteredTables.map((table, idx) => {
                const st = getStatusLabel(table.status, t);
                return (
                  <tr key={table.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0369a1', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                        {table.code}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1e293b' }}>
                      {table.name}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>
                      <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontSize: '12.5px' }}>
                        {table.area || 'Mặc định'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '600' }}>
                      🪑 {table.capacity || 4}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: st.color,
                          background: st.bg,
                        }}
                      >
                        {st.label}
                      </span>
                      {table.status === 'reserved' && (table.reservedCustomerName || table.reservedCustomerPhone) && (
                        <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '4px', fontWeight: '500' }}>
                          👤 {table.reservedCustomerName || 'Khách đặt'}
                          {table.reservedCustomerPhone && ` • 📞 ${table.reservedCustomerPhone}`}
                          {table.reservedTime && ` • ⏰ ${table.reservedTime}`}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '13px' }}>
                      {table.note || '-'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {canUpdate && (
                          <button
                            type="button"
                            className="tb"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            title={t('common.edit') || 'Sửa bàn'}
                            onClick={() => { setEditing({ ...table }); setError(null); }}
                          >
                            ✏️ {t('common.edit') || 'Sửa'}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="tb"
                            style={{ padding: '4px 8px', fontSize: '12px', color: '#dc2626' }}
                            title={t('common.delete') || 'Xóa bàn'}
                            onClick={() => handleDelete(table)}
                          >
                            🗑️ {t('common.delete') || 'Xóa'}
                          </button>
                        )}
                        {!canUpdate && !canDelete && (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>{t('common.readOnly') || 'Chỉ xem'}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add / Edit */}
      {editing && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                {editing.id ? `${t('minibar.editTable') || 'Sửa thông tin bàn'}: ${editing.name}` : (t('minibar.addTable') || 'Thêm bàn mới')}
              </h3>
              <button
                type="button"
                className="xbtn"
                style={{ fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none' }}
                onClick={() => setEditing(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '20px' }}>
              {error && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '13px', marginBottom: '14px' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                    {t('minibar.tableCode') || 'Mã bàn'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editing.code || ''}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                    {t('minibar.tableName') || 'Tên bàn'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editing.name || ''}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="VD: Bàn 01, VIP 1..."
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                    {t('minibar.area') || 'Khu vực'}
                  </label>
                  <input
                    type="text"
                    list="areas-list"
                    value={editing.area || ''}
                    onChange={(e) => setEditing({ ...editing, area: e.target.value })}
                    placeholder="Chọn hoặc nhập mới"
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                  />
                  <datalist id="areas-list">
                    {areas.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                    {t('minibar.seatCapacity') || 'Sức chứa (số ghế)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editing.capacity || 4}
                    onChange={(e) => setEditing({ ...editing, capacity: parseInt(e.target.value, 10) || 1 })}
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  {t('common.status') || 'Trạng thái bàn'}
                </label>
                <select
                  value={editing.status || 'empty'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px', background: '#fff' }}
                >
                  <option value="empty">{t('minibar.statusEmpty') || 'Trống'}</option>
                  <option value="occupied">{t('minibar.statusOccupied') || 'Đang có khách'}</option>
                  <option value="reserved">{t('minibar.statusReserved') || 'Đặt trước'}</option>
                </select>
              </div>

              {editing.status === 'reserved' && (
                <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#854d0e', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📅</span> {t('minibar.reservedInfo') || 'Thông tin khách đặt trước'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#713f12', marginBottom: '4px' }}>
                        {t('minibar.customerName') || 'Tên khách hàng'}
                      </label>
                      <input
                        type="text"
                        value={editing.reservedCustomerName || ''}
                        onChange={(e) => setEditing({ ...editing, reservedCustomerName: e.target.value })}
                        placeholder="VD: Anh Tuấn"
                        style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #facc15', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#713f12', marginBottom: '4px' }}>
                        {t('minibar.customerPhone') || 'Số điện thoại'}
                      </label>
                      <input
                        type="tel"
                        value={editing.reservedCustomerPhone || ''}
                        onChange={(e) => setEditing({ ...editing, reservedCustomerPhone: e.target.value })}
                        placeholder="VD: 0912345678"
                        style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #facc15', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#713f12', marginBottom: '4px' }}>
                      {t('minibar.arrivalTime') || 'Giờ hẹn / Thời gian đến'}
                    </label>
                    <input
                      type="text"
                      value={editing.reservedTime || ''}
                      onChange={(e) => setEditing({ ...editing, reservedTime: e.target.value })}
                      placeholder="VD: 18:30..."
                      style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #facc15', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  {t('common.note') || 'Ghi chú'}
                </label>
                <textarea
                  rows="2"
                  value={editing.note || ''}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                  placeholder={t('minibar.tableNotePlaceholder') || 'Ghi chú về vị trí, tiện ích...'}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="tb"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: '6px' }}
                >
                  {t('common.cancel') || 'Hủy'}
                </button>
                <button
                  type="submit"
                  className="pb"
                  disabled={saving}
                  style={{ padding: '8px 20px', borderRadius: '6px', fontWeight: '600' }}
                >
                  {saving ? (t('common.saving') || 'Đang lưu...') : (t('minibar.saveTableInfo') || 'Lưu thông tin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

