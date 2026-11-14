package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Shift;
import com.vinhcancode.sales.entity.Warehouse;
import com.vinhcancode.sales.service.AuditService;
import com.vinhcancode.sales.service.PermissionService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/shifts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Authenticated
public class ShiftResource {

    @Inject
    EntityManager em;

    @Inject
    JsonWebToken jwt;

    @Inject
    PermissionService permissions;

    @Inject
    AuditService audit;

    private String username() {
        return jwt != null && jwt.getName() != null && !jwt.getName().isBlank() ? jwt.getName() : "user";
    }

    /** Lấy ca hiện tại đang mở */
    @GET
    @Path("/current")
    public Response currentShift(@QueryParam("warehouseId") String warehouseId) {
        StringBuilder hql = new StringBuilder("select s from Shift s where s.status = 'open'");
        if (warehouseId != null && !warehouseId.isBlank() && !"all".equalsIgnoreCase(warehouseId)) {
            hql.append(" and s.warehouseId = :wid");
        }
        hql.append(" order by s.openedAt desc");

        TypedQuery<Shift> query = em.createQuery(hql.toString(), Shift.class);
        if (warehouseId != null && !warehouseId.isBlank() && !"all".equalsIgnoreCase(warehouseId)) {
            query.setParameter("wid", warehouseId);
        }
        List<Shift> list = query.setMaxResults(1).getResultList();
        if (list.isEmpty()) {
            return Response.ok(Map.of("hasOpenShift", false)).build();
        }

        Shift shift = list.get(0);
        Map<String, Object> res = buildShiftDetailMap(shift);
        res.put("hasOpenShift", true);
        return Response.ok(res).build();
    }

    /** Mở ca làm việc mới */
    @POST
    @Path("/open")
    @Transactional
    public Response openShift(Map<String, Object> body) {
        permissions.require("minibar", "CREATE");

        String warehouseId = body.get("warehouseId") != null ? String.valueOf(body.get("warehouseId")) : null;
        String name = body.get("name") != null ? String.valueOf(body.get("name")).trim() : "Ca làm việc";
        long openingCash = parseLongSafe(body.get("openingCash"), 0);
        String note = body.get("note") != null ? String.valueOf(body.get("note")) : "";

        // Kiểm tra xem đã có ca nào đang mở chưa
        StringBuilder checkHql = new StringBuilder("select count(s) from Shift s where s.status = 'open'");
        if (warehouseId != null && !warehouseId.isBlank()) {
            checkHql.append(" and s.warehouseId = :wid");
        }
        TypedQuery<Long> checkQuery = em.createQuery(checkHql.toString(), Long.class);
        if (warehouseId != null && !warehouseId.isBlank()) {
            checkQuery.setParameter("wid", warehouseId);
        }
        if (checkQuery.getSingleResult() > 0) {
            throw new BadRequestException("Hiện tại đang có một ca làm việc đang mở. Vui lòng kết thúc ca hiện tại trước khi mở ca mới!");
        }

        Shift shift = new Shift();
        shift.name = name.isBlank() ? "Ca làm việc" : name;
        shift.warehouseId = warehouseId;
        if (warehouseId != null && !warehouseId.isBlank()) {
            Warehouse wh = em.find(Warehouse.class, warehouseId);
            if (wh != null) shift.warehouseName = wh.name;
        }
        shift.openingCash = openingCash;
        shift.expectedCash = openingCash;
        shift.openedBy = username();
        shift.openedAt = OffsetDateTime.now();
        shift.status = "open";
        shift.note = note;

        // Sinh mã ca: CA-YYYYMMDD-01
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        Long todayCount = em.createQuery(
                "select count(s) from Shift s where cast(s.openedAt as date) = current_date", Long.class)
                .getSingleResult();
        shift.code = String.format("CA-%s-%02d", dateStr, todayCount + 1);

        em.persist(shift);

        audit.log("shifts", "OPEN_SHIFT", shift.code,
                String.format("Mở %s (%s) - Tiền đầu ca: %,d đ - Thu ngân: %s",
                        shift.name, shift.code, shift.openingCash, shift.openedBy));

        return Response.status(Response.Status.CREATED).entity(shift).build();
    }

    /** Đóng ca & Bàn giao ca */
    @POST
    @Path("/{id}/close")
    @Transactional
    public Response closeShift(@PathParam("id") String id, Map<String, Object> body) {
        permissions.require("minibar", "UPDATE");

        Shift shift = em.find(Shift.class, id);
        if (shift == null) {
            throw new NotFoundException("Không tìm thấy ca làm việc");
        }
        if ("closed".equalsIgnoreCase(shift.status)) {
            throw new BadRequestException("Ca làm việc này đã được đóng trước đó!");
        }

        calculateRealtime(shift);

        long actualCash = parseLongSafe(body.get("actualCash"), shift.expectedCash);
        String handoverTo = body.get("handoverTo") != null ? String.valueOf(body.get("handoverTo")).trim() : "";
        String closeNote = body.get("note") != null ? String.valueOf(body.get("note")).trim() : "";

        shift.actualCash = actualCash;
        shift.difference = actualCash - shift.expectedCash;
        shift.closedBy = username();
        shift.closedAt = OffsetDateTime.now();
        shift.handoverTo = handoverTo;
        if (!closeNote.isBlank()) {
            shift.note = (shift.note == null || shift.note.isBlank()) ? closeNote : (shift.note + " | " + closeNote);
        }
        shift.status = "closed";
        shift.updatedAt = OffsetDateTime.now();

        audit.log("shifts", "CLOSE_SHIFT", shift.code,
                String.format("Kết ca %s (%s) - Dự kiến: %,d đ - Thực tế: %,d đ - Lệch: %,d đ - Bàn giao cho: %s",
                        shift.name, shift.code, shift.expectedCash, shift.actualCash, shift.difference, shift.handoverTo));

        return Response.ok(shift).build();
    }

    /** Danh sách lịch sử các ca làm việc */
    @GET
    public Map<String, Object> listShifts(@QueryParam("status") String status,
                                          @QueryParam("warehouseId") String warehouseId,
                                          @QueryParam("openedBy") String openedBy,
                                          @QueryParam("page") @DefaultValue("1") int page,
                                          @QueryParam("pageSize") @DefaultValue("20") int pageSize) {
        permissions.require("minibar", "READ");

        int pg = Math.max(1, page);
        int size = Math.min(Math.max(1, pageSize), 100);

        StringBuilder where = new StringBuilder(" where 1=1");
        Map<String, Object> params = new HashMap<>();

        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            where.append(" and s.status = :status");
            params.put("status", status.trim().toLowerCase());
        }
        if (warehouseId != null && !warehouseId.isBlank() && !"all".equalsIgnoreCase(warehouseId)) {
            where.append(" and s.warehouseId = :wid");
            params.put("wid", warehouseId.trim());
        }
        if (openedBy != null && !openedBy.isBlank()) {
            where.append(" and lower(s.openedBy) like :user");
            params.put("user", "%" + openedBy.trim().toLowerCase() + "%");
        }

        TypedQuery<Shift> query = em.createQuery(
                "select s from Shift s" + where + " order by s.openedAt desc", Shift.class);
        TypedQuery<Long> countQuery = em.createQuery(
                "select count(s) from Shift s" + where, Long.class);

        params.forEach((k, v) -> {
            query.setParameter(k, v);
            countQuery.setParameter(k, v);
        });

        List<Shift> items = query.setFirstResult((pg - 1) * size).setMaxResults(size).getResultList();
        long total = countQuery.getSingleResult();

        // Với ca đang open, tính toán số liệu realtime
        for (Shift s : items) {
            if ("open".equalsIgnoreCase(s.status)) {
                calculateRealtime(s);
            }
        }

        return Map.of("items", items, "total", total, "page", pg, "pageSize", size);
    }

    /** Chi tiết ca làm việc kèm các hóa đơn/phiếu thu chi để in biên bản */
    @GET
    @Path("/{id}")
    public Response getDetail(@PathParam("id") String id) {
        permissions.require("minibar", "READ");

        Shift shift = em.find(Shift.class, id);
        if (shift == null) throw new NotFoundException("Không tìm thấy ca làm việc");

        return Response.ok(buildShiftDetailMap(shift)).build();
    }

    private Map<String, Object> buildShiftDetailMap(Shift shift) {
        if ("open".equalsIgnoreCase(shift.status)) {
            calculateRealtime(shift);
        }

        // Lấy danh sách hóa đơn xuất kho thuộc ca này
        @SuppressWarnings("unchecked")
        List<Object[]> invDocs = em.createNativeQuery(
                "select d.id, d.no, d.doc_date, d.partner_name, d.note, "
                + " coalesce(sum(l.qty * l.price), 0) as total, d.created_at "
                + " from inv_doc d "
                + " left join inv_doc_line l on l.doc_id = d.id "
                + " where d.shift_id = :sid "
                + " group by d.id, d.no, d.doc_date, d.partner_name, d.note, d.created_at "
                + " order by d.created_at asc")
                .setParameter("sid", shift.id)
                .getResultList();

        List<Map<String, Object>> invoices = new ArrayList<>();
        for (Object[] row : invDocs) {
            Map<String, Object> inv = new LinkedHashMap<>();
            inv.put("id", row[0]);
            inv.put("no", row[1]);
            inv.put("date", row[2]);
            inv.put("partnerName", row[3]);
            inv.put("note", row[4]);
            inv.put("total", ((Number) row[5]).longValue());
            inv.put("createdAt", row[6]);
            invoices.add(inv);
        }

        // Lấy danh sách phiếu thu/chi tiền mặt thuộc ca này
        @SuppressWarnings("unchecked")
        List<Object[]> cashDocs = em.createNativeQuery(
                "select v.id, v.code, v.doc_date, v.type, v.name, v.partner_name, v.amount, v.created_at "
                + " from cash_vouchers v "
                + " where v.shift_id = :sid and v.status = 'posted' "
                + " order by v.created_at asc")
                .setParameter("sid", shift.id)
                .getResultList();

        List<Map<String, Object>> vouchers = new ArrayList<>();
        for (Object[] row : cashDocs) {
            Map<String, Object> cv = new LinkedHashMap<>();
            cv.put("id", row[0]);
            cv.put("code", row[1]);
            cv.put("date", row[2]);
            cv.put("type", row[3]);
            cv.put("name", row[4]);
            cv.put("partnerName", row[5]);
            cv.put("amount", ((Number) row[6]).longValue());
            cv.put("createdAt", row[7]);
            vouchers.add(cv);
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("shift", shift);
        res.put("invoices", invoices);
        res.put("cashVouchers", vouchers);
        return res;
    }

    /** Tính toán thời gian thực tổng bán, tổng thu, tổng chi và tiền mặt dự kiến của ca */
    private void calculateRealtime(Shift s) {
        if (s == null || s.id == null) return;

        // 1. Tổng tiền xuất bán hàng trong ca
        Object rawSales = em.createNativeQuery(
                "select coalesce(sum(l.qty * l.price), 0) "
                + " from inv_doc d join inv_doc_line l on l.doc_id = d.id "
                + " where d.shift_id = :sid and d.type = 'export'")
                .setParameter("sid", s.id)
                .getSingleResult();
        s.totalSales = rawSales != null ? ((Number) rawSales).longValue() : 0;

        // 2. Tổng thu tiền mặt trong ca
        Object rawReceipts = em.createNativeQuery(
                "select coalesce(sum(v.amount), 0) "
                + " from cash_vouchers v "
                + " where v.shift_id = :sid and v.type <> 'payment' and v.status = 'posted'")
                .setParameter("sid", s.id)
                .getSingleResult();
        s.totalReceipts = rawReceipts != null ? ((Number) rawReceipts).longValue() : 0;

        // 3. Tổng chi tiền mặt trong ca
        Object rawPayments = em.createNativeQuery(
                "select coalesce(sum(v.amount), 0) "
                + " from cash_vouchers v "
                + " where v.shift_id = :sid and v.type = 'payment' and v.status = 'posted'")
                .setParameter("sid", s.id)
                .getSingleResult();
        s.totalPayments = rawPayments != null ? ((Number) rawPayments).longValue() : 0;

        // 4. Tiền mặt dự kiến = Tiền thối đầu ca + Tiền thu - Tiền chi
        s.expectedCash = s.openingCash + s.totalReceipts - s.totalPayments;
    }

    private static long parseLongSafe(Object val, long fallback) {
        if (val == null) return fallback;
        if (val instanceof Number n) return n.longValue();
        try {
            String s = String.valueOf(val).trim().replace(",", "").replace(" ", "");
            if (s.isBlank()) return fallback;
            if (s.contains(".")) {
                return (long) Double.parseDouble(s);
            }
            return Long.parseLong(s);
        } catch (Exception e) {
            try {
                return (long) Double.parseDouble(String.valueOf(val).trim().replace(",", ""));
            } catch (Exception e2) {
                return fallback;
            }
        }
    }
}

