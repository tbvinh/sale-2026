import { http } from '../core/http.js';

export const tableOrderApi = {
  // Lấy map toàn bộ order đang hoạt động theo tableId
  getAllActive: () => http.get('/table-orders/active'),

  // Lấy chi tiết order đang hoạt động của 1 bàn
  getActive: (tableId) => http.get(`/table-orders/active/${encodeURIComponent(tableId)}`),

  // Mở order mới cho bàn
  open: (payload) => http.post('/table-orders/open', payload),

  // Lưu/thêm danh sách món mới (pending)
  saveItems: (tableId, items) => http.post(`/table-orders/${encodeURIComponent(tableId)}/items`, items),

  // Gửi bếp/quầy bar các món đang chờ
  sendKitchen: (tableId) => http.post(`/table-orders/${encodeURIComponent(tableId)}/send-kitchen`),

  // Hủy 1 món
  cancelItem: (tableId, itemId, reason) => http.post(`/table-orders/${encodeURIComponent(tableId)}/items/${itemId}/cancel`, { reason }),

  // Chuyển bàn
  transfer: (tableId, targetTableId) => http.post(`/table-orders/${encodeURIComponent(tableId)}/transfer`, { targetTableId }),

  // Hủy bàn
  cancelOrder: (tableId) => http.post(`/table-orders/${encodeURIComponent(tableId)}/cancel-order`),

  // Hoàn tất bill thanh toán
  complete: (tableId, invDocId) => http.post(`/table-orders/${encodeURIComponent(tableId)}/complete`, { invDocId }),
};

export default tableOrderApi;

