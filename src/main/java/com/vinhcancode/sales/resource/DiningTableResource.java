package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.DiningTable;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;

@Path("/dining-tables")
public class DiningTableResource extends MasterResource<DiningTable> {

    @Override
    protected Class<DiningTable> type() {
        return DiningTable.class;
    }

    @Override
    protected List<String> searchFields() {
        return List.of("code", "name", "area", "note", "reservedCustomerName", "reservedCustomerPhone");
    }

    @Override
    protected String codePrefix() {
        return "BAN";
    }

    @Override
    protected String module() {
        return "tables";
    }

    @Override
    protected void requirePermission(String action) {
        if ("READ".equalsIgnoreCase(action)) {
            // Cho phép xem nếu có quyền trên tables, minibar hoặc catalog
            if (!permissions.has("tables", "READ") && !permissions.has("minibar", "READ") && !permissions.has("catalog", "READ")) {
                permissions.require("tables", "READ");
            }
            return;
        }
        // Thêm / Sửa / Xóa cấu hình danh mục bàn: yêu cầu quyền tables tương ứng
        permissions.require("tables", action);
    }

    @Override
    @Transactional
    public Response create(Map<String, Object> body) {
        permissions.require("tables", "CREATE");
        return super.create(body);
    }

    @Override
    @Transactional
    public DiningTable update(String id, Map<String, Object> body) {
        // Kiểm tra xem request có chỉnh sửa thông tin cấu hình danh mục bàn hay không (tên, mã, tầng, sức chứa, active)
        boolean hasCatalogFields = body.containsKey("name") || body.containsKey("code") 
                || body.containsKey("area") || body.containsKey("capacity") || body.containsKey("active");
        
        if (hasCatalogFields) {
            permissions.require("tables", "UPDATE");
        } else {
            // Cập nhật nghiệp vụ phục vụ bàn (trạng thái occupied/empty, đặt bàn): cho phép nếu có quyền tables:UPDATE hoặc minibar:UPDATE / minibar:CREATE
            if (!permissions.has("tables", "UPDATE") && !permissions.has("minibar", "UPDATE") && !permissions.has("minibar", "CREATE")) {
                permissions.require("tables", "UPDATE");
            }
        }

        DiningTable e = em.find(DiningTable.class, id);
        if (e == null) throw new NotFoundException();
        body.remove("id");
        try { 
            mapper.updateValue(e, body); 
        } catch (com.fasterxml.jackson.databind.JsonMappingException ex) { 
            throw new BadRequestException(ex.getMessage()); 
        }
        validate(e);
        if (e.name != null) e.name = e.name.trim();
        e.code = blank(e.code) ? (codePrefix() != null ? nextCode(codePrefix()) : null) : e.code.trim();
        normalize(e);
        flushOrConflict("Mã đã tồn tại hoặc dữ liệu không hợp lệ");
        return e;
    }

    @Override
    @Transactional
    public Response delete(String id) {
        permissions.require("tables", "DELETE");
        return super.delete(id);
    }

    @Override
    protected void applyFilters(MultivaluedMap<String, String> f, Where w) {
        String area = first(f, "area");
        if (area != null && !area.isBlank()) {
            w.and("e.area = :area", "area", area);
        }
        String status = first(f, "status");
        if (status != null && !status.isBlank()) {
            w.and("e.status = :status", "status", status);
        }
        String active = first(f, "active");
        if (active != null && !active.isBlank()) {
            w.and("e.active = :active", "active", Boolean.parseBoolean(active));
        }
        String customer = first(f, "customer");
        if (customer != null && !customer.isBlank()) {
            w.and("(lower(e.reservedCustomerName) like :cust or lower(e.reservedCustomerPhone) like :cust)", "cust", "%" + customer.trim().toLowerCase() + "%");
        }
        String phone = first(f, "phone");
        if (phone != null && !phone.isBlank()) {
            w.and("lower(e.reservedCustomerPhone) like :phone", "phone", "%" + phone.trim().toLowerCase() + "%");
        }
    }

    @Override
    protected Map<String, String> sortable() {
        return Map.of(
            "code", "e.code",
            "name", "e.name",
            "area", "e.area",
            "capacity", "e.capacity",
            "status", "e.status"
        );
    }

    /** Cập nhật nhanh trạng thái bàn khi mở bàn, chuyển bàn hoặc thanh toán */
    @PUT
    @Path("/{id}/status")
    @Transactional
    public Response updateStatus(@PathParam("id") String id, Map<String, Object> body) {
        if (!permissions.has("tables", "UPDATE") && !permissions.has("minibar", "UPDATE") && !permissions.has("minibar", "CREATE")) {
            permissions.require("tables", "UPDATE");
        }
        DiningTable table = em.find(DiningTable.class, id);
        if (table == null) {
            throw new NotFoundException("Không tìm thấy bàn");
        }
        if (body.containsKey("status")) {
            table.status = String.valueOf(body.get("status"));
        }
        if (body.containsKey("currentDocId")) {
            Object docId = body.get("currentDocId");
            table.currentDocId = docId != null ? String.valueOf(docId) : null;
        }
        if (body.containsKey("note")) {
            table.note = (String) body.get("note");
        }
        if (body.containsKey("reservedCustomerName")) {
            Object v = body.get("reservedCustomerName");
            table.reservedCustomerName = v != null ? String.valueOf(v) : null;
        }
        if (body.containsKey("reservedCustomerPhone")) {
            Object v = body.get("reservedCustomerPhone");
            table.reservedCustomerPhone = v != null ? String.valueOf(v) : null;
        }
        if (body.containsKey("reservedTime")) {
            Object v = body.get("reservedTime");
            table.reservedTime = v != null ? String.valueOf(v) : null;
        }
        em.flush();
        return Response.ok(table).build();
    }

    /** Đổi tên tầng / khu vực hàng loạt cho tất cả các bàn thuộc tầng đó */
    @POST
    @Path("/areas/rename")
    @Transactional
    public Response renameArea(Map<String, String> body) {
        permissions.require("tables", "UPDATE");
        String oldName = body.get("oldName");
        String newName = body.get("newName");
        if (oldName == null || oldName.isBlank() || newName == null || newName.isBlank()) {
            throw new BadRequestException("Tên tầng cũ và mới không được để trống");
        }
        int updated = em.createQuery("UPDATE DiningTable t SET t.area = :newName WHERE t.area = :oldName")
                .setParameter("newName", newName.trim())
                .setParameter("oldName", oldName.trim())
                .executeUpdate();
        return Response.ok(Map.of("updated", updated, "newName", newName.trim())).build();
    }

    /** Xóa / Chuyển tầng và gán các bàn sang tầng đích */
    @POST
    @Path("/areas/delete")
    @Transactional
    public Response deleteArea(Map<String, String> body) {
        permissions.require("tables", "DELETE");
        String areaName = body.get("areaName");
        String targetArea = body.getOrDefault("targetArea", "Khu vực chung");
        if (areaName == null || areaName.isBlank()) {
            throw new BadRequestException("Tên tầng cần xóa không hợp lệ");
        }
        int updated = em.createQuery("UPDATE DiningTable t SET t.area = :targetArea WHERE t.area = :areaName")
                .setParameter("targetArea", targetArea != null ? targetArea.trim() : "Khu vực chung")
                .setParameter("areaName", areaName.trim())
                .executeUpdate();
        return Response.ok(Map.of("updated", updated, "targetArea", targetArea)).build();
    }
}
