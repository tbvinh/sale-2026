import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import { shiftApi } from '../../api/shiftApi.js';
import { warehousesStore, employeesStore, vnd, formatDate } from '../../core/masterdata.js';
import { useConfirm } from '../../core/confirm.jsx';

const formatDateTimeStr = (dtVal, dateVal) => {
  if (!dtVal && !dateVal) return '—';
  if (dtVal) {
    try {
      const d = new Date(dtVal);
      if (!isNaN(d.getTime())) {
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = formatDate(d.toISOString().slice(0, 10));
        return `${time} ${date}`;
      }
    } catch { }
  }
  return formatDate(dateVal || dtVal);
};

const cleanNumber = (val) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).replace(/[^0-9.-]/g, '');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};



export function ShiftManager({ can, t: propT }) {
  const { t: i18nT } = useI18n();
  const t = propT || i18nT;
  const confirm = useConfirm();

  const warehouses = warehousesStore.use().items || [];
  const employees = employeesStore.use().items || [];

  // Default Bar warehouse
  const defaultBarWh = useMemo(() => {
    return warehouses.find((w) =>
      /bar|nhà hàng|nha hang|quầy/i.test(w.name || '') ||
      /bar/i.test(w.code || '')
    ) || warehouses[0];
  }, [warehouses]);

  const [currentShift, setCurrentShift] = useState(null);
  const [hasOpenShift, setHasOpenShift] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(false);

  // History list state
  const [shifts, setShifts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Open shift modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openForm, setOpenForm] = useState({
    name: 'Ca Sáng',
    warehouseId: '',
    openingCash: 1000000,
    note: '',
  });
  const [openingSubmitting, setOpeningSubmitting] = useState(false);

  // Close shift modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeForm, setCloseForm] = useState({
    actualCash: 0,
    handoverTo: '',
    note: '',
  });
  const [closingSubmitting, setClosingSubmitting] = useState(false);

  // Detail / Print shift modal
  const [detailShift, setDetailShift] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Drilldown state for active current shift
  const [currentInvoices, setCurrentInvoices] = useState([]);
  const [currentVouchers, setCurrentVouchers] = useState([]);
  const [showCurrentDrilldown, setShowCurrentDrilldown] = useState(false);
  const [currentDrillTab, setCurrentDrillTab] = useState('vouchers'); // 'vouchers' | 'invoices'

  // Fetch current active shift
  const fetchCurrentShift = async () => {
    setLoadingCurrent(true);
    try {
      const res = await shiftApi.getCurrent(defaultBarWh?.id);
      if (res?.hasOpenShift && res?.shift) {
        setHasOpenShift(true);
        setCurrentShift(res.shift);
        setCurrentInvoices(res.invoices || []);
        setCurrentVouchers(res.cashVouchers || []);
        setCloseForm((prev) => ({
          ...prev,
          actualCash: res.shift.expectedCash || 0,
        }));
      } else {
        setHasOpenShift(false);
        setCurrentShift(null);
        setCurrentInvoices([]);
        setCurrentVouchers([]);
      }
    } catch (err) {
      console.warn('Lỗi lấy ca hiện tại:', err);
    } finally {
      setLoadingCurrent(false);
    }
  };

  // Fetch shifts history
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await shiftApi.list({
        status: filterStatus || undefined,
        warehouseId: defaultBarWh?.id || undefined,
        page,
        pageSize: 15,
      });
      setShifts(res?.items || []);
      setTotal(res?.total || 0);
    } catch (err) {
      console.warn('Lỗi tải lịch sử ca:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentShift();
  }, [defaultBarWh?.id]);

  useEffect(() => {
    fetchHistory();
  }, [page, filterStatus, defaultBarWh?.id]);

  // Open Shift handler
  const handleOpenShift = async (e) => {
    e.preventDefault();
    setOpeningSubmitting(true);
    try {
      await shiftApi.open({
        name: openForm.name,
        warehouseId: openForm.warehouseId || defaultBarWh?.id,
        openingCash: cleanNumber(openForm.openingCash),
        note: openForm.note,
      });
      setShowOpenModal(false);
      fetchCurrentShift();
      fetchHistory();
      alert(`Mở ${openForm.name} thành công!`);
    } catch (err) {
      alert(err?.message || 'Lỗi khi mở ca làm việc.');
    } finally {
      setOpeningSubmitting(false);
    }
  };

  // Close Shift handler
  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!currentShift) return;

    const actualNum = cleanNumber(closeForm.actualCash);
    const diff = actualNum - Number(currentShift.expectedCash || 0);
    let confirmMsg = `Xác nhận kết thúc và bàn giao ${currentShift.name}?\n` +
      `- Tiền mặt dự kiến: ${vnd(currentShift.expectedCash || 0)}\n` +
      `- Tiền mặt thực tế: ${vnd(actualNum)}\n`;

    if (diff === 0) {
      confirmMsg += `✅ Tiền mặt khớp hoàn toàn.`;
    } else if (diff < 0) {
      confirmMsg += `⚠️ CẢNH BÁO: Tiền mặt THIẾU ${vnd(Math.abs(diff))}. Bạn có chắc chắn muốn chốt ca?`;
    } else {
      confirmMsg += `⚠️ Chú ý: Tiền mặt THỪA +${vnd(diff)}. Bạn có chắc chắn muốn chốt ca?`;
    }

    const ok = await confirm(confirmMsg);
    if (!ok) return;

    setClosingSubmitting(true);
    try {
      const res = await shiftApi.close(currentShift.id, {
        actualCash: actualNum,
        handoverTo: closeForm.handoverTo,
        note: closeForm.note,
      });
      setShowCloseModal(false);
      fetchCurrentShift();
      fetchHistory();
      alert(`Đã chốt và bàn giao ${currentShift.name} thành công!`);
      // Auto open print view
      handleViewDetail(res);
    } catch (err) {
      alert(err?.message || 'Lỗi khi đóng ca làm việc.');
    } finally {
      setClosingSubmitting(false);
    }
  };

  // View detail / print modal
  const handleViewDetail = async (shift) => {
    setDetailShift(shift);
    setDetailLoading(true);
    try {
      const res = await shiftApi.get(shift.id);
      setDetailData(res);
    } catch (err) {
      console.warn('Lỗi lấy chi tiết ca:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Print shift handover slip (thermal style 80mm)
  const handlePrintSlip = () => {
    const s = detailShift;
    const d = detailData;
    if (!s) return;

    const printWin = window.open('', '_blank', 'width=450,height=600');
    if (!printWin) return;

    const diff = s.difference || 0;
    const diffText = diff === 0 ? '0 đ (Khớp tiền)' : (diff > 0 ? `+${vnd(diff)} (Thừa)` : `-${vnd(Math.abs(diff))} (Thiếu)`);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Biên Bản Bàn Giao Ca - ${s.code}</title>
        <style>
          body { font-family: monospace, sans-serif; font-size: 13px; line-height: 1.4; padding: 12px; margin: 0; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .highlight { font-size: 14px; font-weight: bold; }
          .sign-area { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; }
          @media print {
            body { padding: 0; }
            @page { margin: 4mm; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="title">BIÊN BẢN BÀN GIAO CA</div>
          <div>Quầy Bar & Nhà Hàng</div>
          <div>Mã ca: <b>${s.code}</b> (${s.name})</div>
        </div>
        <div class="line"></div>
        <div class="row"><span>Thời gian mở:</span><span>${s.openedAt ? new Date(s.openedAt).toLocaleString('vi-VN') : '-'}</span></div>
        <div class="row"><span>Thời gian kết:</span><span>${s.closedAt ? new Date(s.closedAt).toLocaleString('vi-VN') : 'Đang hoạt động'}</span></div>
        <div class="row"><span>Người giao ca:</span><span><b>${s.openedBy || s.closedBy || '-'}</b></span></div>
        <div class="row"><span>Người nhận ca:</span><span><b>${s.handoverTo || '-'}</b></span></div>
        <div class="line"></div>
        <div class="row"><span>1. Tiền thối đầu ca:</span><span>${vnd(s.openingCash || 0)}</span></div>
        <div class="row"><span>2. Doanh thu xuất bán:</span><span>${vnd(s.totalSales || 0)}</span></div>
        <div class="row"><span>3. Thu tiền mặt:</span><span>${vnd(s.totalReceipts || 0)}</span></div>
        <div class="row"><span>4. Chi tiền mặt:</span><span>${vnd(s.totalPayments || 0)}</span></div>
        <div class="line"></div>
        <div class="row highlight"><span>5. Tiền dự kiến:</span><span>${vnd(s.expectedCash || 0)}</span></div>
        <div class="row highlight"><span>6. Tiền thực đếm:</span><span>${vnd(s.actualCash != null ? s.actualCash : s.expectedCash || 0)}</span></div>
        <div class="row highlight"><span>7. Chênh lệch:</span><span>${diffText}</span></div>
        ${s.note ? `<div style="margin-top:6px;font-style:italic">Ghi chú: ${s.note}</div>` : ''}
        ${Array.isArray(d?.cashVouchers) && d.cashVouchers.length > 0 ? `
          <div class="line"></div>
          <div style="font-weight:bold;margin:4px 0 2px;font-size:11px">DANH SÁCH PHIẾU THU TIỀN MẶT (${d.cashVouchers.length}):</div>
          ${d.cashVouchers.map(v => `
            <div class="row" style="font-size:10.5px">
              <span>${v.code} (${formatDateTimeStr(v.createdAt, v.date)}) - ${v.partnerName || v.name || 'Khách lẻ'}</span>
              <span>+${vnd(v.amount)}</span>
            </div>
          `).join('')}
        ` : ''}
        <div class="line"></div>
        <div class="sign-area">
          <div>
            <b>Người giao ca</b><br><br><br>
            <span>${s.openedBy || s.closedBy || ''}</span>
          </div>
          <div>
            <b>Người nhận ca</b><br><br><br>
            <span>${s.handoverTo || '................'}</span>
          </div>
        </div>
        <div class="center" style="margin-top: 25px; font-size: 11px; color: #555;">
          Hệ thống Quản lý Bán hàng & Kế toán 2026
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    printWin.document.write(html);
    printWin.document.close();
  };

  const closeDifference = useMemo(() => {
    if (!currentShift) return 0;
    return cleanNumber(closeForm.actualCash) - Number(currentShift.expectedCash || 0);
  }, [closeForm.actualCash, currentShift]);

  return (
    <div className="mb-shift-wrap" style={{ padding: '16px' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
            ⏱️ {t('minibar.shiftTitle') || 'Quản lý Ca Làm Việc & Bàn Giao Quầy Bar'}
          </h2>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {t('minibar.shiftSub') || 'Quản lý dòng tiền mặt đầu ca, tổng thu chi trong ca, kiểm đếm và biên bản bàn giao'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="tb"
            onClick={() => { fetchCurrentShift(); fetchHistory(); }}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px' }}
          >
            🔄 {t('common.refresh') || 'Làm mới'}
          </button>
        </div>
      </div>

      {/* ACTIVE CURRENT SHIFT BANNER */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px', marginBottom: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
        {loadingCurrent ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>{t('common.loading') || 'Đang tải trạng thái ca...'}</div>
        ) : hasOpenShift && currentShift ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '3px 10px', borderRadius: '14px', fontSize: '13px', fontWeight: '700' }}>
                    🟢 {t('minibar.shiftStatusOpen') || 'ĐANG HOẠT ĐỘNG'}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                    {currentShift.name} ({currentShift.code})
                  </h3>
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                  {t('minibar.staff') || 'Thu ngân'}: <b style={{ color: '#0284c7' }}>{currentShift.openedBy}</b> · {t('minibar.openTime') || 'Bắt đầu lúc'}: <b>{new Date(currentShift.openedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({formatDate(currentShift.openedAt)})</b>
                  {currentShift.warehouseName && ` · ${t('minibar.warehouse') || 'Kho'}: ${currentShift.warehouseName}`}
                </div>
              </div>

              <button
                type="button"
                className="pb"
                onClick={() => setShowCloseModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', fontSize: '14px', fontWeight: '700', background: '#ea580c', color: '#fff', borderRadius: '6px' }}
              >
                🤝 {t('minibar.closeShift') || 'Kết thúc ca & Bàn giao tiền'}
              </button>
            </div>

            {/* Shift Realtime KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>💵 {t('minibar.openBalance') || 'Tiền thối đầu ca'}</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#334155', marginTop: '4px' }}>
                  {vnd(currentShift.openingCash || 0)}
                </div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: '600' }}>🛒 {t('minibar.revenueInShift') || 'Doanh thu bán hàng'}</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#15803d', marginTop: '4px' }}>
                  {vnd(currentShift.totalSales || 0)}
                </div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: '600' }}>📥 {t('minibar.cashInShift') || 'Thu tiền mặt trong ca'}</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d4ed8', marginTop: '4px' }}>
                  +{vnd(currentShift.totalReceipts || 0)}
                </div>
              </div>
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', color: '#9a3412', fontWeight: '600' }}>📤 {t('minibar.cashPaidInShift') || 'Chi tiền mặt trong ca'}</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#c2410c', marginTop: '4px' }}>
                  -{vnd(currentShift.totalPayments || 0)}
                </div>
              </div>
              <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', color: '#854d0e', fontWeight: '700' }}>💰 {t('minibar.systemExpectedCash') || 'Tiền mặt dự kiến trong két'}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#a16207', marginTop: '4px' }}>
                  {vnd(currentShift.expectedCash || 0)}
                </div>
              </div>
            </div>

            {/* Realtime Drilldown Toggle & Tables for Active Shift */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  className="tb"
                  onClick={() => setShowCurrentDrilldown(!showCurrentDrilldown)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: showCurrentDrilldown ? '#eff6ff' : '#f8fafc',
                    color: showCurrentDrilldown ? '#1d4ed8' : '#334155',
                    border: '1px solid',
                    borderColor: showCurrentDrilldown ? '#93c5fd' : '#cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <span>{showCurrentDrilldown ? `▲ ${t('minibar.collapseDetail') || 'Thu gọn chi tiết'}` : `▼ ${t('minibar.shiftReceipts') || 'Chi tiết phiếu thu & hóa đơn trong ca'}`}</span>
                  <span style={{ background: '#0284c7', color: '#fff', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>
                    {(currentVouchers?.length || 0) + (currentInvoices?.length || 0)}
                  </span>
                </button>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Thu ngân đối soát: xem từng phiếu thu tiền mặt và hóa đơn bán hàng phát sinh trong ca
                </span>
              </div>

              {showCurrentDrilldown && (
                <div style={{ marginTop: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setCurrentDrillTab('vouchers')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: currentDrillTab === 'vouchers' ? '#0284c7' : '#cbd5e1',
                        background: currentDrillTab === 'vouchers' ? '#0284c7' : '#fff',
                        color: currentDrillTab === 'vouchers' ? '#fff' : '#475569',
                      }}
                    >
                      💵 Phiếu thu tiền mặt ({currentVouchers?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentDrillTab('invoices')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: currentDrillTab === 'invoices' ? '#047857' : '#cbd5e1',
                        background: currentDrillTab === 'invoices' ? '#047857' : '#fff',
                        color: currentDrillTab === 'invoices' ? '#fff' : '#475569',
                      }}
                    >
                      🛒 Hóa đơn xuất bán ({currentInvoices?.length || 0})
                    </button>
                  </div>

                  {currentDrillTab === 'vouchers' ? (
                    currentVouchers?.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
                        Chưa có phiếu thu / chi tiền mặt nào phát sinh trong ca hiện tại.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', background: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'left' }}>
                              <th style={{ padding: '8px 10px' }}>Số phiếu</th>
                              <th style={{ padding: '8px 10px' }}>Thời gian</th>
                              <th style={{ padding: '8px 10px' }}>Loại phiếu</th>
                              <th style={{ padding: '8px 10px' }}>Khách hàng / Bàn</th>
                              <th style={{ padding: '8px 10px' }}>Diễn giải</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Số tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentVouchers.map((v) => {
                              const isReceipt = v.type !== 'payment';
                              return (
                                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: '700', color: '#0284c7' }}>{v.code}</td>
                                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: '500', color: '#334155' }}>{formatDateTimeStr(v.createdAt, v.date)}</td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      background: isReceipt ? '#dcfce7' : '#fee2e2',
                                      color: isReceipt ? '#15803d' : '#b91c1c',
                                    }}>
                                      {isReceipt ? 'Phiếu thu' : 'Phiếu chi'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 10px', fontWeight: '600' }}>{v.partnerName || 'Khách vãng lai'}</td>
                                  <td style={{ padding: '8px 10px', color: '#64748b' }}>{v.name || '—'}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: isReceipt ? '#15803d' : '#b91c1c' }}>
                                    {isReceipt ? '+' : '-'}{vnd(v.amount)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    currentInvoices?.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
                        Chưa có hóa đơn bán hàng nào trong ca hiện tại.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', background: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'left' }}>
                              <th style={{ padding: '8px 10px' }}>Số phiếu</th>
                              <th style={{ padding: '8px 10px' }}>Thời gian</th>
                              <th style={{ padding: '8px 10px' }}>Khách hàng / Bàn</th>
                              <th style={{ padding: '8px 10px' }}>Ghi chú</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tổng tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentInvoices.map((inv) => (
                              <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: '700', color: '#047857' }}>{inv.no}</td>
                                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: '500', color: '#334155' }}>{formatDateTimeStr(inv.createdAt, inv.date)}</td>
                                <td style={{ padding: '8px 10px', fontWeight: '600' }}>{inv.partnerName || 'Khách vãng lai'}</td>
                                <td style={{ padding: '8px 10px', color: '#64748b' }}>{inv.note || '—'}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{vnd(inv.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 10px' }}>
            <span style={{ fontSize: '40px' }}>💼</span>
            <h3 style={{ margin: '10px 0 6px', fontSize: '17px', fontWeight: '700', color: '#1e293b' }}>
              {t('minibar.openShiftPrompt') || 'Hiện chưa có ca làm việc nào đang mở'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#64748b' }}>
              {t('minibar.openShiftPromptSub') || 'Vui lòng mở ca làm việc mới và nhập số tiền lẻ đầu ca để bắt đầu phục vụ và theo dõi dòng tiền chính xác.'}
            </p>
            <button
              type="button"
              className="pb"
              onClick={() => {
                setOpenForm({
                  name: 'Ca Sáng',
                  warehouseId: defaultBarWh?.id || '',
                  openingCash: 1000000,
                  note: '',
                });
                setShowOpenModal(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 20px', fontSize: '14px', fontWeight: '700', borderRadius: '6px' }}
            >
              ➕ {t('minibar.openNewShiftPrompt') || 'Bắt đầu Mở ca làm việc mới'}
            </button>
          </div>
        )}
      </div>

      {/* SHIFT HISTORY SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#334155' }}>
          📋 {t('minibar.shiftHistory') || 'Lịch sử các ca làm việc'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            style={{ height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
          >
            <option value="">{t('common.all') || 'Tất cả trạng thái'}</option>
            <option value="open">{t('minibar.shiftStatusOpen') || 'Đang mở'}</option>
            <option value="closed">{t('minibar.shiftStatusClosed') || 'Đã đóng'}</option>
          </select>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {t('common.total') || 'Tổng'}: <b>{total}</b> {t('minibar.shiftName') || 'ca'}
          </span>
        </div>
      </div>

      {/* History table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
              <th style={{ padding: '12px 14px' }}>{t('minibar.shiftCode') || 'Mã ca'}</th>
              <th style={{ padding: '12px 14px' }}>{t('minibar.shiftName') || 'Tên ca'}</th>
              <th style={{ padding: '12px 14px' }}>{t('minibar.openTime') || 'Bắt đầu'}</th>
              <th style={{ padding: '12px 14px' }}>{t('minibar.closeTime') || 'Kết thúc'}</th>
              <th style={{ padding: '12px 14px' }}>{t('minibar.staff') || 'Thu ngân'}</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>{t('minibar.openBalance') || 'Tiền đầu ca'}</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>{t('minibar.revenueInShift') || 'Doanh thu'}</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>{t('minibar.actualCash') || 'Tiền thực tế'}</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>{t('minibar.cashDifference') || 'Chênh lệch'}</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>{t('common.status') || 'Trạng thái'}</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>{t('common.actions') || 'Thao tác'}</th>
            </tr>
          </thead>
          <tbody>
            {historyLoading ? (
              <tr><td colSpan="11" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>{t('common.loading') || 'Đang tải lịch sử ca...'}</td></tr>
            ) : shifts.length === 0 ? (
              <tr><td colSpan="11" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>{t('common.empty') || 'Chưa có ca làm việc nào.'}</td></tr>
            ) : (
              shifts.map((s) => {
                const diff = s.difference || 0;
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0369a1', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                        {s.code}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1e293b' }}>
                      {s.name}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12.5px' }}>
                      {s.openedAt ? new Date(s.openedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '-'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12.5px' }}>
                      {s.closedAt ? new Date(s.closedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : (t('minibar.shiftStatusOpen') || 'Đang mở')}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>
                      <b>{s.openedBy}</b>
                      {s.handoverTo && <div style={{ fontSize: '11px', color: '#64748b' }}>➔ {s.handoverTo}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>
                      {vnd(s.openingCash || 0)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', color: '#047857' }}>
                      {vnd(s.totalSales || 0)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700' }}>
                      {s.actualCash != null ? vnd(s.actualCash) : vnd(s.expectedCash || 0)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {s.status === 'open' ? (
                        <span style={{ color: '#64748b', fontSize: '12px' }}>{t('minibar.shiftStatusOpen') || 'Đang chạy'}</span>
                      ) : diff === 0 ? (
                        <span style={{ color: '#16a34a', fontWeight: '700', fontSize: '12px' }}>🟢 {t('minibar.balanced') || 'Khớp'}</span>
                      ) : diff < 0 ? (
                        <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '12px' }}>🔴 {vnd(diff)}</span>
                      ) : (
                        <span style={{ color: '#ca8a04', fontWeight: '700', fontSize: '12px' }}>🟡 +{vnd(diff)}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          background: s.status === 'open' ? '#dcfce7' : '#f1f5f9',
                          color: s.status === 'open' ? '#166534' : '#64748b',
                        }}
                      >
                        {s.status === 'open' ? (t('minibar.shiftStatusOpen') || 'Đang mở') : (t('minibar.shiftStatusClosed') || 'Đã đóng')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="tb"
                        onClick={() => handleViewDetail(s)}
                        style={{ padding: '3px 8px', fontSize: '12px', color: '#0284c7', fontWeight: '600' }}
                      >
                        📄 {t('minibar.viewDetail') || 'Chi tiết & In'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: OPEN SHIFT */}
      {showOpenModal && (
        <div className="confirm-backdrop" onMouseDown={() => !openingSubmitting && setShowOpenModal(false)}>
          <div className="confirm-box" style={{ width: 440 }} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '17px', margin: '0 0 14px', color: '#0f172a' }}>
              ➕ {t('minibar.openNewShift') || 'Mở Ca Làm Việc Mới'}
            </h3>
            <form onSubmit={handleOpenShift}>
              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px' }}>{t('minibar.shiftName') || 'Tên ca'}</label>
                <select
                  value={openForm.name}
                  onChange={(e) => setOpenForm({ ...openForm, name: e.target.value })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Ca Sáng">Ca Sáng (06:00 - 14:00)</option>
                  <option value="Ca Chiều">Ca Chiều (14:00 - 22:00)</option>
                  <option value="Ca Tối / Đêm">Ca Tối / Đêm (22:00 - 06:00)</option>
                  <option value="Ca Cả Ngày">Ca Cả Ngày</option>
                </select>
              </div>

              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px' }}>
                  {t('minibar.openBalance') || 'Tiền thối / tiền lẻ đầu ca (VNĐ)'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={openForm.openingCash}
                  onChange={(e) => setOpenForm({ ...openForm, openingCash: e.target.value })}
                  placeholder="0"
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: '700' }}
                />
                <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600' }}>= {vnd(cleanNumber(openForm.openingCash))}</span>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px' }}>{t('common.note') || 'Ghi chú mở ca'}</label>
                <textarea
                  rows="2"
                  value={openForm.note}
                  onChange={(e) => setOpenForm({ ...openForm, note: e.target.value })}
                  placeholder={t('common.note') || 'Ghi chú thêm nếu có...'}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="tb" disabled={openingSubmitting} onClick={() => setShowOpenModal(false)}>
                  {t('common.cancel') || 'Hủy'}
                </button>
                <button type="submit" className="pb" disabled={openingSubmitting} style={{ padding: '8px 18px', fontWeight: '600' }}>
                  {openingSubmitting ? (t('common.loading') || 'Đang mở ca...') : (t('minibar.confirmOpenShift') || 'Xác nhận Mở ca')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CLOSE SHIFT & HANDOVER */}
      {showCloseModal && currentShift && (
        <div className="confirm-backdrop" onMouseDown={() => !closingSubmitting && setShowCloseModal(false)}>
          <div className="confirm-box" style={{ width: 480 }} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '17px', margin: '0 0 12px', color: '#c2410c' }}>
              🤝 {t('minibar.closeShift') || 'Kết Ca & Bàn Giao Tiền'} ({currentShift.name})
            </h3>

            {/* Financial summary before counting */}
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '13.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>{t('minibar.openBalance') || 'Tiền thối đầu ca'}:</span>
                <b>{vnd(currentShift.openingCash || 0)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>{t('minibar.revenueInShift') || 'Doanh thu bán hàng'}:</span>
                <b>{vnd(currentShift.totalSales || 0)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>{t('minibar.cashInShift') || 'Tổng thu tiền mặt'}:</span>
                <b style={{ color: '#16a34a' }}>+{vnd(currentShift.totalReceipts || 0)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>{t('minibar.cashPaidInShift') || 'Tổng chi tiền mặt'}:</span>
                <b style={{ color: '#dc2626' }}>-{vnd(currentShift.totalPayments || 0)}</b>
              </div>
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '14.5px' }}>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>{t('minibar.systemExpectedCash') || 'Tiền mặt dự kiến trong két'}:</span>
                <b style={{ color: '#a16207', fontSize: '16px' }}>{vnd(currentShift.expectedCash || 0)}</b>
              </div>
            </div>

            <form onSubmit={handleCloseShift}>
              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginBottom: '5px' }}>
                  {t('minibar.actualCash') || 'Tiền mặt thực tế đếm trong két (VNĐ)'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={closeForm.actualCash}
                  onChange={(e) => setCloseForm({ ...closeForm, actualCash: e.target.value })}
                  placeholder="0"
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '6px', border: '2px solid #0284c7', fontSize: '16px', fontWeight: '700' }}
                />
                <div style={{ marginTop: '3px', fontSize: '12.5px', color: '#0369a1', fontWeight: '600' }}>
                  = {vnd(cleanNumber(closeForm.actualCash))}
                </div>

                {/* Live difference warning */}
                <div style={{
                  marginTop: '6px', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '600',
                  background: closeDifference === 0 ? '#dcfce7' : closeDifference < 0 ? '#fee2e2' : '#fef9c3',
                  color: closeDifference === 0 ? '#166534' : closeDifference < 0 ? '#991b1b' : '#854d0e',
                  border: `1px solid ${closeDifference === 0 ? '#86efac' : closeDifference < 0 ? '#fca5a5' : '#fde047'}`
                }}>
                  {closeDifference === 0 ? `✅ ${t('minibar.balanced') || 'Tiền mặt khớp hoàn toàn'}` : closeDifference < 0 ? `⚠️ ${t('minibar.shortage') || 'THIẾU TIỀN'}: -${vnd(Math.abs(closeDifference))}` : `⚠️ ${t('minibar.surplus') || 'THỪA TIỀN'}: +${vnd(closeDifference)}`}
                </div>
              </div>

              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px' }}>
                  {t('minibar.handoverTo') || 'Người nhận bàn giao ca tiếp theo'}
                </label>
                <input
                  type="text"
                  value={closeForm.handoverTo}
                  onChange={(e) => setCloseForm({ ...closeForm, handoverTo: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn B, Ca chiều..."
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px' }}>{t('common.note') || 'Ghi chú kết ca'}</label>
                <textarea
                  rows="2"
                  value={closeForm.note}
                  onChange={(e) => setCloseForm({ ...closeForm, note: e.target.value })}
                  placeholder={t('minibar.closeShiftNotePlaceholder') || 'Giải trình chênh lệch hoặc việc cần bàn giao ca sau...'}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="tb" disabled={closingSubmitting} onClick={() => setShowCloseModal(false)}>
                  {t('common.cancel') || 'Hủy'}
                </button>
                <button type="submit" className="pb" disabled={closingSubmitting} style={{ padding: '8px 18px', fontWeight: '700', background: '#ea580c', color: '#fff' }}>
                  {closingSubmitting ? (t('common.loading') || 'Đang chốt ca...') : (t('minibar.confirmCloseShift') || 'Xác nhận Bàn giao & Đóng ca')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DETAIL & PRINT SLIP */}
      {detailShift && (
        <div className="confirm-backdrop" onMouseDown={() => setDetailShift(null)}>
          <div className="confirm-box" style={{ width: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                {t('minibar.handoverReport') || 'Biên Bản Bàn Giao Ca'} ({detailShift.code})
              </h3>
              <button type="button" className="xbtn" onClick={() => setDetailShift(null)}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>{t('common.loading') || 'Đang tải chi tiết ca...'}</div>
              ) : (
                <>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px', fontSize: '13px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>{t('minibar.shiftName') || 'Tên ca'}: <b>{detailShift.name}</b></div>
                      <div>{t('common.status') || 'Trạng thái'}: <b>{detailShift.status === 'open' ? (t('minibar.shiftStatusOpen') || '🟢 Đang mở') : (t('minibar.shiftStatusClosed') || 'Đã đóng')}</b></div>
                      <div>{t('minibar.openTime') || 'Bắt đầu'}: <b>{detailShift.openedAt ? new Date(detailShift.openedAt).toLocaleString('vi-VN') : '-'}</b></div>
                      <div>{t('minibar.closeTime') || 'Kết thúc'}: <b>{detailShift.closedAt ? new Date(detailShift.closedAt).toLocaleString('vi-VN') : (t('minibar.shiftStatusOpen') || 'Đang chạy')}</b></div>
                      <div>{t('minibar.staff') || 'Người mở ca'}: <b>{detailShift.openedBy}</b></div>
                      <div>{t('minibar.handoverTo') || 'Người nhận bàn giao'}: <b>{detailShift.handoverTo || '-'}</b></div>
                    </div>
                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>{t('minibar.openBalance') || 'Tiền thối đầu ca'}: <b>{vnd(detailShift.openingCash || 0)}</b></div>
                      <div>{t('minibar.revenueInShift') || 'Doanh thu bán hàng'}: <b style={{ color: '#047857' }}>{vnd(detailShift.totalSales || 0)}</b></div>
                      <div>{t('minibar.cashInShift') || 'Thu tiền mặt'}: <b style={{ color: '#16a34a' }}>+{vnd(detailShift.totalReceipts || 0)}</b></div>
                      <div>{t('minibar.cashPaidInShift') || 'Chi tiền mặt'}: <b style={{ color: '#dc2626' }}>-{vnd(detailShift.totalPayments || 0)}</b></div>
                      <div>{t('minibar.systemExpectedCash') || 'Tiền dự kiến'}: <b>{vnd(detailShift.expectedCash || 0)}</b></div>
                      <div>{t('minibar.actualCash') || 'Tiền thực tế'}: <b>{vnd(detailShift.actualCash != null ? detailShift.actualCash : detailShift.expectedCash || 0)}</b></div>
                    </div>
                    <div style={{ marginTop: '8px', fontWeight: '700', fontSize: '14px', color: (detailShift.difference || 0) === 0 ? '#16a34a' : (detailShift.difference || 0) < 0 ? '#dc2626' : '#ca8a04' }}>
                      {t('minibar.cashDifference') || 'Chênh lệch'}: {(detailShift.difference || 0) === 0 ? `🟢 ${t('minibar.balanced') || 'Khớp tiền'}` : (detailShift.difference || 0) < 0 ? `🔴 ${t('minibar.shortage') || 'Thiếu'}: -${vnd(Math.abs(detailShift.difference))}` : `🟡 ${t('minibar.surplus') || 'Thừa'}: +${vnd(detailShift.difference)}`}
                    </div>
                  </div>

                  {/* List of invoices in shift */}
                  <h4 style={{ margin: '10px 0 6px', fontSize: '13.5px' }}>
                    🛒 {t('minibar.invoicesInShift') || 'Hóa đơn bán hàng trong ca'} ({detailData?.invoices?.length || 0})
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '14px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '6px' }}>{t('minibar.docNo') || 'Số phiếu'}</th>
                        <th style={{ padding: '6px' }}>{t('common.time') || 'Thời gian'}</th>
                        <th style={{ padding: '6px' }}>{t('minibar.customer') || 'Khách hàng'} / {t('minibar.table') || 'Bàn'}</th>
                        <th style={{ padding: '6px', textAlign: 'right' }}>{t('common.total') || 'Tổng tiền'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailData?.invoices || []).map((inv) => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px', fontFamily: 'monospace', fontWeight: '600' }}>{inv.no}</td>
                          <td style={{ padding: '6px', whiteSpace: 'nowrap', color: '#475569' }}>{formatDateTimeStr(inv.createdAt, inv.date)}</td>
                          <td style={{ padding: '6px' }}>{inv.partnerName || (t('minibar.defaultCustomer') || 'Khách vãng lai')} ({inv.note || ''})</td>
                          <td style={{ padding: '6px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{vnd(inv.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* List of cash vouchers in shift */}
                  <h4 style={{ margin: '14px 0 6px', fontSize: '13.5px', color: '#1e40af' }}>
                    💵 {t('minibar.shiftReceipts') || 'Phiếu thu tiền mặt trong ca'} ({detailData?.cashVouchers?.length || 0})
                  </h4>
                  {(!detailData?.cashVouchers || detailData.cashVouchers.length === 0) ? (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', marginBottom: '14px' }}>
                      {t('minibar.noReceiptsInShift') || 'Chưa có phiếu thu / chi tiền mặt trong ca này.'}
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '14px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '6px' }}>{t('minibar.docNo') || 'Số phiếu'}</th>
                          <th style={{ padding: '6px' }}>{t('common.time') || 'Thời gian'}</th>
                          <th style={{ padding: '6px' }}>{t('minibar.customer') || 'Khách hàng'} / {t('common.note') || 'Diễn giải'}</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>{t('minibar.amount') || 'Số tiền'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.cashVouchers.map((cv) => (
                          <tr key={cv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px', fontFamily: 'monospace', fontWeight: '600', color: '#0284c7' }}>{cv.code}</td>
                            <td style={{ padding: '6px', whiteSpace: 'nowrap', color: '#475569' }}>{formatDateTimeStr(cv.createdAt, cv.date)}</td>
                            <td style={{ padding: '6px' }}>{cv.partnerName || (t('minibar.defaultCustomer') || 'Khách lẻ')} ({cv.name || ''})</td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: '700', color: cv.type !== 'payment' ? '#15803d' : '#b91c1c' }}>
                              {cv.type !== 'payment' ? '+' : '-'}{vnd(cv.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <button type="button" className="tb" onClick={() => setDetailShift(null)}>
                {t('common.close') || 'Đóng'}
              </button>
              <button type="button" className="pb" onClick={handlePrintSlip} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px' }}>
                🖨️ {t('minibar.printShiftSummary') || 'In biên bản bàn giao ca'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

