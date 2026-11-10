package com.vinhcancode.sales.resource;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vinhcancode.sales.entity.Bank;
import com.vinhcancode.sales.entity.Customer;
import com.vinhcancode.sales.entity.Employee;
import com.vinhcancode.sales.entity.MasterEntity;
import com.vinhcancode.sales.entity.Material;
import com.vinhcancode.sales.entity.MaterialType;
import com.vinhcancode.sales.entity.Partner;
import com.vinhcancode.sales.entity.Supplier;
import com.vinhcancode.sales.entity.Unit;
import com.vinhcancode.sales.entity.Warehouse;
import com.vinhcancode.sales.service.PermissionService;
import com.vinhcancode.sales.service.XlsxWriter;
import com.vinhcancode.sales.service.XlsxWriter.Cell;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.util.Map.entry;

/**
 * Xuất Excel (.xlsx) toàn bộ dữ liệu danh mục.
 * GET /api/master/{catalog}/export-excel — không phân trang, dùng chung một endpoint cho mọi danh mục.
 */
@Path("/master")
@Authenticated
public class MasterExportResource {

    private static final String XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private record Spec(Class<? extends MasterEntity> type, String title, List<String> fields) { }

    private static final Map<String, String> LABELS = Map.ofEntries(
            entry("code", "Mã"), entry("name", "Tên"), entry("phone", "Điện thoại"),
            entry("address", "Địa chỉ"), entry("branch", "Chi nhánh"), entry("unit", "Đơn vị tính"),
            entry("price", "Đơn giá"), entry("typeId", "Nhóm vật tư"), entry("email", "Email"),
            entry("position", "Chức vụ"), entry("departmentId", "Phòng ban"), entry("manager", "Trưởng phòng"),
            entry("kind", "Loại đối tượng"), entry("fromAccount", "TK nguồn"), entry("toAccount", "TK đích"),
            entry("description", "Diễn giải"));

    private static final Map<String, String> KINDS = Map.of(
            "customer", "Khách hàng", "supplier", "Nhà cung cấp", "both", "Cả hai", "other", "Khác");

    private static final Map<String, Spec> CATALOGS = Map.ofEntries(
            entry("suppliers", new Spec(Supplier.class, "Nhà cung cấp", List.of("code", "name", "phone", "address"))),
            entry("customers", new Spec(Customer.class, "Khách hàng", List.of("code", "name", "phone", "address"))),
            entry("banks", new Spec(Bank.class, "Ngân hàng", List.of("code", "name", "branch"))),
            entry("warehouses", new Spec(Warehouse.class, "Kho hàng", List.of("code", "name", "address"))),
            entry("units", new Spec(Unit.class, "Đơn vị tính", List.of("code", "name"))),
            entry("materialTypes", new Spec(MaterialType.class, "Nhóm vật tư", List.of("name"))),
            entry("materials", new Spec(Material.class, "Vật tư", List.of("code", "name", "unit", "price", "typeId"))),
            entry("employees", new Spec(Employee.class, "Nhân viên", List.of("code", "name", "phone", "email", "position"))),
            entry("partners", new Spec(Partner.class, "Đối tượng", List.of("code", "name", "phone", "address", "kind"))));

    @Inject
    protected EntityManager em;

    @Inject
    protected ObjectMapper mapper;

    @Inject
    protected PermissionService permissions;

    @GET
    @Path("/{catalog}/export-excel")
    @Produces(XLSX_MIME)
    public Response exportExcel(@PathParam("catalog") String catalog) {
        permissions.require("catalog", "EXPORT");
        Spec spec = CATALOGS.get(catalog);
        if (spec == null) throw new NotFoundException();

        List<? extends MasterEntity> entities = em
                .createQuery("select e from " + spec.type().getSimpleName() + " e order by e.code", spec.type())
                .getResultList();
        List<Map<String, Object>> rows = mapper.convertValue(entities, new TypeReference<List<Map<String, Object>>>() { });

        Map<String, String> typeNames = spec.fields().contains("typeId") ? names("MaterialType") : Map.of();
        Map<String, String> deptNames = spec.fields().contains("departmentId") ? names("Department") : Map.of();

        List<List<Cell>> table = new ArrayList<>(rows.size() + 1);
        table.add(spec.fields().stream().map(f -> Cell.header(LABELS.get(f))).toList());
        for (Map<String, Object> row : rows) {
            List<Cell> line = new ArrayList<>(spec.fields().size());
            for (String field : spec.fields()) line.add(Cell.of(value(row, field, typeNames, deptNames)));
            table.add(line);
        }

        int[] widths = new int[spec.fields().size()];
        Arrays.fill(widths, 24);

        String fileName = "master-" + catalog + ".xlsx";
        return Response.ok(XlsxWriter.write(spec.title(), widths, table, true), XLSX_MIME)
                .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"")
                .build();
    }

    private Map<String, String> names(String entity) {
        Map<String, String> map = new HashMap<>();
        for (Object[] r : em.createQuery("select e.id, e.name from " + entity + " e", Object[].class).getResultList()) {
            map.put((String) r[0], (String) r[1]);
        }
        return map;
    }

    private static Object value(Map<String, Object> row, String field, Map<String, String> typeNames, Map<String, String> deptNames) {
        Object v = row.get(field);
        if (v == null) return null;
        if ("typeId".equals(field)) return typeNames.get(String.valueOf(v));
        if ("departmentId".equals(field)) return deptNames.get(String.valueOf(v));
        if ("kind".equals(field)) return KINDS.getOrDefault(String.valueOf(v), String.valueOf(v));
        return v;
    }
}
