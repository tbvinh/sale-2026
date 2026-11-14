package com.vinhcancode.sales.service;

import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dịch vụ phát thông báo thời gian thực sử dụng SmallRye Mutiny cho Màn hình Bếp / Bar (KDS),
 * hỗ trợ đa chi nhánh / đa công ty (Multi-tenant isolation).
 */
@ApplicationScoped
public class KitchenNotificationService {

    // Kênh broadcast tổng sử dụng SmallRye Mutiny BroadcastProcessor
    private final BroadcastProcessor<Map<String, Object>> globalProcessor = BroadcastProcessor.create();

    // Cache các kênh SmallRye BroadcastProcessor theo từng tenantId
    private final ConcurrentHashMap<String, BroadcastProcessor<Map<String, Object>>> tenantProcessors = new ConcurrentHashMap<>();

    private String normalizeTenant(String tenantId) {
        if (tenantId == null || tenantId.isBlank() || "public".equalsIgnoreCase(tenantId)) {
            return "public";
        }
        return tenantId.trim();
    }

    private String extractTenantId(Map<String, Object> event) {
        if (event == null) return null;
        Object cid = event.get("companyId");
        if (cid == null) cid = event.get("tenantId");
        if (cid == null) cid = event.get("schema");
        return cid != null ? String.valueOf(cid).trim() : null;
    }

    /**
     * Broadcast sự kiện thời gian thực qua SmallRye Mutiny tới đúng Tenant
     * @param tenantId Mã công ty / tenantId
     * @param event Dữ liệu sự kiện
     */
    public void broadcast(String tenantId, Map<String, Object> event) {
        if (event == null) return;
        try {
            String norm = normalizeTenant(tenantId);
            if (!event.containsKey("companyId") && !"public".equals(norm)) {
                event.put("companyId", norm);
                event.put("tenantId", norm);
            }

            // Gửi vào processor riêng của tenant nếu có
            BroadcastProcessor<Map<String, Object>> tp = tenantProcessors.get(norm);
            if (tp != null) {
                tp.onNext(event);
            }

            // Đồng thời đẩy qua SmallRye global processor để phân phối
            globalProcessor.onNext(event);
        } catch (Exception ignored) {
            // Không làm gián đoạn luồng chính nếu client SSE ngắt kết nối
        }
    }

    public void broadcast(Map<String, Object> event) {
        if (event == null) return;
        String tenantId = extractTenantId(event);
        broadcast(tenantId, event);
    }

    /**
     * Tạo SmallRye Multi Stream lọc sự kiện theo tenant của người dùng
     * @param tenantId Mã công ty hiện tại của user
     * @param isAdmin Nếu là System Admin và không chọn công ty cụ thể thì nhận toàn bộ
     */
    public Multi<Map<String, Object>> stream(String tenantId, boolean isAdmin) {
        String target = normalizeTenant(tenantId);

        // System Admin ở chế độ toàn hệ thống (không chọn công ty cụ thể) nhận tất cả
        if (isAdmin && "public".equals(target)) {
            return globalProcessor;
        }

        // Tạo SmallRye Multi lọc theo tenant
        return globalProcessor.filter(evt -> {
            if (evt == null) return false;
            String evtTenant = normalizeTenant(extractTenantId(evt));

            // Cho phép nhận nếu cùng tenant hoặc sự kiện hệ thống (public)
            return Objects.equals(target, evtTenant) || "public".equals(evtTenant);
        });
    }

    public Multi<Map<String, Object>> stream() {
        return globalProcessor;
    }
}
