package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.DiningTable;
import com.vinhcancode.sales.entity.TableOrder;
import com.vinhcancode.sales.entity.TableOrderItem;
import com.vinhcancode.sales.service.AuditService;
import com.vinhcancode.sales.service.KitchenNotificationService;
import com.vinhcancode.sales.service.PermissionService;
import io.quarkus.security.Authenticated;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Multi;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.resteasy.reactive.RestStreamElementType;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;

@Path("/kitchen")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@ApplicationScoped
@Authenticated
@Blocking
public class KitchenResource {

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
        return jwt != null && jwt.getName() != null && !jwt.getName().isBlank() ? jwt.getName() : "kitchen";
    }

    private void checkReadPermission() {
        if (!permissions.has("kitchen", "READ") && !permissions.has("minibar", "READ")) {
            permissions.require("kitchen", "READ");
        }
    }

    private void checkUpdatePermission() {
        if (!permissions.has("kitchen", "UPDATE") && !permissions.has("minibar", "UPDATE") && !permissions.has("minibar", "CREATE")) {
            permissions.require("kitchen", "UPDATE");
        }
    }

    /** Stream SSE phát thông báo thời gian thực khi có món mới / đổi trạng thái (phân tách theo Tenant) */
    @GET
    @Path("/stream")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    @Blocking
    public Multi<Map<String, Object>> streamEvents(@QueryParam("companyId") String companyParam) {
        checkReadPermission();
        String companyId = companyParam != null && !companyParam.isBlank()
                ? companyParam.trim()
                : tenantContext.getCompanyId();
        boolean isAdmin = jwt != null && jwt.getGroups() != null && jwt.getGroups().contains("admin");
        return notificationService.stream(companyId, isAdmin);
    }

    /** Lấy danh sách các đơn / đợt món đang chờ hoặc đang chế biến cho Màn hình Bếp (KDS) */
    @GET
    @Path("/orders")
    public List<Map<String, Object>> getKitchenOrders(@QueryParam("includeCompleted") @DefaultValue("false") boolean includeCompleted) {
        checkReadPermission();

        // Lấy toàn bộ order đang active có món đã gửi bếp
        List<TableOrder> orders = em.createQuery(
                "select distinct o from TableOrder o join fetch o.items i "
                + " where o.status = 'active' and i.status in ('sent', 'preparing', 'served', 'cancelled') "
                + " order by o.id asc", TableOrder.class)
                .getResultList();

        Map<String, DiningTable> tableMap = new HashMap<>();
        List<DiningTable> tableList = em.createQuery("select t from DiningTable t", DiningTable.class).getResultList();
        for (DiningTable t : tableList) {
            tableMap.put(t.id, t);
        }

        OffsetDateTime now = OffsetDateTime.now();
        List<Map<String, Object>> tickets = new ArrayList<>();

        for (TableOrder order : orders) {
            DiningTable tbl = tableMap.get(order.tableId);
            String tableName = tbl != null ? tbl.name : order.tableId;
            String areaName = tbl != null ? tbl.area : "Khu vực chung";

            // Nhóm các món theo round
            Map<Integer, List<TableOrderItem>> roundGroups = new TreeMap<>();
            for (TableOrderItem item : order.items) {
                if (item.round != null && item.round > 0 && !"pending".equalsIgnoreCase(item.status)) {
                    roundGroups.computeIfAbsent(item.round, k -> new ArrayList<>()).add(item);
                }
            }

            for (Map.Entry<Integer, List<TableOrderItem>> entry : roundGroups.entrySet()) {
                int round = entry.getKey();
                List<TableOrderItem> items = entry.getValue();

                long pendingCount = items.stream().filter(it -> "sent".equalsIgnoreCase(it.status) || "preparing".equalsIgnoreCase(it.status)).count();
                boolean allServed = pendingCount == 0 && items.stream().anyMatch(it -> "served".equalsIgnoreCase(it.status));

                if (!includeCompleted && allServed) {
                    continue; // Ẩn các đợt đã hoàn thành xong nếu không yêu cầu
                }

                OffsetDateTime earliestSentAt = items.stream()
                        .map(it -> it.sentAt)
                        .filter(Objects::nonNull)
                        .min(Comparator.naturalOrder())
                        .orElse(order.createdAt != null ? order.createdAt : now);

                long waitSeconds = Math.max(0, Duration.between(earliestSentAt, now).getSeconds());
                long waitMinutes = waitSeconds / 60;

                String urgency = "normal";
                if (waitMinutes >= 15) {
                    urgency = "urgent";
                } else if (waitMinutes >= 7) {
                    urgency = "warning";
                }

                Map<String, Object> ticket = new LinkedHashMap<>();
                ticket.put("orderId", order.id);
                ticket.put("tableId", order.tableId);
                ticket.put("tableName", tableName);
                ticket.put("area", areaName);
                ticket.put("round", round);
                ticket.put("sentAt", earliestSentAt);
                ticket.put("waitSeconds", waitSeconds);
                ticket.put("waitMinutes", waitMinutes);
                ticket.put("urgency", urgency);
                ticket.put("guestCount", order.guestCount != null ? order.guestCount : 1);
                ticket.put("customerName", order.customerName);
                ticket.put("orderNote", order.note);
                ticket.put("staffName", order.createdBy);
                ticket.put("items", items);
                ticket.put("allServed", allServed);
                ticket.put("pendingCount", pendingCount);

                tickets.add(ticket);
            }
        }

        // Sắp xếp các ticket: Đơn đợi lâu nhất ưu tiên lên trước (FIFO)
        tickets.sort((a, b) -> {
            OffsetDateTime t1 = (OffsetDateTime) a.get("sentAt");
            OffsetDateTime t2 = (OffsetDateTime) b.get("sentAt");
            if (t1 == null && t2 == null) return 0;
            if (t1 == null) return 1;
            if (t2 == null) return -1;
            return t1.compareTo(t2);
        });

        return tickets;
    }

    /** Cập nhật trạng thái một món (sent -> preparing -> served / cancelled) */
    @POST
    @Path("/items/{itemId}/status")
    @Transactional
    public TableOrderItem updateItemStatus(@PathParam("itemId") Long itemId, Map<String, String> body) {
        checkUpdatePermission();

        TableOrderItem item = em.find(TableOrderItem.class, itemId);
        if (item == null) {
            throw new NotFoundException("Không tìm thấy món cần cập nhật");
        }

        String newStatus = body != null ? body.get("status") : null;
        if (newStatus == null || newStatus.isBlank()) {
            throw new BadRequestException("Thiếu trạng thái status mới");
        }
        newStatus = newStatus.trim().toLowerCase();

        String oldStatus = item.status;
        item.status = newStatus;

        if ("cancelled".equalsIgnoreCase(newStatus)) {
            item.cancelReason = body.getOrDefault("cancelReason", "Bếp báo hủy");
        }

        TableOrder order = item.order;
        if (order != null) {
            order.updatedAt = OffsetDateTime.now();
        }
        em.flush();

        audit.log("kitchen", "UPDATE", "ITEM-" + itemId,
                String.format("Bếp đổi trạng thái món '%s' từ %s sang %s", item.productName, oldStatus, newStatus));

        // Phát thông báo SSE thời gian thực tới tất cả client theo Tenant
        DiningTable tbl = (order != null && order.tableId != null) ? em.find(DiningTable.class, order.tableId) : null;
        String tableName = tbl != null ? tbl.name : (order != null ? order.tableId : "");
        String currentCompany = tenantContext.getCompanyId();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "ITEM_STATUS_CHANGED");
        payload.put("itemId", item.id);
        payload.put("orderId", order != null ? order.id : 0);
        payload.put("tableId", order != null ? order.tableId : "");
        payload.put("tableName", tableName != null ? tableName : "");
        payload.put("productName", item.productName != null ? item.productName : "");
        payload.put("qty", item.qty != null ? item.qty : 1);
        payload.put("status", newStatus);
        payload.put("oldStatus", oldStatus);
        payload.put("round", item.round != null ? item.round : 1);
        payload.put("companyId", currentCompany != null ? currentCompany : "");
        payload.put("tenantId", currentCompany != null ? currentCompany : "");
        payload.put("updatedBy", username());
        payload.put("timestamp", OffsetDateTime.now().toString());

        notificationService.broadcast(payload);

        return item;
    }

    /** Bếp bấm nhận làm tất cả các món trong một đợt (chuyển sang 'preparing') */
    @POST
    @Path("/orders/{orderId}/rounds/{round}/preparing")
    @Transactional
    public Response startPreparingRound(@PathParam("orderId") Long orderId, @PathParam("round") Integer round) {
        checkUpdatePermission();

        TableOrder order = em.find(TableOrder.class, orderId);
        if (order == null) throw new NotFoundException("Không tìm thấy order");

        int count = 0;
        for (TableOrderItem it : order.items) {
            if (Objects.equals(it.round, round) && "sent".equalsIgnoreCase(it.status)) {
                it.status = "preparing";
                count++;
            }
        }

        order.updatedAt = OffsetDateTime.now();
        em.flush();

        DiningTable tbl = order.tableId != null ? em.find(DiningTable.class, order.tableId) : null;
        String tableName = tbl != null ? tbl.name : order.tableId;
        String currentCompany = tenantContext.getCompanyId();

        audit.log("kitchen", "UPDATE", "ORDER-" + orderId + "-R" + round,
                String.format("Bếp nhận chế biến đợt %d bàn %s (%d món)", round, tableName, count));

        notificationService.broadcast(Map.of(
                "type", "ROUND_PREPARING",
                "orderId", orderId,
                "tableId", order.tableId != null ? order.tableId : "",
                "tableName", tableName != null ? tableName : (order.tableId != null ? order.tableId : ""),
                "companyId", currentCompany != null ? currentCompany : "",
                "tenantId", currentCompany != null ? currentCompany : "",
                "round", round,
                "count", count,
                "timestamp", OffsetDateTime.now().toString()
        ));

        return Response.ok(Map.of("success", true, "updatedCount", count)).build();
    }

    /** Hoàn thành toàn bộ đợt (chuyển tất cả các món 'sent' hoặc 'preparing' thành 'served') */
    @POST
    @Path("/orders/{orderId}/rounds/{round}/complete")
    @Transactional
    public Response completeRound(@PathParam("orderId") Long orderId, @PathParam("round") Integer round) {
        checkUpdatePermission();

        TableOrder order = em.find(TableOrder.class, orderId);
        if (order == null) throw new NotFoundException("Không tìm thấy order");

        int count = 0;
        for (TableOrderItem it : order.items) {
            if (Objects.equals(it.round, round) && ("sent".equalsIgnoreCase(it.status) || "preparing".equalsIgnoreCase(it.status))) {
                it.status = "served";
                count++;
            }
        }

        order.updatedAt = OffsetDateTime.now();
        em.flush();

        DiningTable tbl = order.tableId != null ? em.find(DiningTable.class, order.tableId) : null;
        String tableName = tbl != null ? tbl.name : order.tableId;
        String currentCompany = tenantContext.getCompanyId();

        audit.log("kitchen", "UPDATE", "ORDER-" + orderId + "-R" + round,
                String.format("Bếp hoàn thành đợt %d bàn %s (%d món)", round, tableName, count));

        notificationService.broadcast(Map.of(
                "type", "ROUND_COMPLETED",
                "orderId", orderId,
                "tableId", order.tableId != null ? order.tableId : "",
                "tableName", tableName != null ? tableName : (order.tableId != null ? order.tableId : ""),
                "companyId", currentCompany != null ? currentCompany : "",
                "tenantId", currentCompany != null ? currentCompany : "",
                "round", round,
                "count", count,
                "timestamp", OffsetDateTime.now().toString()
        ));

        return Response.ok(Map.of("success", true, "completedCount", count)).build();
    }
}

