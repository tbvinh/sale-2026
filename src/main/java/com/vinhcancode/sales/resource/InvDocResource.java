/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vinhcancode.sales.entity.InvDoc;
import com.vinhcancode.sales.entity.InvLine;
import com.vinhcancode.sales.service.PermissionService;
import com.vinhcancode.sales.service.XlsxWriter;
import com.vinhcancode.sales.service.XlsxWriter.Cell;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 *
 * @author tbvinh
 */
@Path("/inventory/docs")
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
@Authenticated                      // CS-S1: phiếu kho chỉ truy cập được khi đã đăng nhập (cookie JWT)
public class InvDocResource {
    static final Map<String,String> PREFIX = Map.of("import","PN","export","PX","return","PT","transfer","PC");

    // Whitelist cột sắp xếp: client chỉ gửi khoá, KHÔNG bao giờ gửi tên cột (chống JPQL injection) — BE-R12
    private static final Map<String,String> SORTABLE = Map.of(
            "no", "d.no", "type", "d.type", "partner", "d.partner.name", "date", "d.date");

    // Trần an toàn khi client không yêu cầu phân trang (dropdown/lấy hết để đối chiếu nhỏ) — BE-R8
    private static final int MAX_UNPAGED = 10_000;

    @Inject EntityManager em;
    @Inject ObjectMapper mapper;
    @Inject PermissionService permissions;

    /** Xuất chi tiết phiếu kho (.xlsx): thông tin chung + dòng hàng, dùng chung cho nhập/xuất/điều chuyển. */
    @GET
    @Path("{id}/export-excel")
    @Produces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public Response exportExcel(@PathParam("id") Long id) {
        permissions.require("inventory", "EXPORT");
        InvDoc doc = InvDoc.findById(id);
        if (doc == null) throw new NotFoundException();
        Map<String, Object> d = mapper.convertValue(doc, new TypeReference<Map<String, Object>>() { });

        String type = text(d, "type");
        String title = switch (type) {
            case "export" -> "PHIẾU XUẤT KHO";
            case "transfer" -> "PHIẾU ĐIỀU CHUYỂN KHO";
            case "return" -> "PHIẾU TRẢ HÀNG";
            default -> "PHIẾU NHẬP KHO";
        };
        boolean inbound = "import".equals(type) || "return".equals(type) || "transfer".equals(type);

        List<List<Cell>> rows = new ArrayList<>();
        rows.add(List.of(Cell.title(title)));
        rows.add(info("Số phiếu", text(d, "no"), "Ngày", dateText(d.get("date"))));
        rows.add(info(inbound ? "Người giao" : "Người nhận", refName(d.get("partner"))));
        if ("transfer".equals(type)) {
            rows.add(info("Kho xuất", refName(d.get("warehouseOut")), "Kho nhập", refName(d.get("warehouseIn"))));
        } else if ("export".equals(type)) {
            rows.add(info("Kho xuất", refName(d.get("warehouseOut"))));
        } else {
            rows.add(info("Kho nhập", refName(d.get("warehouseIn"))));
        }
        String bank = refName(d.get("bank"));
        if (!bank.isBlank()) rows.add(info("Ngân hàng", bank));
        String note = text(d, "note");
        if (!note.isBlank()) rows.add(info("Ghi chú", note));
        rows.add(List.of());

        rows.add(List.of(Cell.header("STT"), Cell.header("Tên hàng hoá"), Cell.header("Số lượng"),
                Cell.header("Đơn giá"), Cell.header("Thành tiền")));

        long totalQty = 0;
        long totalAmount = 0;
        int index = 1;
        Object rawLines = d.get("lines");
        if (rawLines instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> raw)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> line = (Map<String, Object>) raw;
                long qty = num(line.get("qty"));
                long price = num(line.get("price"));
                long amount = qty * price;
                totalQty += qty;
                totalAmount += amount;
                rows.add(List.of(Cell.number(index++), Cell.text(refName(line.get("product"))),
                        Cell.number(qty), Cell.number(price), Cell.number(amount)));
            }
        }
        rows.add(List.of(Cell.text(null), Cell.total("Tổng cộng"), Cell.totalNumber(totalQty),
                Cell.text(null), Cell.totalNumber(totalAmount)));

        String fileName = "phieu-" + (text(d, "no").isBlank() ? id : text(d, "no")) + ".xlsx";
        return Response.ok(XlsxWriter.write(title, new int[]{6, 44, 12, 16, 18}, rows, false),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"")
                .build();
    }

    private static List<Cell> info(String label, String value) {
        return List.of(Cell.text(null), Cell.label(label), Cell.text(value));
    }

    private static List<Cell> info(String label1, String value1, String label2, String value2) {
        return List.of(Cell.text(null), Cell.label(label1), Cell.text(value1), Cell.label(label2), Cell.text(value2));
    }

    private static String text(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v == null ? "" : String.valueOf(v);
    }

    private static String refName(Object ref) {
        return ref instanceof Map<?, ?> m && m.get("name") != null ? String.valueOf(m.get("name")) : "";
    }

    private static long num(Object v) {
        return v instanceof Number n ? n.longValue() : 0L;
    }

    private static String dateText(Object v) {
        if (v instanceof List<?> parts && parts.size() >= 3) {
            return String.format("%02d/%02d/%04d", num(parts.get(2)), num(parts.get(1)), num(parts.get(0)));
        }
        String s = v == null ? "" : String.valueOf(v);
        return s.length() >= 10 && s.charAt(4) == '-' ? s.substring(8, 10) + "/" + s.substring(5, 7) + "/" + s.substring(0, 4) : s;
    }

    /**
     * Tìm kiếm/lọc phiếu kho (thay cho việc FE tải hết rồi lọc ở client).
     * Hợp đồng giống MasterResource: q, page, pageSize, sort, dir + bộ lọc riêng (type, dateFrom, dateTo)
     * Trả { "items": [...], "total": N }  (total = số phiếu khớp điều kiện, chưa cắt trang)
     */
    @GET
    public Map<String, Object> list(@QueryParam("q") String q,
                                    @QueryParam("type") String type,
                                    @QueryParam("dateFrom") String dateFrom,
                                    @QueryParam("dateTo") String dateTo,
                                    @QueryParam("page") Integer page,
                                    @QueryParam("pageSize") Integer pageSize,
                                    @QueryParam("sort") String sort,
                                    @QueryParam("dir") @DefaultValue("asc") String dir) {
        permissions.require("inventory", "READ");
        StringBuilder where = new StringBuilder(" where 1=1");
        Map<String, Object> params = new HashMap<>();

        // q: tìm không phân biệt hoa/thường trên số phiếu, tên đối tác, ghi chú (named parameter)
        if (q != null && !q.isBlank()) {
            where.append(" and (lower(d.no) like :q or lower(d.partner.name) like :q or lower(d.note) like :q)");
            params.put("q", "%" + q.trim().toLowerCase() + "%");
        }
        if (type != null && !type.isBlank()) {
            if (!PREFIX.containsKey(type)) throw MasterResource.bad("Loại phiếu không hợp lệ");
            where.append(" and d.type = :type");
            params.put("type", type);
        }
        if (dateFrom != null && !dateFrom.isBlank()) { where.append(" and d.date >= :dateFrom"); params.put("dateFrom", parseDate(dateFrom)); }
        if (dateTo != null && !dateTo.isBlank()) { where.append(" and d.date <= :dateTo"); params.put("dateTo", parseDate(dateTo)); }

        TypedQuery<InvDoc> query = em.createQuery("select d from InvDoc d" + where + orderBy(sort, dir), InvDoc.class);
        TypedQuery<Long> count = em.createQuery("select count(d) from InvDoc d" + where, Long.class);
        params.forEach((k, v) -> { query.setParameter(k, v); count.setParameter(k, v); });

        List<InvDoc> items;
        if (page != null || pageSize != null) {
            int pg = Math.max(1, page == null ? 1 : page);
            int size = Math.min(Math.max(1, pageSize == null ? 20 : pageSize), 100);   // chặn [1,100] — BE-R7
            items = query.setFirstResult((pg - 1) * size).setMaxResults(size).getResultList();
        } else {
            items = query.setMaxResults(MAX_UNPAGED).getResultList();
        }
        return Map.of("items", items, "total", count.getSingleResult());
    }

    /** Mặc định: phiếu mới nhất trước. Có sort: <cột whitelist> <dir>, d.id asc (ổn định khi trùng) */
    private static String orderBy(String sort, String dir) {
        String path = (sort == null || sort.isBlank()) ? null : SORTABLE.get(sort);
        if (path == null) return " order by d.id desc";
        return " order by " + path + ("desc".equalsIgnoreCase(dir) ? " desc" : " asc") + ", d.id asc";
    }

    /** Ngày sai định dạng ⇒ 400 {"message":...} thay vì 500 (BE-R11 / CS-S8) */
    private static LocalDate parseDate(String v) {
        try { return LocalDate.parse(v.trim()); }
        catch (DateTimeParseException ex) { throw MasterResource.bad("Ngày không hợp lệ (định dạng YYYY-MM-DD)"); }
    }

    /**
     * Fix A: InvLine là bên sở hữu doc_id/pos (xem InvLine.doc) nên mọi dòng phải được gán
     * quan hệ + thứ tự TRƯỚC khi flush; nếu không Hibernate ghi NULL vào cột NOT NULL.
     * Index trong mảng chính là pos (0..n-1) ⇒ giữ đúng thứ tự kéo thả + UNIQUE(doc_id, pos).
     */
    private static void linkLines(InvDoc doc, List<InvLine> lines) {
        for (int i = 0; i < lines.size(); i++) {
            InvLine l = lines.get(i);
            l.id = null;                                    // server cấp id (BE-P7)
            l.doc = doc;                                    // ⇒ cột doc_id được ghi trong INSERT
            l.pos = i;                                      // ⇒ cột pos được ghi trong INSERT
            if (!doc.lines.contains(l)) doc.lines.add(l);    // đồng bộ 2 chiều (update: đang duyệt in.lines)
        }
    }

    /**
     * Quy tắc kho theo loại phiếu:
     * - import/return: chỉ dùng warehouseIn; warehouseOut là kho khách hàng (chưa có nguồn dữ liệu) ⇒ null.
     * - export: chỉ dùng warehouseOut; warehouseIn là kho khách hàng (chưa có nguồn dữ liệu) ⇒ null.
     * - transfer: bắt buộc chọn cả kho nhập và kho xuất.
     */
    private static void applyWarehouseRules(InvDoc d) {
        if (d.type == null || !PREFIX.containsKey(d.type)) throw MasterResource.bad("Loại phiếu không hợp lệ");
        if ("import".equals(d.type) || "return".equals(d.type)) {
            d.warehouseOut = null;
        } else if ("export".equals(d.type)) {
            d.warehouseIn = null;
        } else if (!d.hasWarehouseIn() || !d.hasWarehouseOut()) {
            throw MasterResource.bad("Phiếu điều chuyển phải có đủ kho nhập và kho xuất");
        }
    }

    @POST @Transactional
    public Response create(InvDoc d) {
        permissions.require("inventory", "CREATE");
        applyWarehouseRules(d);
        d.id = null;                                   // id do server cấp
        linkLines(d, d.lines);                         // Fix A: gán doc_id + pos trước khi persist
        long n = InvDoc.count("type", d.type) + 1;     // tốt hơn: dùng sequence/bảng counter để tránh trùng khi đồng thời
        d.no = PREFIX.get(d.type) + String.format("%04d", n);
        d.persist();
        return Response.status(201).entity(d).build();
    }

    @POST @Path("import") @Transactional
    public Response importDocs(List<InvDoc> docs) {
        permissions.require("inventory", "IMPORT");
        if (docs == null || docs.isEmpty()) throw MasterResource.bad("Danh sách import rỗng");
        if (docs.size() > 500) throw MasterResource.bad("Chỉ import tối đa 500 phiếu mỗi lần");
        int imported = 0;
        for (InvDoc d : docs) {
            applyWarehouseRules(d);
            d.id = null;
            linkLines(d, d.lines == null ? new ArrayList<>() : d.lines);
            long n = InvDoc.count("type", d.type) + 1;
            d.no = PREFIX.get(d.type) + String.format("%04d", n);
            d.persist();
            em.flush();
            imported++;

        }
        return Response.status(Response.Status.CREATED).entity(Map.of("imported", imported)).build();
    }

    @PUT @Path("{id}") @Transactional
    public InvDoc update(@PathParam("id") Long id, InvDoc in) {
        permissions.require("inventory", "UPDATE");
        InvDoc d = InvDoc.findById(id);
        if (d == null) throw new NotFoundException();
        d.partner = in.partner; d.bank = in.bank; d.date = in.date; d.note = in.note;
        d.warehouseIn = in.warehouseIn; d.warehouseOut = in.warehouseOut;
        applyWarehouseRules(d);
        if (!d.lines.isEmpty()) {
            d.lines.clear();
            // Fix A (bắt buộc kèm theo): xoá dòng cũ PHẢI chạy trước khi chèn dòng mới,
            // nếu không sẽ vi phạm UNIQUE(doc_id, pos) khi pos mới trùng pos cũ (0..n-1).
            em.flush();
        }
        linkLines(d, in.lines);                        // Fix A: thêm dòng mới với doc_id + pos = 0..n-1
        return d;
    }

    @DELETE @Path("{id}") @Transactional
    public void delete(@PathParam("id") Long id) {
        permissions.require("inventory", "DELETE");
        InvDoc.deleteById(id);
    }

    @POST @Path("bulk-delete") @Transactional
    public void bulkDelete(List<Long> ids) {
        permissions.require("inventory", "DELETE");
        if (ids == null || ids.isEmpty()) return;    // BE-P6: chặn danh sách rỗng
        if (ids.size() > 500) throw MasterResource.bad("Chỉ xoá tối đa 500 phiếu mỗi lần");   // CS-S14
        InvDoc.delete("id in ?1", ids);
    }
}