package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.DiningTable;
import com.vinhcancode.sales.entity.InvDoc;
import com.vinhcancode.sales.entity.TableOrder;
import com.vinhcancode.sales.entity.TableOrderItem;
import com.vinhcancode.sales.service.AuditService;
import com.vinhcancode.sales.service.KitchenNotificationService;
import com.vinhcancode.sales.service.PermissionService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/table-orders")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Authenticated
public class TableOrderResource {

    @Inject
    EntityManager em;

    @Inject
    JsonWebToken jwt;

    @Inject
    PermissionService permissions;

    @Inject
    AuditService audit;

    @Inject
    KitchenNotificationService notificationService;

    @Inject
    com.vinhcancode.sales.tenant.TenantContext tenantContext;

    private String username() {
        return jwt != null && jwt.getName() != null && !jwt.getName().isBlank() ? jwt.getName() : "user";
    }

    private void checkReadPermission() {
        if (!permissions.has("minibar", "READ") && !permissions.has("tables", "READ")) {
            permissions.require("minibar", "READ");
        }
    }

    private void checkOperatePermission() {
        if (!permissions.has("minibar", "CREATE") && !permissions.has("minibar", "UPDATE") && !permissions.has("tables", "UPDATE")) {
            permissions.require("minibar", "CREATE");
        }
    }

    /** Lấy toàn bộ order đang hoạt động theo tableId map (cho Sơ đồ bàn realtime) */
    @GET
    @Path("/active")
    public Map<String, TableOrder> getAllActiveOrders() {
        checkReadPermission();
        List<TableOrder> list = em.createQuery(
                "select distinct o from TableOrder o left join fetch o.items i "
                + " where o.status = 'active' order by o.id asc", TableOrder.class)
                .getResultList();

        Map<String, TableOrder> res = new LinkedHashMap<>();
        for (TableOrder o : list) {
            res.put(o.tableId, o);
        }
        return res;
    }

    /** Lấy chi tiết order đang hoạt động của 1 bàn */
    @GET
    @Path("/active/{tableId}")
    public Response getActiveOrder(@PathParam("tableId") String tableId) {
        checkReadPermission();
        List<TableOrder> orders = em.createQuery(
                "select distinct o from TableOrder o left join fetch o.items i "
                + " where o.tableId = :tid and o.status = 'active' order by o.id desc", TableOrder.class)
                .setParameter("tid", tableId)
                .setMaxResults(1)
                .getResultList();

        if (orders.isEmpty()) {
            return Response.ok(Map.of("active", false)).build();
        }
        return Response.ok(orders.get(0)).build();
    }

    /** Mở bàn hoặc bắt đầu order mới tại bàn */
    @POST
    @Path("/open")
    @Transactional
    public TableOrder openOrder(Map<String, Object> body) {
        checkOperatePermission();
        String tableId = (String) body.get("tableId");
        if (tableId == null || tableId.isBlank()) {
            throw new BadRequestException("Mã bàn không được để trống");
        }

        // Kiểm tra xem đã có active order chưa
        List<TableOrder> existing = em.createQuery(
                "select distinct o from TableOrder o left join fetch o.items i "
                + " where o.tableId = :tid and o.status = 'active'", TableOrder.class)
                .setParameter("tid", tableId)
                .setMaxResults(1)
                .getResultList();

        DiningTable table = em.find(DiningTable.class, tableId);
        if (table != null && !"occupied".equalsIgnoreCase(table.status)) {
            table.status = "occupied";
        }

        if (!existing.isEmpty()) {
            return existing.get(0);
        }

        TableOrder o = new TableOrder();
        o.tableId = tableId;
        o.shiftId = (String) body.get("shiftId");
        o.status = "active";
        if (body.get("customerName") != null) o.customerName = String.valueOf(body.get("customerName"));
        if (body.get("customerPhone") != null) o.customerPhone = String.valueOf(body.get("customerPhone"));
        if (body.get("note") != null) o.note = String.valueOf(body.get("note"));
        if (body.get("guestCount") != null) {
            try { o.guestCount = Integer.parseInt(String.valueOf(body.get("guestCount"))); } catch (Exception ignored) {}
        }
        o.createdBy = username();
        o.createdAt = OffsetDateTime.now();
        o.updatedAt = o.createdAt;
        o.persist();

        audit.log("minibar", "CREATE", "ORDER-" + o.id, "Mở order bàn " + (table != null ? table.name : tableId));
        return o;
    }

    /** Lưu / cập nhật danh sách món (trạng thái pending) */
    @POST
    @Path("/{tableId}/items")
    @Transactional
    public TableOrder saveItems(@PathParam("tableId") String tableId, List<Map<String, Object>> incomingItems) {
        checkOperatePermission();
        TableOrder order = findOrCreateActiveOrder(tableId);

        if (incomingItems == null) {
            incomingItems = Collections.emptyList();
        }

        // Duyệt danh sách món gửi lên
        for (Map<String, Object> row : incomingItems) {
            String pId = (String) row.get("productId");
            if (pId == null || pId.isBlank()) continue;

            String pName = (String) row.get("productName");
            String pCode = (String) row.get("productCode");
            String pUnit = (String) row.get("unit");
            String pNote = (String) row.get("note");
            BigDecimal qty = toBigDecimal(row.get("qty"), BigDecimal.ONE);
            BigDecimal price = toBigDecimal(row.get("price"), BigDecimal.ZERO);
            String itemStatus = (String) row.getOrDefault("status", "pending");
            Long existingId = parseLongSafe(row.get("id"));

            TableOrderItem target = null;
            if (existingId != null) {
                target = order.items.stream().filter(it -> existingId.equals(it.id)).findFirst().orElse(null);
            }
            if (target == null && ("pending".equalsIgnoreCase(itemStatus) || itemStatus == null)) {
                target = order.items.stream()
                        .filter(it -> "pending".equalsIgnoreCase(it.status) && pId.equals(it.productId))
                        .findFirst()
                        .orElse(null);
            }

            if (target != null) {
                // Cập nhật số lượng và ghi chú nếu món đang pending
                if ("pending".equalsIgnoreCase(target.status)) {
                    target.qty = qty;
                    target.price = price;
                    target.note = pNote;
                }
            } else {
                // Thêm món mới vào order (trạng thái pending)
                TableOrderItem newItem = new TableOrderItem();
                newItem.order = order;
                newItem.productId = pId;
                newItem.productCode = pCode;
                newItem.productName = pName != null ? pName : pId;
                newItem.unit = pUnit;
                newItem.qty = qty;
                newItem.price = price;
                newItem.note = pNote;
                newItem.status = "pending";
                newItem.createdBy = username();
                newItem.createdAt = OffsetDateTime.now();
                order.items.add(newItem);
            }
        }

        // Đồng bộ các món pending đã bị người dùng xóa khỏi giỏ
        Set<Long> incomingPendingIds = new HashSet<>();
        Set<String> incomingPendingProductIds = new HashSet<>();
        for (Map<String, Object> row : incomingItems) {
            String st = (String) row.getOrDefault("status", "pending");
            if ("pending".equalsIgnoreCase(st)) {
                Long id = parseLongSafe(row.get("id"));
                if (id != null) incomingPendingIds.add(id);
                String pid = (String) row.get("productId");
                if (pid != null) incomingPendingProductIds.add(pid);
            }
        }
        order.items.removeIf(it -> "pending".equalsIgnoreCase(it.status)
                && (it.id != null ? !incomingPendingIds.contains(it.id) : !incomingPendingProductIds.contains(it.productId)));

        recalculateOrderTotal(order);
        order.updatedAt = OffsetDateTime.now();
        em.flush();

        // Đảm bảo bàn chuyển occupied
        DiningTable table = em.find(DiningTable.class, tableId);
        if (table != null && !"occupied".equalsIgnoreCase(table.status)) {
            table.status = "occupied";
        }

        return order;
    }

    /** Gửi bếp / Bar các món đang pending (chuyển sang 'sent' và tính số đợt gọi) */
    @POST
    @Path("/{tableId}/send-kitchen")
    @Consumes({MediaType.APPLICATION_JSON, MediaType.WILDCARD})
    @Transactional
    public Map<String, Object> sendToKitchen(@PathParam("tableId") String tableId) {
        checkOperatePermission();
        TableOrder order = findOrCreateActiveOrder(tableId);

        // Tính round tiếp theo (dựa trên các món đã gửi trước đó)
        int maxRound = 0;
        for (TableOrderItem it : order.items) {
            if (!"pending".equalsIgnoreCase(it.status) && it.round != null && it.round > maxRound) {
                maxRound = it.round;
            }
        }
        int nextRound = maxRound + 1;

        List<TableOrderItem> sentItems = new ArrayList<>();
        OffsetDateTime now = OffsetDateTime.now();

        for (TableOrderItem it : order.items) {
            if ("pending".equalsIgnoreCase(it.status)) {
                it.status = "sent";
                it.round = nextRound;
                it.sentAt = now;
                sentItems.add(it);
            }
        }

        recalculateOrderTotal(order);
        order.updatedAt = now;
        em.flush();

        DiningTable table = em.find(DiningTable.class, tableId);
        String tableName = table != null ? table.name : tableId;
        String currentCompany = tenantContext.getCompanyId();
        audit.log("minibar", "UPDATE", "ORDER-" + order.id,
                String.format("Gửi bếp đợt %d cho %s (%d món)", nextRound, tableName, sentItems.size()));

        // Báo bếp thời gian thực qua Quarkus SSE Notification (Multi-tenant)
        notificationService.broadcast(Map.of(
                "type", "NEW_ORDER",
                "orderId", order.id,
                "tableId", tableId,
                "tableName", tableName,
                "companyId", currentCompany != null ? currentCompany : "",
                "tenantId", currentCompany != null ? currentCompany : "",
                "round", nextRound,
                "itemCount", sentItems.size(),
                "timestamp", now.toString()
        ));

        return Map.of(
                "order", order,
                "sentItems", sentItems,
                "round", nextRound,
                "tableName", tableName
        );
    }

    /** Hủy một món đã gọi */
    @POST
    @Path("/{tableId}/items/{itemId}/cancel")
    @Transactional
    public TableOrder cancelItem(@PathParam("tableId") String tableId,
                                 @PathParam("itemId") Long itemId,
                                 Map<String, String> body) {
        checkOperatePermission();
        TableOrder order = findOrCreateActiveOrder(tableId);

        TableOrderItem item = order.items.stream()
                .filter(it -> itemId.equals(it.id))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Không tìm thấy món cần hủy"));

        String reason = body != null ? body.get("reason") : "Khách hủy";
        item.status = "cancelled";
        item.cancelReason = reason;

        recalculateOrderTotal(order);
        order.updatedAt = OffsetDateTime.now();
        em.flush();

        audit.log("minibar", "DELETE", "ORDER-" + order.id,
                String.format("Hủy món '%s' tại bàn %s: %s", item.productName, tableId, reason));

        notificationService.broadcast(Map.of(
                "type", "ITEM_CANCELLED",
                "itemId", item.id,
                "orderId", order.id,
                "tableId", tableId,
                "productName", item.productName,
                "companyId", tenantContext.getCompanyId() != null ? tenantContext.getCompanyId() : "",
                "tenantId", tenantContext.getCompanyId() != null ? tenantContext.getCompanyId() : "",
                "reason", reason,
                "timestamp", OffsetDateTime.now().toString()
        ));

        return order;
    }

    /** Chuyển order từ bàn này sang bàn khác */
    @POST
    @Path("/{tableId}/transfer")
    @Transactional
    public TableOrder transferTable(@PathParam("tableId") String tableId, Map<String, String> body) {
        checkOperatePermission();
        String targetTableId = body.get("targetTableId");
        if (targetTableId == null || targetTableId.isBlank() || targetTableId.equals(tableId)) {
            throw new BadRequestException("Bàn chuyển đến không hợp lệ");
        }

        TableOrder order = findOrCreateActiveOrder(tableId);

        // Kiểm tra bàn đích
        DiningTable targetTable = em.find(DiningTable.class, targetTableId);
        if (targetTable == null) throw new NotFoundException("Không tìm thấy bàn chuyển đến");

        DiningTable sourceTable = em.find(DiningTable.class, tableId);

        order.tableId = targetTableId;
        order.updatedAt = OffsetDateTime.now();

        if (sourceTable != null) sourceTable.status = "empty";
        targetTable.status = "occupied";

        em.flush();

        audit.log("minibar", "UPDATE", "ORDER-" + order.id,
                String.format("Chuyển order từ %s sang %s",
                        sourceTable != null ? sourceTable.name : tableId, targetTable.name));

        return order;
    }

    /** Hủy order và giải phóng bàn */
    @POST
    @Path("/{tableId}/cancel-order")
    @Consumes({MediaType.APPLICATION_JSON, MediaType.WILDCARD})
    @Transactional
    public Response cancelOrder(@PathParam("tableId") String tableId) {
        checkOperatePermission();
        List<TableOrder> orders = em.createQuery(
                "select o from TableOrder o where o.tableId = :tid and o.status = 'active'", TableOrder.class)
                .setParameter("tid", tableId)
                .getResultList();

        for (TableOrder o : orders) {
            o.status = "cancelled";
            o.updatedAt = OffsetDateTime.now();
        }

        DiningTable table = em.find(DiningTable.class, tableId);
        if (table != null) {
            table.status = "empty";
        }

        em.flush();
        audit.log("minibar", "DELETE", "TABLE-" + tableId, "Hủy toàn bộ order và giải phóng bàn " + (table != null ? table.name : tableId));

        notificationService.broadcast(Map.of(
                "type", "ORDER_CANCELLED",
                "tableId", tableId,
                "companyId", tenantContext.getCompanyId() != null ? tenantContext.getCompanyId() : "",
                "tenantId", tenantContext.getCompanyId() != null ? tenantContext.getCompanyId() : "",
                "timestamp", OffsetDateTime.now().toString()
        ));

        return Response.noContent().build();
    }

    /** Đánh dấu order đã thanh toán xong khi xuất hóa đơn */
    @POST
    @Path("/{tableId}/complete")
    @Transactional
    public Response completeOrder(@PathParam("tableId") String tableId, Map<String, Object> body) {
        checkOperatePermission();
        List<TableOrder> orders = em.createQuery(
                "select o from TableOrder o where o.tableId = :tid and o.status = 'active'", TableOrder.class)
                .setParameter("tid", tableId)
                .getResultList();

        Long invDocId = null;
        if (body != null && body.get("invDocId") != null) {
            try {
                Long candidateId = Long.valueOf(String.valueOf(body.get("invDocId")));
                if (em.find(InvDoc.class, candidateId) != null) {
                    invDocId = candidateId;
                }
            } catch (Exception ignored) {}
        }

        OffsetDateTime now = OffsetDateTime.now();
        for (TableOrder o : orders) {
            o.status = "completed";
            o.completedAt = now;
            o.updatedAt = now;
            if (invDocId != null) o.invDocId = invDocId;
        }

        DiningTable table = em.find(DiningTable.class, tableId);
        if (table != null) {
            table.status = "empty";
        }

        em.flush();
        return Response.ok(Map.of("completed", true)).build();
    }

    private TableOrder findOrCreateActiveOrder(String tableId) {
        List<TableOrder> orders = em.createQuery(
                "select distinct o from TableOrder o left join fetch o.items i "
                + " where o.tableId = :tid and o.status = 'active'", TableOrder.class)
                .setParameter("tid", tableId)
                .setMaxResults(1)
                .getResultList();

        if (!orders.isEmpty()) {
            return orders.get(0);
        }

        TableOrder o = new TableOrder();
        o.tableId = tableId;
        o.status = "active";
        o.createdBy = username();
        o.createdAt = OffsetDateTime.now();
        o.updatedAt = o.createdAt;
        o.persist();
        return o;
    }

    private void recalculateOrderTotal(TableOrder o) {
        BigDecimal total = BigDecimal.ZERO;
        for (TableOrderItem it : o.items) {
            if (!"cancelled".equalsIgnoreCase(it.status)) {
                BigDecimal q = it.qty != null ? it.qty : BigDecimal.ZERO;
                BigDecimal p = it.price != null ? it.price : BigDecimal.ZERO;
                total = total.add(q.multiply(p));
            }
        }
        o.totalAmount = total;
    }

    private Long parseLongSafe(Object val) {
        if (val == null) return null;
        try {
            if (val instanceof Number n) {
                double d = n.doubleValue();
                if (d != Math.floor(d) || d > Long.MAX_VALUE || d < Long.MIN_VALUE) {
                    return null;
                }
                return n.longValue();
            }
            String s = String.valueOf(val).trim();
            if (s.isEmpty() || s.contains(".") || s.contains("e") || s.contains("E")) {
                return null;
            }
            return Long.valueOf(s);
        } catch (Exception ignored) {
            return null;
        }
    }

    private BigDecimal toBigDecimal(Object val, BigDecimal fallback) {
        if (val == null) return fallback;
        if (val instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(String.valueOf(val).trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
