import { http, downloadFile } from '../core/http.js';

// Query string chỉ nhận tham số có giá trị (bỏ '' / null / undefined) — FE-AP9
const toQS = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
  const qs = p.toString();
  return qs ? `?${qs}` : '';
};

export const inventoryApi = {
  // Tìm kiếm/lọc/phân trang phiếu — hợp đồng giống MasterResource: {q, type, dateFrom, dateTo, page, pageSize, sort, dir}
  // Server trả { items: [...], total: N }; không tham số ⇒ tối đa 10.000 dòng (export/đối chiếu nhỏ)
  list: (params) => http.get('/inventory/docs' + toQS(params)),
  get: (id) => http.get(`/inventory/docs/${id}`),
  create: (doc) => http.post('/inventory/docs', doc),
  importDocs: (docs) => http.post('/inventory/docs/import', docs),
  update: (id, doc) => http.put(`/inventory/docs/${id}`, doc),
  delete: (id, deleteLinked) => http.delete(`/inventory/docs/${id}${deleteLinked != null ? `?deleteLinked=${deleteLinked}` : ''}`),
  bulkDelete: (ids, deleteLinked) => http.post(`/inventory/docs/bulk-delete${deleteLinked != null ? `?deleteLinked=${deleteLinked}` : ''}`, ids),
  exportExcel: (id, no) => downloadFile(`/inventory/docs/${id}/export-excel`, `phieu-${no || id}.xlsx`),
  exportSalesHistoryExcel: (params) => downloadFile('/inventory/docs/export-sales-excel' + toQS(params), 'lich-su-ban-hang-kho-bar.xlsx'),

  // Báo cáo kho (4-7) — cùng hợp đồng { items, totals, ... }
  materialLedger: (params) => http.get('/inventory/reports/material-ledger' + toQS(params)),
  exportMaterialLedgerExcel: (params) => downloadFile('/inventory/reports/material-ledger/export-excel' + toQS(params), 'so-chi-tiet-vat-tu.xlsx'),
  stockSummary: (params) => http.get('/inventory/reports/stock-summary' + toQS(params)),
  sales: (params) => http.get('/inventory/reports/sales' + toQS(params)),
  salesCogs: (params) => http.get('/inventory/reports/sales-cogs' + toQS(params)),
};

export default inventoryApi;


