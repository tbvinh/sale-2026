import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import { inventoryApi } from '../../api/inventoryApi.js';
import { cashApi } from '../../api/cashApi.js';
import { warehousesStore, vnd, formatDate, formatDateTime } from '../../core/masterdata.js';
import { printThermalReceipt } from '../inventory/voucher.js';

const lineTotal = (lines) => (lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);

const currentMonthStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
};

export function HistoryView({ can, t: propT }) {
  const { t: i18nT } = useI18n();
  const t = propT || i18nT;
  const warehouses = warehousesStore.use().items || [];

  // Default to Bar/Restaurant warehouse if present
  const defaultBarWh = useMemo(() => {
    return warehouses.find((w) =>
      /bar|nhà hàng|nha hang|quầy/i.test(w.name || '') ||
      /bar/i.test(w.code || '')
    );
  }, [warehouses]);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [docs, setDocs] = useState([]);
  const [cashSummary, setCashSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Derive dateFrom and dateTo based on selectedMonth (YYYY-MM)
  const { dateFrom, dateTo } = useMemo(() => {
    if (!selectedMonth) return { dateFrom: undefined, dateTo: undefined };
    const [yStr, mStr] = selectedMonth.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(y) || isNaN(m)) return { dateFrom: undefined, dateTo: undefined };
    const from = `${selectedMonth}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
    return { dateFrom: from, dateTo: to };
  }, [selectedMonth]);

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await inventoryApi.list({
        type: 'export',
        page,
        pageSize: 20,
        warehouseId: selectedWarehouseId || undefined,
        q: q || undefined,
        dateFrom,
        dateTo,
      });
      const items = Array.isArray(res) ? res : (res?.items || []);
      setDocs(items);
      setTotal(res?.total || items.length);

      // Load cash summary for this warehouse & month
      try {
        const cashRes = await cashApi.book({
          warehouseId: selectedWarehouseId || undefined,
          dateFrom: dateFrom || (selectedMonth ? undefined : '2000-01-01'),
          dateTo: dateTo || (selectedMonth ? undefined : '2099-12-31'),
        });
        setCashSummary(cashRes);
      } catch (cErr) {
        console.warn('Lỗi tải tổng hợp thu chi theo kho:', cErr);
      }
    } catch (err) {
      console.warn('Lỗi tải lịch sử bán hàng:', err);
      setError(err?.message || 'Không thể tải lịch sử bán hàng. Vui lòng kiểm tra quyền truy cập.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [page, q, selectedWarehouseId, selectedMonth]);

  const handlePrint = (doc) => {
    printThermalReceipt({ ...doc, isSales: true }, t);
  };

  const totalPageRevenue = useMemo(() => {
    return docs.reduce((sum, d) => sum + lineTotal(d.lines), 0);
  }, [docs]);

  const totalPages = Math.ceil(total / 20) || 1;

  const [exporting, setExporting] = useState(false);
  const canExport = can?.('minibar', 'export') || can?.('inventory', 'export');

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await inventoryApi.exportSalesHistoryExcel({
        warehouseId: selectedWarehouseId || undefined,
        dateFrom,
        dateTo,
        q: q || undefined,
      });
    } catch (err) {
      alert(err?.message || 'Không thể xuất file Excel lịch sử bán hàng.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mb-history-wrap" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
            {t('minibar.historyTitle') || 'Lịch sử Bán hàng & Tổng hợp Thu chi Kho Bar'}
          </h2>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {t('minibar.historySub') || 'Tổng hợp phiếu xuất kho bán hàng dịch vụ và phiếu thu tiền mặt theo kho Bar / Nhà hàng'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {canExport && (
            <button
              type="button"
              className="tb"
              disabled={exporting}
              onClick={handleExportExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '13px', borderRadius: '6px', color: '#047857', fontWeight: '600' }}
              title="Xuất danh sách bán hàng & tổng hợp thu chi ra file Excel (.xlsx)"
            >
              <span>{exporting ? '⏳' : '📊'}</span> {exporting ? (t('minibar.exporting') || 'Đang xuất…') : (t('common.exportExcel') || 'Xuất Excel')}
            </button>
          )}
          <button
            type="button"
            className="tb"
            onClick={fetchDocs}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px' }}
          >
            🔄 {t('common.refresh') || 'Làm mới'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', color: '#b91c1c', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⚠️</span>
          <span style={{ fontSize: '13.5px', fontWeight: '500' }}>{error}</span>
          <button
            type="button"
            onClick={fetchDocs}
            style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >
            {t('common.retry') || 'Thử lại'}
          </button>
        </div>
      )}

      {/* KPI Cards for the selected warehouse & month */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>📦 {t('minibar.appliedWarehouse') || 'Kho áp dụng'}</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#0369a1', marginTop: '4px' }}>
            {warehouses.find((w) => w.id === selectedWarehouseId)?.name || (t('common.all') ? `${t('common.all')} ${t('minibar.warehouse') || 'kho'}` : 'Tất cả kho')}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>🛒 {t('minibar.pageRevenue') || 'Doanh thu xuất bán (Trang này)'}</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#047857', marginTop: '4px' }}>
            {vnd(totalPageRevenue)}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>
            💵 {t('minibar.cashReceipts') || 'Thu tiền mặt'} {selectedMonth ? `(${t('minibar.filterMonth') || 'Tháng'} ${selectedMonth.slice(5)}/${selectedMonth.slice(0, 4)})` : ''}
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#b45309', marginTop: '4px' }}>
            {vnd(cashSummary?.totalReceipt || 0)}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>📑 {t('minibar.totalExportDocs') || 'Tổng số phiếu xuất'}</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#334155', marginTop: '4px' }}>
            {total}
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div className="searchbox" style={{ maxWidth: '280px', width: '100%' }}>
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            value={q}
            placeholder={t('minibar.searchHistory') || 'Tìm theo số phiếu, tên khách, bàn...'}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            style={{ width: '100%', height: '36px', padding: '0 28px', borderRadius: '6px' }}
          />
          {q && <button type="button" className="xbtn" onClick={() => setQ('')}>✕</button>}
        </div>

        {/* Month Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{t('minibar.filterMonth') || 'Tháng'}:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(e.target.value); setPage(1); }}
            style={{ height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13.5px' }}
          />
          {selectedMonth ? (
            <button
              type="button"
              className="tb"
              onClick={() => { setSelectedMonth(''); setPage(1); }}
              style={{ height: '36px', padding: '0 10px', fontSize: '12px', borderRadius: '6px' }}
              title="Xem tất cả các tháng"
            >
              ✕ {t('common.all') || 'Tất cả'}
            </button>
          ) : (
            <button
              type="button"
              className="tb"
              onClick={() => { setSelectedMonth(currentMonthStr()); setPage(1); }}
              style={{ height: '36px', padding: '0 10px', fontSize: '12px', borderRadius: '6px' }}
              title="Lọc theo tháng hiện tại"
            >
              📅 {t('inv.thisMonth') || 'Tháng này'}
            </button>
          )}
        </div>

        {/* Warehouse Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{t('minibar.warehouse') || 'Kho'}:</span>
          <select
            value={selectedWarehouseId}
            onChange={(e) => { setSelectedWarehouseId(e.target.value); setPage(1); }}
            style={{ height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13.5px' }}
          >
            <option value="">{t('inv.allWarehouses') || 'Tất cả kho'}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <span style={{ fontSize: '13px', color: '#64748b', marginLeft: 'auto' }}>
          {t('common.total') || 'Tổng'}: <b>{total}</b> {t('minibar.totalExportDocs') || 'phiếu xuất kho'}
        </span>
      </div>

      {/* History table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
              <th style={{ padding: '12px 14px', width: '120px' }}>{t('minibar.docNo') || 'Số phiếu xuất'}</th>
              <th style={{ padding: '12px 14px', width: '150px' }}>{t('minibar.docDate') || 'Ngày giờ'}</th>
              <th style={{ padding: '12px 14px' }}>{t('minibar.appliedWarehouse') || 'Kho xuất'}</th>
              <th style={{ padding: '12px 14px' }}>{t('minibar.customer') || 'Khách hàng'}</th>
              <th style={{ padding: '12px 14px' }}>{t('minibar.table') || 'Bàn'} / {t('common.note') || 'Diễn giải'}</th>
              <th style={{ padding: '12px 14px', width: '80px', textAlign: 'center' }}>{t('minibar.qty') || 'Số món'}</th>
              <th style={{ padding: '12px 14px', width: '130px', textAlign: 'right' }}>{t('common.total') || 'Tổng tiền'}</th>
              <th style={{ padding: '12px 14px', width: '110px', textAlign: 'center' }}>{t('common.actions') || 'Thao tác'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                  {t('common.loading') || 'Đang tải dữ liệu...'}
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                  <div>{t('common.empty') || 'Chưa có hóa đơn bán hàng nào phù hợp bộ lọc.'}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
                    {selectedWarehouseId && (
                      <button
                        type="button"
                        onClick={() => setSelectedWarehouseId('')}
                        style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '5px 12px', borderRadius: '6px', fontSize: '12.5px', cursor: 'pointer', fontWeight: '500' }}
                      >
                        🔄 {t('common.all') || 'Tất cả kho'}
                      </button>
                    )}
                    {selectedMonth && (
                      <button
                        type="button"
                        onClick={() => setSelectedMonth('')}
                        style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '5px 12px', borderRadius: '6px', fontSize: '12.5px', cursor: 'pointer', fontWeight: '500' }}
                      >
                        📅 {t('inv.allTime') || 'Toàn thời gian'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              docs.map((doc) => {
                const totalAmount = lineTotal(doc.lines);
                const itemCount = (doc.lines || []).length;
                return (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0369a1', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                        {doc.no}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {doc.createdAt ? formatDateTime(doc.createdAt) : formatDate(doc.date)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 7px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                        {doc.warehouseOut?.name || 'Kho Bar'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: '500', color: '#1e293b' }}>
                      {doc.partner?.name || 'Khách vãng lai'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>
                      {doc.note || '-'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '600' }}>
                      {itemCount}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                      {vnd(totalAmount)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="tb"
                        onClick={() => handlePrint(doc)}
                        style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '600', color: '#0284c7' }}
                      >
                        🧾 {t('common.print') || 'In'}
                      </button>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
          <button
            type="button"
            className="tb"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px' }}
          >
            ◀ Trang trước
          </button>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Trang <b>{page}</b> / <b>{totalPages}</b>
          </span>
          <button
            type="button"
            className="tb"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px' }}
          >
            Trang sau ▶
          </button>
        </div>
      )}
    </div>
  );
}
