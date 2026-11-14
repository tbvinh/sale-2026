import { useState, useMemo, useEffect } from 'react';
import { diningTablesStore, vnd } from '../../core/masterdata.js';
import { getAllDrafts, transferTableDraft, clearTableDraft } from './orderDrafts.js';
import { useConfirm } from '../../core/confirm.jsx';
import { shiftApi } from '../../api/shiftApi.js';

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const cleanDigits = (s) => String(s ?? '').replace(/\D/g, '');

const getStatusConfig = (status, t = (k) => k) => {
  switch (status) {
    case 'occupied':
      return {
        label: t('minibar.statusOccupied') || 'Đang phục vụ',
        color: '#ea580c',
        bg: '#fff7ed',
        border: '#fdba74',
        icon: '🟠',
      };
    case 'reserved':
      return {
        label: t('minibar.statusReserved') || 'Đặt trước',
        color: '#ca8a04',
        bg: '#fefce8',
        border: '#fde047',
        icon: '🟡',
      };
    default:
      return {
        label: t('minibar.statusEmpty') || 'Trống',
        color: '#16a34a',
        bg: '#f0fdf4',
        border: '#86efac',
        icon: '🟢',
      };
  }
};

export function TableMap({ onSelectTable, onOpenCatalog, onOpenAreas, onOpenShifts, can, t = (k) => k }) {
  const confirm = useConfirm();
  const tablesState = diningTablesStore.use();
  const tables = tablesState.items || [];
  const drafts = getAllDrafts();

  const [currentShift, setCurrentShift] = useState(null);
  useEffect(() => {
    let unmounted = false;
    shiftApi.getCurrent().then((res) => {
      if (!unmounted && res) {
        setCurrentShift(res.shift || null);
      }
    }).catch(() => {});
    return () => { unmounted = true; };
  }, []);

  const [selectedArea, setSelectedArea] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [q, setQ] = useState('');

  // Transfer modal
  const [transferSource, setTransferSource] = useState(null);
  const [transferTargetId, setTransferTargetId] = useState('');

  // Areas list
  const areas = useMemo(() => {
    const set = new Set();
    tables.forEach((t) => { if (t.area) set.add(t.area); });
    return Array.from(set);
  }, [tables]);

  // Counts
  const counts = useMemo(() => {
    let empty = 0, occupied = 0, reserved = 0;
    tables.forEach((t) => {
      if (t.status === 'occupied') occupied++;
      else if (t.status === 'reserved') reserved++;
      else empty++;
    });
    return { all: tables.length, empty, occupied, reserved };
  }, [tables]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tables.filter((table) => {
      if (selectedArea && table.area !== selectedArea) return false;
      if (selectedStatus && table.status !== selectedStatus) return false;
      if (q) {
        const query = fold(q.trim());
        const digits = cleanDigits(q);
        const code = fold(table.code);
        const name = fold(table.name);
        const area = fold(table.area);
        const note = fold(table.note);
        const resName = fold(table.reservedCustomerName);
        const resPhone = fold(table.reservedCustomerPhone);
        const phoneDigits = cleanDigits(table.reservedCustomerPhone);

        const draft = drafts[table.id] || (table.currentDocId ? drafts[table.currentDocId] : null);
        const custName = fold(draft?.customer?.name);
        const custPhone = fold(draft?.customer?.phone);
        const custDigits = cleanDigits(draft?.customer?.phone);

        const matchText = code.includes(query) ||
          name.includes(query) ||
          area.includes(query) ||
          note.includes(query) ||
          resName.includes(query) ||
          resPhone.includes(query) ||
          custName.includes(query) ||
          custPhone.includes(query);

        const matchPhone = digits.length >= 3 && (phoneDigits.includes(digits) || custDigits.includes(digits));

        return matchText || matchPhone;
      }
      return true;
    });
  }, [tables, selectedArea, selectedStatus, q, drafts]);

  // Reservation modal state
  const [reserveTarget, setReserveTarget] = useState(null);
  const [reserveForm, setReserveForm] = useState({ customerName: '', customerPhone: '', reservedTime: '', note: '' });
  const [reserving, setReserving] = useState(false);

  const openReserveModal = (e, table) => {
    e?.stopPropagation?.();
    setReserveTarget(table);
    setReserveForm({
      customerName: table.reservedCustomerName || '',
      customerPhone: table.reservedCustomerPhone || '',
      reservedTime: table.reservedTime || '',
      note: table.note || '',
    });
  };

  const handleSaveReservation = async (e) => {
    e.preventDefault();
    if (!reserveTarget) return;
    if (!reserveForm.customerName.trim() && !reserveForm.customerPhone.trim()) {
      alert(t('minibar.enterCustomerPrompt') || 'Vui lòng nhập tên khách hàng hoặc số điện thoại.');
      return;
    }
    setReserving(true);
    try {
      await diningTablesStore.update(reserveTarget.id, {
        status: 'reserved',
        reservedCustomerName: reserveForm.customerName.trim(),
        reservedCustomerPhone: reserveForm.customerPhone.trim(),
        reservedTime: reserveForm.reservedTime.trim(),
        note: reserveForm.note.trim(),
      });
      setReserveTarget(null);
    } catch (err) {
      alert(err?.message || (t('minibar.reserveError') || 'Lỗi khi lưu thông tin đặt bàn.'));
    } finally {
      setReserving(false);
    }
  };

  const handleCancelReservation = async (e, table) => {
    e.stopPropagation();
    const who = table.reservedCustomerName || table.reservedCustomerPhone;
    const ok = await confirm((t('minibar.cancelReservation') || 'Hủy đặt trước cho bàn') + ` "${table.name}"${who ? ` (${who})` : ''}?`);
    if (ok) {
      try {
        await diningTablesStore.update(table.id, {
          status: 'empty',
          reservedCustomerName: null,
          reservedCustomerPhone: null,
          reservedTime: null,
        });
      } catch (err) {
        alert(err?.message || (t('minibar.updateStatusFailed') || 'Lỗi cập nhật trạng thái.'));
      }
    }
  };

  const handleCheckInReserved = async (e, table) => {
    e.stopPropagation();
    try {
      await diningTablesStore.update(table.id, { status: 'occupied' });
      onSelectTable({
        ...table,
        status: 'occupied',
      });
    } catch (err) {
      alert(err?.message || (t('minibar.updateStatusFailed') || 'Lỗi cập nhật trạng thái.'));
    }
  };

  // Quick transfer execution
  const executeTransfer = async () => {
    if (!transferSource || !transferTargetId) return;
    const target = tables.find((t) => t.id === transferTargetId);
    if (!target) return;

    if (target.status === 'occupied') {
      const ok = await confirm((t('minibar.transferConfirm') || `Bàn "${target.name}" đang có khách. Bạn có chắc muốn ghép đơn vào bàn này?`));
      if (!ok) return;
    }

    try {
      transferTableDraft(transferSource.id, target.id);
      await diningTablesStore.update(transferSource.id, { status: 'empty', currentDocId: null });
      await diningTablesStore.update(target.id, { status: 'occupied' });
      setTransferSource(null);
      setTransferTargetId('');
      alert((t('minibar.transferSuccess') || `Đã chuyển bàn thành công sang "${target.name}"!`));
    } catch (err) {
      alert(err?.message || (t('minibar.transferFailed') || 'Lỗi khi chuyển bàn.'));
    }
  };

  return (
    <div className="mb-map-wrap" style={{ padding: '16px' }}>
      {/* Top Filter and Stats Bar */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '14px 18px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          {/* Status summary pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedStatus('')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                border: '1px solid',
                borderColor: !selectedStatus ? '#0284c7' : '#cbd5e1',
                background: !selectedStatus ? '#0284c7' : '#fff',
                color: !selectedStatus ? '#fff' : '#475569',
                cursor: 'pointer',
              }}
            >
              {t('minibar.allAreas') || 'Tất cả bàn'} ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('empty')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                border: '1px solid',
                borderColor: selectedStatus === 'empty' ? '#16a34a' : '#86efac',
                background: selectedStatus === 'empty' ? '#16a34a' : '#f0fdf4',
                color: selectedStatus === 'empty' ? '#fff' : '#166534',
                cursor: 'pointer',
              }}
            >
              🟢 {t('minibar.statusEmpty') || 'Trống'} ({counts.empty})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('occupied')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                border: '1px solid',
                borderColor: selectedStatus === 'occupied' ? '#ea580c' : '#fdba74',
                background: selectedStatus === 'occupied' ? '#ea580c' : '#fff7ed',
                color: selectedStatus === 'occupied' ? '#fff' : '#9a3412',
                cursor: 'pointer',
              }}
            >
              🟠 {t('minibar.statusOccupied') || 'Đang có khách'} ({counts.occupied})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('reserved')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                border: '1px solid',
                borderColor: selectedStatus === 'reserved' ? '#ca8a04' : '#fde047',
                background: selectedStatus === 'reserved' ? '#ca8a04' : '#fefce8',
                color: selectedStatus === 'reserved' ? '#fff' : '#854d0e',
                cursor: 'pointer',
              }}
            >
              🟡 {t('minibar.statusReserved') || 'Đặt trước'} ({counts.reserved})
            </button>
          </div>

          {/* Quick Add or Manage Tables & Shift Status */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {onOpenShifts && (
              currentShift ? (
                <button
                  type="button"
                  onClick={onOpenShifts}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    cursor: 'pointer'
                  }}
                  title={t('minibar.shiftTitle') || 'Ca làm việc đang mở'}
                >
                  ⏱️ <span>{t('minibar.shiftName') || 'Ca'}: <b>{currentShift.name}</b></span>
                  <span style={{ color: '#059669', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontSize: '11.5px' }}>
                    {vnd(currentShift.expectedCash || currentShift.openingCash || 0)}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenShifts}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    background: '#fffbeb',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    cursor: 'pointer'
                  }}
                  title={t('minibar.openShiftPrompt') || 'Chưa mở ca làm việc'}
                >
                  ⚠️ <span>{t('minibar.openShiftPrompt') || 'Chưa mở ca'}</span>
                  <span style={{ textDecoration: 'underline', marginLeft: '4px' }}>{t('minibar.openShiftBtn') || 'Mở ca ngay'}</span>
                </button>
              )
            )}
            {onOpenAreas && (
              <button
                type="button"
                className="tb"
                onClick={onOpenAreas}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', borderRadius: '6px' }}
                title={t('minibar.manageAreas') || 'Quản lý & Đổi tên các tầng/khu vực'}
              >
                🏢 {t('minibar.manageAreasBtn') || 'Quản lý tầng'}
              </button>
            )}
            <button
              type="button"
              className="tb"
              onClick={onOpenCatalog}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', borderRadius: '6px' }}
            >
              🪑 {t('minibar.catalog') || 'Danh mục bàn'}
            </button>
          </div>
        </div>

        {/* Area filter chips & Search box */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setSelectedArea('')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: '600',
                border: '1px solid',
                borderColor: !selectedArea ? '#334155' : '#cbd5e1',
                background: !selectedArea ? '#334155' : '#fff',
                color: !selectedArea ? '#fff' : '#64748b',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t('minibar.allAreas') || 'Tất cả khu vực'}
            </button>
            {areas.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setSelectedArea(a)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  border: '1px solid',
                  borderColor: selectedArea === a ? '#334155' : '#cbd5e1',
                  background: selectedArea === a ? '#334155' : '#fff',
                  color: selectedArea === a ? '#fff' : '#64748b',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {a}
              </button>
            ))}
            {onOpenAreas && selectedArea && (
              <button
                type="button"
                className="tb"
                onClick={onOpenAreas}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  color: '#0284c7',
                  border: '1px dashed #38bdf8',
                  background: '#f0f9ff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: '600',
                }}
                title={t('minibar.renameFloor') || 'Đổi tên tầng'}
              >
                ✏️ {t('minibar.renameFloor') || 'Đổi tên tầng'}
              </button>
            )}
          </div>

          <div className="searchbox" style={{ width: '270px' }}>
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              value={q}
              placeholder={t('minibar.searchTablePlaceholder') || 'Tìm bàn, người đặt, SĐT...'}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: '100%', height: '32px', padding: '0 26px', borderRadius: '6px', fontSize: '13px' }}
            />
            {q && (
              <button type="button" className="xbtn" onClick={() => setQ('')}>✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Tables */}
      {filteredTables.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <span style={{ fontSize: '40px' }}>🍽️</span>
          <p style={{ marginTop: '10px', fontSize: '15px', fontWeight: '500' }}>{t('minibar.noTablesFound') || 'Không tìm thấy bàn nào phù hợp bộ lọc.'}</p>
          <button
            type="button"
            className="pb"
            onClick={onOpenCatalog}
            style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px' }}
          >
            ➕ {t('minibar.addTable') || 'Thêm bàn mới vào hệ thống'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {filteredTables.map((table) => {
            const st = getStatusConfig(table.status, t);
            const draft = drafts[table.id];
            const hasOrder = draft && draft.lines && draft.lines.length > 0;
            const totalLines = hasOrder ? draft.lines.length : 0;
            const totalQty = hasOrder ? draft.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0) : 0;
            const totalSum = hasOrder ? draft.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0) : 0;

            return (
              <div
                key={table.id}
                onClick={() => onSelectTable(table)}
                style={{
                  background: '#fff',
                  border: '2px solid',
                  borderColor: st.border,
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '160px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
                }}
              >
                {/* Header: Name, Area, Capacity */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                        {table.name}
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {table.code} · {table.area || (t('minibar.indoor') || 'Trong nhà')}
                      </span>
                    </div>

                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: st.color,
                        background: st.bg,
                        border: `1px solid ${st.border}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {st.icon} {st.label}
                    </span>
                  </div>

                  {/* Seat capacity badge */}
                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
                    🪑 <b>{table.capacity || 4}</b> {t('minibar.people') || 'chỗ'}
                    {table.note && (
                      <span style={{ marginLeft: '8px', color: '#94a3b8', fontStyle: 'italic' }}>
                        ({table.note})
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle: Order information if occupied */}
                {table.status === 'occupied' && (
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px' }}>
                    {hasOrder ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                          <span style={{ color: '#9a3412', fontWeight: '600' }}>
                            {totalLines} {t('minibar.item') || 'món'} ({totalQty} {t('minibar.portions') || 'phần'})
                          </span>
                          <span style={{ color: '#047857', fontWeight: '700', fontSize: '13.5px' }}>
                            {vnd(totalSum)}
                          </span>
                        </div>
                        {draft.customer && draft.customer.name !== 'Khách vãng lai' && (
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                            {t('minibar.customer') || 'Khách'}: <b>{draft.customer.name}</b>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#9a3412', fontStyle: 'italic' }}>
                        {t('minibar.tableOpenedEmpty') || 'Đang mở bàn (chưa chọn món)'}
                      </div>
                    )}
                  </div>
                )}

                {table.status === 'reserved' && (
                  <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', fontSize: '12.5px', color: '#854d0e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <div style={{ fontWeight: '700', color: '#92400e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>📌 {t('minibar.statusReserved') || 'Đặt'}:</span>
                        <span>{table.reservedCustomerName || (t('minibar.noName') || 'Chưa có tên')}</span>
                      </div>
                      {table.reservedTime && (
                        <span style={{ fontSize: '11px', background: '#fef08a', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                          ⏰ {table.reservedTime}
                        </span>
                      )}
                    </div>
                    {table.reservedCustomerPhone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', fontSize: '12px' }}>
                        <span>📞</span>
                        <a href={`tel:${table.reservedCustomerPhone}`} style={{ color: '#0284c7', textDecoration: 'none', fontWeight: '600' }} onClick={(e) => e.stopPropagation()}>
                          {table.reservedCustomerPhone}
                        </a>
                      </div>
                    )}
                    {table.note && (
                      <div style={{ fontSize: '11.5px', fontStyle: 'italic', color: '#a16207', marginTop: '2px' }}>
                        📝 {table.note}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons footer */}
                <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                  {table.status === 'empty' && (
                    <>
                      <button
                        type="button"
                        className="pb"
                        onClick={() => onSelectTable(table)}
                        style={{ flex: 1, padding: '6px', fontSize: '12.5px', fontWeight: '600', borderRadius: '6px' }}
                      >
                        🛎️ {t('minibar.openTableAction') || 'Mở bàn'}
                      </button>
                      <button
                        type="button"
                        className="tb"
                        onClick={(e) => openReserveModal(e, table)}
                        style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px' }}
                        title={t('minibar.reserveTable') || 'Đặt trước bàn'}
                      >
                        📅 {t('minibar.statusReserved') || 'Đặt'}
                      </button>
                    </>
                  )}

                  {table.status === 'occupied' && (
                    <>
                      <button
                        type="button"
                        className="pb"
                        onClick={() => onSelectTable(table)}
                        style={{ flex: 1, padding: '6px', fontSize: '12.5px', fontWeight: '600', borderRadius: '6px', background: '#0284c7' }}
                      >
                        📝 {t('minibar.orderAction') || 'Gọi món / Xem bill'}
                      </button>
                      <button
                        type="button"
                        className="tb"
                        onClick={() => { setTransferSource(table); setTransferTargetId(''); }}
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px' }}
                        title={t('minibar.changeTable') || 'Chuyển sang bàn khác'}
                      >
                        🔁 {t('minibar.transferAction') || 'Đổi'}
                      </button>
                    </>
                  )}

                  {table.status === 'reserved' && (
                    <>
                      <button
                        type="button"
                        className="pb"
                        onClick={(e) => handleCheckInReserved(e, table)}
                        style={{ flex: 1, padding: '6px', fontSize: '12.5px', fontWeight: '600', borderRadius: '6px', background: '#ca8a04' }}
                      >
                        🛎️ {t('minibar.checkInTable') || 'Nhận bàn'}
                      </button>
                      <button
                        type="button"
                        className="tb"
                        onClick={(e) => openReserveModal(e, table)}
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px' }}
                        title={t('common.edit') || 'Sửa'}
                      >
                        ✏️ {t('common.edit') || 'Sửa'}
                      </button>
                      <button
                        type="button"
                        className="tb"
                        onClick={(e) => handleCancelReservation(e, table)}
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '6px', color: '#dc2626' }}
                        title={t('minibar.cancelReservation') || 'Hủy đặt bàn'}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transfer modal */}
      {transferSource && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '380px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              {t('minibar.changeTable') || 'Chuyển order'}: {transferSource.name}
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                {t('minibar.selectTargetTablePrompt') || 'Chọn bàn đích:'}
              </label>
              <select
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
                style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px', background: '#fff' }}
              >
                <option value="">-- {t('minibar.selectTable') || 'Chọn bàn'} --</option>
                {tables
                  .filter((tItem) => tItem.id !== transferSource.id)
                  .map((tItem) => (
                    <option key={tItem.id} value={tItem.id}>
                      {tItem.name} ({tItem.code}) - {tItem.area} [{tItem.status === 'empty' ? (t('minibar.statusEmpty') || 'Trống') : (t('minibar.statusOccupied') || 'Có khách')}]
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="tb"
                onClick={() => setTransferSource(null)}
                style={{ padding: '7px 14px', borderRadius: '6px' }}
              >
                {t('common.cancel') || 'Hủy'}
              </button>
              <button
                type="button"
                className="pb"
                disabled={!transferTargetId}
                onClick={executeTransfer}
                style={{ padding: '7px 16px', borderRadius: '6px', fontWeight: '600' }}
              >
                {t('minibar.transferAction') || 'Chuyển'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation modal */}
      {reserveTarget && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '440px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📅</span> {t('minibar.reserveTable') || 'Đặt trước'}: {reserveTarget.name}
              </h3>
              <button
                type="button"
                className="xbtn"
                onClick={() => setReserveTarget(null)}
                style={{ fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReservation}>
              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  {t('minibar.customerName') || 'Tên khách hàng'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={reserveForm.customerName}
                  onChange={(e) => setReserveForm({ ...reserveForm, customerName: e.target.value })}
                  placeholder="Ví dụ: Anh Tuấn, Chị Lan..."
                  style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  {t('minibar.customerPhone') || 'Số điện thoại'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={reserveForm.customerPhone}
                  onChange={(e) => setReserveForm({ ...reserveForm, customerPhone: e.target.value })}
                  placeholder="Ví dụ: 0912 345 678"
                  style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  {t('minibar.arrivalTime') || 'Thời gian khách đến / Giờ hẹn'}
                </label>
                <input
                  type="text"
                  value={reserveForm.reservedTime}
                  onChange={(e) => setReserveForm({ ...reserveForm, reservedTime: e.target.value })}
                  placeholder="Ví dụ: 18:30..."
                  style={{ width: '100%', height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  {t('common.note') || 'Ghi chú đặt bàn'}
                </label>
                <textarea
                  rows="2"
                  value={reserveForm.note}
                  onChange={(e) => setReserveForm({ ...reserveForm, note: e.target.value })}
                  placeholder={t('minibar.tableNotePlaceholder') || 'Ghi chú đặt bàn...'}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="tb"
                  disabled={reserving}
                  onClick={() => setReserveTarget(null)}
                  style={{ padding: '7px 14px', borderRadius: '6px' }}
                >
                  {t('common.cancel') || 'Hủy bỏ'}
                </button>
                <button
                  type="submit"
                  className="pb"
                  disabled={reserving}
                  style={{ padding: '7px 18px', borderRadius: '6px', fontWeight: '600', background: '#ca8a04', color: '#fff' }}
                >
                  {reserving ? (t('common.saving') || 'Đang lưu...') : (t('minibar.reserveTable') || 'Xác nhận đặt bàn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

