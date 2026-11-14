import { http } from '../core/http.js';
import { getCompanyId } from '../core/tenant.js';

export const kitchenApi = {
  /**
   * Lấy danh sách các đơn / đợt chờ chế biến
   * @param {boolean} includeCompleted
   */
  getOrders: (includeCompleted = false) => {
    const url = `/kitchen/orders${includeCompleted ? '?includeCompleted=true' : ''}`;
    return http.get(url);
  },

  /**
   * Cập nhật trạng thái 1 món (sent | preparing | served | cancelled)
   */
  updateItemStatus: (itemId, status, cancelReason = '') => {
    return http.post(`/kitchen/items/${itemId}/status`, { status, cancelReason });
  },

  /**
   * Bếp nhận chế biến toàn bộ đợt (chuyển sang 'preparing')
   */
  preparingRound: (orderId, round) => {
    return http.post(`/kitchen/orders/${orderId}/rounds/${round}/preparing`, {});
  },

  /**
   * Hoàn thành toàn bộ đợt (chuyển sang 'served')
   */
  completeRound: (orderId, round) => {
    return http.post(`/kitchen/orders/${orderId}/rounds/${round}/complete`, {});
  },

  /**
   * Đăng ký nhận thông báo SSE thời gian thực từ SmallRye Mutiny (cách ly theo Tenant)
   */
  subscribeEvents: (onMessage, onError, companyId) => {
    try {
      const cid = companyId !== undefined ? companyId : getCompanyId();
      const query = cid ? `?companyId=${encodeURIComponent(cid)}` : '';
      const es = new EventSource(`/api/kitchen/stream${query}`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (_) {
          onMessage?.(event.data);
        }
      };
      es.onerror = (err) => {
        onError?.(err);
      };
      return () => {
        try {
          es.close();
        } catch (_) {}
      };
    } catch (err) {
      onError?.(err);
      return () => {};
    }
  },
};
