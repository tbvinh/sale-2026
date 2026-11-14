import { useState, useMemo } from 'react';
import { diningTablesStore } from '../../core/masterdata.js';
import { useConfirm } from '../../core/confirm.jsx';
import { renameDiningArea, deleteDiningArea } from './areaApi.js';

export function AreaManager({ can, t = (k) => k, onOpenMap, onOpenCatalog }) {
  const confirm = useConfirm();
  const tablesState = diningTablesStore.use();
  const tables = tablesState.items || [];

  const canCreate = can?.('tables', 'create') ?? false;
  const canUpdate = can?.('tables', 'update') ?? false;
  const canDelete = can?.('tables', 'delete') ?? false;
  const isReadOnly = !canCreate && !canUpdate && !canDelete;

  const [q, setQ] = useState('');

  // Modals state
  const [renamingArea, setRenamingArea] = useState(null); // string oldName or null
  const [newAreaName, setNewAreaName] = useState('');
  const [renamingLoading, setRenamingLoading] = useState(false);

  const [showNewFloorModal, setShowNewFloorModal] = useState(false);
  const [newFloorForm, setNewFloorForm] = useState({ name: '', firstTableCode: '', firstTableName: '', capacity: 4 });
  const [newFloorLoading, setNewFloorLoading] = useState(false);

  const [addTableToArea, setAddTableToArea] = useState(null); // string areaName
  const [addTableForm, setAddTableForm] = useState({ code: '', name: '', capacity: 4, note: '' });
  const [addTableLoading, setAddTableLoading] = useState(false);

  const [deletingArea, setDeletingArea] = useState(null); // string areaName
  const [deleteTargetArea, setDeleteTargetArea] = useState('');
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Group tables by area
  const areaGroups = useMemo(() => {
    const defaultAreaName = t('minibar.areaGeneral') || 'Khu vực chung';
    const map = new Map();
    tables.forEach((item) => {
      const a = (item.area || defaultAreaName).trim();
      if (!map.has(a)) {
        map.set(a, {
          name: a,
          tables: [],
          totalCapacity: 0,
          empty: 0,
          occupied: 0,
          reserved: 0,
        });
      }
      const g = map.get(a);
      g.tables.push(t);
      g.totalCapacity += Number(t.capacity) || 0;
      if (t.status === 'occupied') g.occupied++;
      else if (t.status === 'reserved') g.reserved++;
      else g.empty++;
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [tables]);

  // Filtered area groups
  const filteredGroups = useMemo(() => {
    if (!q.trim()) return areaGroups;
    const query = q.trim().toLowerCase();
    return areaGroups.filter((g) => {
      if (g.name.toLowerCase().includes(query)) return true;
      return g.tables.some((t) =>
        (t.name || '').toLowerCase().includes(query) ||
        (t.code || '').toLowerCase().includes(query) ||
        (t.reservedCustomerName || '').toLowerCase().includes(query) ||
        (t.reservedCustomerPhone || '').toLowerCase().includes(query)
      );
    });
  }, [areaGroups, q]);

  // Total summary
  const totalTables = tables.length;
  const totalCapacity = useMemo(() => tables.reduce((s, t) => s + (Number(t.capacity) || 0), 0), [tables]);

  // Open Rename Modal
  const openRenameModal = (areaName) => {
    setRenamingArea(areaName);
    setNewAreaName(areaName);
  };

  // Submit Rename
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renamingArea || !newAreaName.trim()) return;
    if (newAreaName.trim() === renamingArea) {
      setRenamingArea(null);
      return;
    }
    setRenamingLoading(true);
    try {
      await renameDiningArea(renamingArea, newAreaName.trim(), tables);
      setRenamingArea(null);
    } catch (err) {
      alert(err?.message || (t('minibar.renameAreaFailed') || 'Lỗi khi đổi tên tầng.'));
    } finally {
      setRenamingLoading(false);
    }
  };

  // Open Add Table to Area Modal
  const openAddTableModal = (areaName) => {
    const existing = tables.filter((item) => (item.area || '').trim() === areaName);
    const count = existing.length + 1;
    const code = `BAN-${String(count).padStart(2, '0')}`;
    const name = `Bàn ${String(count).padStart(2, '0')}`;
    setAddTableToArea(areaName);
    setAddTableForm({ code, name, capacity: 4, note: '' });
  };

  // Submit Add Table to Area
  const handleAddTableSubmit = async (e) => {
    e.preventDefault();
    if (!addTableToArea || !addTableForm.name.trim()) return;
    setAddTableLoading(true);
    try {
      await diningTablesStore.add({
        code: addTableForm.code.trim() || undefined,
        name: addTableForm.name.trim(),
        area: addTableToArea,
        capacity: Number(addTableForm.capacity) || 4,
        status: 'empty',
        active: true,
        note: addTableForm.note?.trim() || '',
      });
      setAddTableToArea(null);
    } catch (err) {
      alert(err?.message || (t('minibar.addTableFailed') || 'Lỗi khi thêm bàn vào tầng.'));
    } finally {
      setAddTableLoading(false);
    }
  };

  // Open New Floor Modal
  const openNewFloorModal = () => {
    const nextNum = areaGroups.length + 1;
    setNewFloorForm({
      name: `Tầng ${nextNum}`,
      firstTableCode: `T${nextNum}-01`,
      firstTableName: `Bàn 01 (Tầng ${nextNum})`,
      capacity: 4,
    });
    setShowNewFloorModal(true);
  };

  // Submit New Floor
  const handleNewFloorSubmit = async (e) => {
    e.preventDefault();
    if (!newFloorForm.name.trim()) {
      alert(t('minibar.enterFloorPrompt') || 'Vui lòng nhập tên tầng / khu vực.');
      return;
    }
    setNewFloorLoading(true);
    try {
      await diningTablesStore.add({
        code: newFloorForm.firstTableCode.trim() || undefined,
        name: newFloorForm.firstTableName.trim() || 'Bàn 01',
        area: newFloorForm.name.trim(),
        capacity: Number(newFloorForm.capacity) || 4,
        status: 'empty',
        active: true,
      });
      setShowNewFloorModal(false);
    } catch (err) {
      alert(err?.message || (t('minibar.addFloorFailed') || 'Lỗi khi tạo tầng mới.'));
    } finally {
      setNewFloorLoading(false);
    }
  };

  // Open Delete Area Modal
  const openDeleteAreaModal = (areaName) => {
    const others = areaGroups.filter((g) => g.name !== areaName).map((g) => g.name);
    setDeletingArea(areaName);
    setDeleteTargetArea(others[0] || (t('minibar.areaGeneral') || 'Khu vực chung'));
  };

  // Submit Delete Area
  const handleDeleteAreaSubmit = async (e) => {
    e.preventDefault();
    if (!deletingArea) return;
    setDeletingLoading(true);
    try {
      await deleteDiningArea(deletingArea, deleteTargetArea, tables);
      setDeletingArea(null);
    } catch (err) {
      alert(err?.message || (t('minibar.deleteAreaFailed') || 'Lỗi khi xóa / chuyển tầng.'));
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div className="catpage" style={{ padding: '20px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>
              🏢 {t('minibar.manageAreas') || 'Quản lý Tầng & Khu vực'}
            </h2>
            <span style={{ fontSize: '13px', background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>
              {areaGroups.length} {t('minibar.areas') || 'tầng / khu vực'}
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            {t('minibar.manageAreasSub') || 'Đổi tên tầng hàng loạt cho các bàn, tạo tầng mới hoặc sắp xếp lại các khu vực phục vụ.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onOpenMap && (
            <button
              type="button"
              className="tb"
              onClick={onOpenMap}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
            >
              🍽️ {t('minibar.map') || 'Xem sơ đồ bàn'}
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              className="pb"
              onClick={openNewFloorModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
            >
              ➕ {t('minibar.addFloor') || 'Thêm tầng mới'}
            </button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px', color: '#64748b', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🛡️</span>
          <span>{t('minibar.readOnlyAreasHint') || 'Bạn đang xem danh sách tầng & khu vực ở chế độ Chỉ xem (Không có quyền Thêm/Sửa/Xóa). Liên hệ Quản trị viên nếu cần thay đổi khu vực phục vụ.'}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('minibar.areas') || 'Tổng số tầng / khu vực'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', marginTop: '6px' }}>
            {areaGroups.length}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('minibar.tableCount') || 'Tổng số bàn'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0284c7', marginTop: '6px' }}>
            {totalTables} <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#64748b' }}>{t('minibar.table') || 'bàn'}</span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('minibar.totalCapacity') || 'Tổng sức chứa phục vụ'}
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#16a34a', marginTop: '6px' }}>
            {totalCapacity} <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#64748b' }}>{t('minibar.people') || 'chỗ ngồi'}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ flex: 1, maxWidth: '360px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('minibar.searchAreaPlaceholder') || 'Tìm theo tên tầng hoặc tên bàn...'}
            style={{ width: '100%', height: '38px', padding: '0 12px 0 34px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px' }}
          />
        </div>
      </div>

      {/* Areas List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredGroups.length === 0 ? (
          <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
            {t('common.empty') || 'Không tìm thấy tầng / khu vực nào phù hợp.'}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div
              key={group.name}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Row header: Name, Stats, Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '24px' }}>🏢</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                        {group.name}
                      </h3>
                      {canUpdate && (
                        <button
                          type="button"
                          className="tb"
                          onClick={() => openRenameModal(group.name)}
                          style={{ padding: '3px 8px', fontSize: '12px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title={t('minibar.renameFloor') || 'Đổi tên tầng này'}
                        >
                          ✏️ {t('minibar.renameFloor') || 'Đổi tên'}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span>{t('common.total') || 'Tổng'}: <b>{group.tables.length}</b> {t('minibar.table') || 'bàn'}</span>
                      <span>{t('minibar.capacity') || 'Sức chứa'}: <b>{group.totalCapacity}</b> {t('minibar.people') || 'chỗ'}</span>
                      <span style={{ color: '#16a34a' }}>🟢 {group.empty} {t('minibar.statusEmpty') || 'trống'}</span>
                      <span style={{ color: '#ea580c' }}>🟠 {group.occupied} {t('minibar.statusOccupied') || 'có khách'}</span>
                      <span style={{ color: '#ca8a04' }}>🟡 {group.reserved} {t('minibar.statusReserved') || 'đặt trước'}</span>
                    </div>
                  </div>
                </div>

                {/* Floor Action Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {canCreate && (
                    <button
                      type="button"
                      className="tb"
                      onClick={() => openAddTableModal(group.name)}
                      style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      ➕ {t('minibar.addTableToFloor') || 'Thêm bàn vào tầng'}
                    </button>
                  )}
                  {onOpenCatalog && (
                    <button
                      type="button"
                      className="tb"
                      onClick={() => onOpenCatalog(group.name)}
                      style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '6px' }}
                      title={t('common.details') || 'Xem danh sách bàn chi tiết'}
                    >
                      📋 Chi tiết
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="tb"
                      onClick={() => openDeleteAreaModal(group.name)}
                      style={{ padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px', color: '#dc2626' }}
                      title="Xóa hoặc dời bàn khỏi tầng này"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {/* Table chips inside this floor */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {t('minibar.catalog') || 'Danh sách bàn thuộc tầng'}:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {group.tables.map((tItem) => {
                    const statusDot = tItem.status === 'occupied' ? '🟠' : tItem.status === 'reserved' ? '🟡' : '🟢';
                    const statusBg = tItem.status === 'occupied' ? '#fff7ed' : tItem.status === 'reserved' ? '#fefce8' : '#f0fdf4';
                    const statusBorder = tItem.status === 'occupied' ? '#fdba74' : tItem.status === 'reserved' ? '#fde047' : '#86efac';
                    return (
                      <div
                        key={tItem.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: statusBg,
                          border: `1px solid ${statusBorder}`,
                          borderRadius: '6px',
                          padding: '5px 10px',
                          fontSize: '12.5px',
                        }}
                      >
                        <span>{statusDot}</span>
                        <b style={{ color: '#0f172a' }}>{tItem.name}</b>
                        <span style={{ color: '#64748b', fontSize: '11.5px' }}>({tItem.capacity || 4} {t('minibar.people') || 'chỗ'})</span>
                        {tItem.status === 'reserved' && tItem.reservedCustomerName && (
                          <span style={{ color: '#b45309', fontSize: '11px', fontWeight: '600' }}>
                            [{tItem.reservedCustomerName}]
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal 1: Rename Floor */}
      {renamingArea && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '420px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                ✏️ {t('minibar.renameFloor') || 'Đổi tên tầng / khu vực'}
              </h3>
              <button type="button" className="xbtn" onClick={() => setRenamingArea(null)} style={{ fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleRenameSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                  {t('minibar.floorName') || 'Tên tầng hiện tại'}:
                </label>
                <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', fontSize: '14px', fontWeight: '600', color: '#334155', border: '1px solid #e2e8f0' }}>
                  {renamingArea}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  {t('minibar.renameFloor') || 'Tên tầng mới'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Ví dụ: Tầng 1 (Sảnh chính), Tầng 2, Sân thượng..."
                  style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 12px', fontSize: '12.5px', color: '#166534', marginBottom: '18px' }}>
                💡 {t('minibar.manageAreasSub') || `Thao tác này sẽ tự động cập nhật tên tầng mới cho toàn bộ các bàn đang thuộc tầng "${renamingArea}".`}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="tb" disabled={renamingLoading} onClick={() => setRenamingArea(null)} style={{ padding: '7px 14px', borderRadius: '6px' }}>
                  {t('common.cancel') || 'Hủy bỏ'}
                </button>
                <button type="submit" className="pb" disabled={renamingLoading || !newAreaName.trim()} style={{ padding: '7px 18px', borderRadius: '6px', fontWeight: '600' }}>
                  {renamingLoading ? (t('common.saving') || 'Đang lưu...') : (t('common.save') || 'Lưu tên mới')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: New Floor */}
      {showNewFloorModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '440px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                ➕ {t('minibar.addFloor') || 'Thêm tầng / khu vực mới'}
              </h3>
              <button type="button" className="xbtn" onClick={() => setShowNewFloorModal(false)} style={{ fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleNewFloorSubmit}>
              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  {t('minibar.floorName') || 'Tên tầng / khu vực mới'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFloorForm.name}
                  onChange={(e) => setNewFloorForm({ ...newFloorForm, name: e.target.value })}
                  placeholder="Ví dụ: Tầng 2, Sân thượng, VIP 2..."
                  style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    {t('minibar.tableCode') || 'Mã bàn đầu tiên'}
                  </label>
                  <input
                    type="text"
                    value={newFloorForm.firstTableCode}
                    onChange={(e) => setNewFloorForm({ ...newFloorForm, firstTableCode: e.target.value })}
                    placeholder="VD: BAN-T2-01"
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    {t('minibar.tableName') || 'Tên bàn đầu tiên'}
                  </label>
                  <input
                    type="text"
                    value={newFloorForm.firstTableName}
                    onChange={(e) => setNewFloorForm({ ...newFloorForm, firstTableName: e.target.value })}
                    placeholder="VD: Bàn 01"
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  {t('minibar.seatCapacity') || 'Sức chứa (số ghế)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newFloorForm.capacity}
                  onChange={(e) => setNewFloorForm({ ...newFloorForm, capacity: parseInt(e.target.value, 10) || 4 })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="tb" disabled={newFloorLoading} onClick={() => setShowNewFloorModal(false)} style={{ padding: '7px 14px', borderRadius: '6px' }}>
                  {t('common.cancel') || 'Hủy bỏ'}
                </button>
                <button type="submit" className="pb" disabled={newFloorLoading || !newFloorForm.name.trim()} style={{ padding: '7px 18px', borderRadius: '6px', fontWeight: '600' }}>
                  {newFloorLoading ? (t('common.loading') || 'Đang tạo...') : (t('minibar.addFloor') || 'Tạo tầng mới')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Table to Floor */}
      {addTableToArea && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '440px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                ➕ {t('minibar.addTableToFloor') || 'Thêm bàn vào'}: {addTableToArea}
              </h3>
              <button type="button" className="xbtn" onClick={() => setAddTableToArea(null)} style={{ fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTableSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    {t('minibar.tableCode') || 'Mã bàn'}
                  </label>
                  <input
                    type="text"
                    value={addTableForm.code}
                    onChange={(e) => setAddTableForm({ ...addTableForm, code: e.target.value })}
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    {t('minibar.tableName') || 'Tên bàn'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={addTableForm.name}
                    onChange={(e) => setAddTableForm({ ...addTableForm, name: e.target.value })}
                    placeholder="VD: Bàn 05"
                    style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  {t('minibar.seatCapacity') || 'Sức chứa (số ghế)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={addTableForm.capacity}
                  onChange={(e) => setAddTableForm({ ...addTableForm, capacity: parseInt(e.target.value, 10) || 4 })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  {t('common.note') || 'Ghi chú bàn'}
                </label>
                <input
                  type="text"
                  value={addTableForm.note}
                  onChange={(e) => setAddTableForm({ ...addTableForm, note: e.target.value })}
                  placeholder="Gần cửa sổ, ngoài ban công..."
                  style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="tb" disabled={addTableLoading} onClick={() => setAddTableToArea(null)} style={{ padding: '7px 14px', borderRadius: '6px' }}>
                  {t('common.cancel') || 'Hủy bỏ'}
                </button>
                <button type="submit" className="pb" disabled={addTableLoading || !addTableForm.name.trim()} style={{ padding: '7px 18px', borderRadius: '6px', fontWeight: '600' }}>
                  {addTableLoading ? (t('common.loading') || 'Đang tạo...') : (t('minibar.addTable') || 'Tạo bàn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Delete / Reassign Floor */}
      {deletingArea && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '420px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#dc2626' }}>
                🗑️ {t('minibar.deleteFloor') || 'Xóa tầng'}: {deletingArea}
              </h3>
              <button type="button" className="xbtn" onClick={() => setDeletingArea(null)} style={{ fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleDeleteAreaSubmit}>
              <p style={{ margin: '0 0 14px 0', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
                {t('minibar.deleteFloorConfirm') || `Các bàn hiện tại thuộc tầng "${deletingArea}" sẽ được chuyển sang tầng / khu vực đích dưới đây:`}
              </p>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  {t('minibar.transferTablesTo') || 'Chuyển các bàn sang:'}
                </label>
                <select
                  value={deleteTargetArea}
                  onChange={(e) => setDeleteTargetArea(e.target.value)}
                  style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                >
                  <option value={t('minibar.areaGeneral') || 'Khu vực chung'}>{t('minibar.areaGeneral') || 'Khu vực chung'} ({t('common.default') || 'Mặc định'})</option>
                  {areaGroups
                    .filter((g) => g.name !== deletingArea)
                    .map((g) => (
                      <option key={g.name} value={g.name}>
                        {g.name} ({g.tables.length} {t('minibar.table') || 'bàn'})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="tb" disabled={deletingLoading} onClick={() => setDeletingArea(null)} style={{ padding: '7px 14px', borderRadius: '6px' }}>
                  {t('common.cancel') || 'Hủy bỏ'}
                </button>
                <button type="submit" className="pb" disabled={deletingLoading} style={{ padding: '7px 18px', borderRadius: '6px', fontWeight: '600', background: '#dc2626', color: '#fff' }}>
                  {deletingLoading ? (t('common.loading') || 'Đang chuyển...') : (t('common.confirm') || 'Xác nhận xóa & chuyển')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

