import { http } from '../core/http.js';

// Query string chỉ nhận tham số có giá trị (bỏ '' / null / undefined) — FE-AP9
const toQS = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
  const qs = p.toString();
  return qs ? `?${qs}` : '';
};

export const cashApi = {
  // {q, type, dateFrom, dateTo, page, pageSize, sort, dir} -> { items, total }
  list: (params, opts) => http.get('/cash/vouchers' + toQS(params), opts),
  get: (id) => http.get(`/cash/vouchers/${id}`),
  create: (voucher) => http.post('/cash/vouchers', voucher),
  update: (id, voucher) => http.put(`/cash/vouchers/${id}`, voucher),
  delete: (id) => http.delete(`/cash/vouchers/${id}`),
  // Sổ quỹ: {dateFrom, dateTo, accountId} -> { opening, totalReceipt, totalPayment, closing, items }
  book: (params, opts) => http.get('/cash/book' + toQS(params), opts),
  // Tạo phiếu thu/chi từ phiếu nhập/xuất kho (server tự tính số tiền + đối tác)
  // Body rỗng {} để http gửi Content-Type: application/json (endpoint @Consumes JSON)
  fromInventory: (docId) => http.post(`/cash/vouchers/from-inventory/${docId}`, {}),
  // Lấy phiếu thu/chi theo phiếu kho nguồn
  getBySource: (docId) => http.get(`/cash/vouchers/by-source/${docId}`),
};

export default cashApi;
