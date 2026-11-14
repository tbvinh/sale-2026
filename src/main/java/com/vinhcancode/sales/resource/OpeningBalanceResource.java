package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Account;
import com.vinhcancode.sales.entity.Material;
import com.vinhcancode.sales.entity.OpeningBalance;
import com.vinhcancode.sales.entity.Warehouse;
import com.vinhcancode.sales.service.XlsxReader;
import com.vinhcancode.sales.service.XlsxWriter;
import com.vinhcancode.sales.service.XlsxWriter.Cell;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/opening-balances")
public class OpeningBalanceResource extends MasterResource<OpeningBalance> {
    private static final String XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    protected Class<OpeningBalance> type() { return OpeningBalance.class; }
    protected List<String> searchFields() { return List.of("code", "name"); }
    protected String codePrefix() { return "DK"; }
    @Override protected String module() { return "opening"; }

    @Override protected Map<String, String> sortable() {
        return Map.of("code", "e.code", "name", "e.name", "kind", "e.kind", "amount", "e.amount",
                "quantity", "e.quantity", "unitPrice", "e.unitPrice", "dueDate", "e.dueDate",
                "warehouseId", "e.warehouseId", "date", "e.date", "accountId", "e.accountId");
    }

    @Override protected void applyFilters(MultivaluedMap<String, String> f, Where w) {
        String kind = first(f, "kind");
        if (kind != null) w.and("e.kind = :kind", "kind", kind);
        String direction = first(f, "direction");
        if (direction != null) w.and("e.direction = :direction", "direction", direction);
        String warehouseId = first(f, "warehouseId");
        if (warehouseId != null && !warehouseId.isBlank()) w.and("e.warehouseId = :warehouseId", "warehouseId", warehouseId);
        String accountId = first(f, "accountId");
        if (accountId != null && !accountId.isBlank()) w.and("e.accountId = :accountId", "accountId", accountId);
    }

    @Override protected void validate(OpeningBalance e) {
        super.validate(e);
        if (blank(e.kind)) e.kind = "material";
    }

    @Override protected void normalize(OpeningBalance e) {
        if (blank(e.kind)) e.kind = "material";
        e.partnerId = blank(e.partnerId) ? null : e.partnerId;
        e.bankId = blank(e.bankId) ? null : e.bankId;
        e.accountId = blank(e.accountId) ? null : e.accountId;
        e.materialId = blank(e.materialId) ? null : e.materialId;
        e.warehouseId = blank(e.warehouseId) ? null : e.warehouseId;
        e.employeeId = blank(e.employeeId) ? null : e.employeeId;
        if (blank(e.direction)) e.direction = defaultDirection(e.kind);
        if (e.quantity < 0) e.quantity = 0;
        if (e.unitPrice < 0) e.unitPrice = 0;
        if (e.amount < 0) e.amount = 0;
        if ("material".equals(e.kind)) {
            if (e.amount == 0 && e.quantity > 0 && e.unitPrice > 0) e.amount = e.quantity * e.unitPrice;
            if (e.date == null) e.date = java.time.LocalDate.now();
        } else if ("cash".equals(e.kind)) {
            e.quantity = 0;
            e.unitPrice = 0;
            if (e.date == null) e.date = java.time.LocalDate.now();
        }
        if (e.interestRate == null || e.interestRate.signum() < 0) e.interestRate = BigDecimal.ZERO;
    }

    private static String defaultDirection(String kind) {
        if (kind == null) return null;
        return switch (kind) {
            case "debt" -> "receivable";
            case "loan" -> "credit";
            default -> "debit";
        };
    }

    /** Xuất file Excel dữ liệu tồn kho / tồn quỹ đầu kỳ. */
    @GET
    @Path("/export-excel")
    @Produces(XLSX_MIME)
    public Response exportExcel(@QueryParam("kind") String kind,
                                @QueryParam("warehouseId") String warehouseId,
                                @QueryParam("accountId") String accountId) {
        permissions.require(module(), "EXPORT");
        if ("cash".equalsIgnoreCase(kind)) {
            return exportExcelCash(accountId);
        }
        return exportExcelMaterial(warehouseId);
    }

    private Response exportExcelMaterial(String warehouseId) {
        StringBuilder hql = new StringBuilder("select o from OpeningBalance o where o.kind = 'material'");
        Map<String, Object> params = new HashMap<>();
        if (warehouseId != null && !warehouseId.isBlank() && !warehouseId.equalsIgnoreCase("all")) {
            hql.append(" and o.warehouseId = :whId");
            params.put("whId", warehouseId.trim());
        }
        hql.append(" order by o.code asc");

        jakarta.persistence.TypedQuery<OpeningBalance> q = em.createQuery(hql.toString(), OpeningBalance.class);
        params.forEach(q::setParameter);
        List<OpeningBalance> list = q.getResultList();

        Map<String, Material> materials = new HashMap<>();
        for (Material m : em.createQuery("select m from Material m", Material.class).getResultList()) {
            materials.put(m.id, m);
        }
        Map<String, Warehouse> warehouses = new HashMap<>();
        for (Warehouse w : em.createQuery("select w from Warehouse w", Warehouse.class).getResultList()) {
            warehouses.put(w.id, w);
        }

        List<List<Cell>> rows = new ArrayList<>();
        rows.add(List.of(
                Cell.header("STT"),
                Cell.header("Mã vật tư"),
                Cell.header("Tên vật tư"),
                Cell.header("Đơn vị tính"),
                Cell.header("Mã kho"),
                Cell.header("Tên kho"),
                Cell.header("Ngày chứng từ"),
                Cell.header("Số lượng"),
                Cell.header("Đơn giá"),
                Cell.header("Thành tiền"),
                Cell.header("Diễn giải")
        ));

        int stt = 1;
        for (OpeningBalance o : list) {
            Material m = o.materialId != null ? materials.get(o.materialId) : null;
            Warehouse w = o.warehouseId != null ? warehouses.get(o.warehouseId) : null;
            String matCode = m != null && m.code != null ? m.code : "";
            String matName = m != null && m.name != null ? m.name : (o.name != null ? o.name : "");
            String unit = m != null && m.unit != null ? m.unit : "";
            String whCode = w != null && w.code != null ? w.code : "";
            String whName = w != null && w.name != null ? w.name : "";
            String dateStr = o.date != null ? o.date.toString() : "";

            rows.add(List.of(
                    Cell.number(stt++),
                    Cell.text(matCode),
                    Cell.text(matName),
                    Cell.text(unit),
                    Cell.text(whCode),
                    Cell.text(whName),
                    Cell.text(dateStr),
                    Cell.number(o.quantity),
                    Cell.number(o.unitPrice),
                    Cell.number(o.amount),
                    Cell.text(o.name != null ? o.name : "")
            ));
        }

        int[] widths = {8, 16, 32, 12, 16, 26, 16, 14, 16, 18, 30};
        byte[] bytes = XlsxWriter.write("Ton kho dau ky", widths, rows, true);
        return Response.ok(bytes)
                .header("Content-Disposition", "attachment; filename=\"ton-kho-dau-ky.xlsx\"")
                .build();
    }

    private Response exportExcelCash(String accountId) {
        StringBuilder hql = new StringBuilder("select o from OpeningBalance o where o.kind = 'cash'");
        Map<String, Object> params = new HashMap<>();
        if (accountId != null && !accountId.isBlank() && !accountId.equalsIgnoreCase("all")) {
            hql.append(" and o.accountId = :accId");
            params.put("accId", accountId.trim());
        }
        hql.append(" order by o.code asc");

        jakarta.persistence.TypedQuery<OpeningBalance> q = em.createQuery(hql.toString(), OpeningBalance.class);
        params.forEach(q::setParameter);
        List<OpeningBalance> list = q.getResultList();

        Map<String, Account> accounts = new HashMap<>();
        for (Account a : em.createQuery("select a from Account a", Account.class).getResultList()) {
            accounts.put(a.id, a);
        }

        List<List<Cell>> rows = new ArrayList<>();
        rows.add(List.of(
                Cell.header("STT"),
                Cell.header("Mã chứng từ"),
                Cell.header("Ngày chứng từ"),
                Cell.header("Mã tài khoản"),
                Cell.header("Tên tài khoản quỹ"),
                Cell.header("Số tiền (VND)"),
                Cell.header("Diễn giải")
        ));

        int stt = 1;
        for (OpeningBalance o : list) {
            Account a = o.accountId != null ? accounts.get(o.accountId) : null;
            String accCode = a != null && a.code != null ? a.code : "";
            String accName = a != null && a.name != null ? a.name : "";
            String dateStr = o.date != null ? o.date.toString() : "";

            rows.add(List.of(
                    Cell.number(stt++),
                    Cell.text(o.code != null ? o.code : ""),
                    Cell.text(dateStr),
                    Cell.text(accCode),
                    Cell.text(accName),
                    Cell.number(o.amount),
                    Cell.text(o.name != null ? o.name : "")
            ));
        }

        int[] widths = {8, 16, 16, 16, 32, 20, 32};
        byte[] bytes = XlsxWriter.write("Ton quy dau ky", widths, rows, true);
        return Response.ok(bytes)
                .header("Content-Disposition", "attachment; filename=\"ton-quy-dau-ky.xlsx\"")
                .build();
    }

    /** Tải file Excel mẫu để người dùng điền tồn kho / tồn quỹ đầu kỳ. */
    @GET
    @Path("/template-excel")
    @Produces(XLSX_MIME)
    public Response templateExcel(@QueryParam("kind") String kind) {
        permissions.require(module(), "EXPORT");
        if ("cash".equalsIgnoreCase(kind)) {
            return templateExcelCash();
        }
        return templateExcelMaterial();
    }

    private Response templateExcelMaterial() {
        List<List<Cell>> rows = new ArrayList<>();
        rows.add(List.of(
                Cell.header("STT"),
                Cell.header("Mã vật tư"),
                Cell.header("Tên vật tư"),
                Cell.header("Đơn vị tính"),
                Cell.header("Mã kho"),
                Cell.header("Tên kho"),
                Cell.header("Ngày chứng từ"),
                Cell.header("Số lượng"),
                Cell.header("Đơn giá"),
                Cell.header("Thành tiền"),
                Cell.header("Diễn giải")
        ));

        List<Material> sampleMats = em.createQuery("select m from Material m order by m.code asc", Material.class)
                .setMaxResults(5).getResultList();
        List<Warehouse> sampleWhs = em.createQuery("select w from Warehouse w order by w.code asc", Warehouse.class)
                .setMaxResults(2).getResultList();

        Warehouse defaultWh = !sampleWhs.isEmpty() ? sampleWhs.get(0) : null;
        int stt = 1;
        if (!sampleMats.isEmpty() && defaultWh != null) {
            for (Material m : sampleMats) {
                long price = m.price > 0 ? m.price : 15000L;
                long qty = 100L * stt;
                rows.add(List.of(
                        Cell.number(stt++),
                        Cell.text(m.code != null ? m.code : ""),
                        Cell.text(m.name != null ? m.name : ""),
                        Cell.text(m.unit != null ? m.unit : ""),
                        Cell.text(defaultWh.code != null ? defaultWh.code : ""),
                        Cell.text(defaultWh.name != null ? defaultWh.name : ""),
                        Cell.text("2026-01-01"),
                        Cell.number(qty),
                        Cell.number(price),
                        Cell.number(qty * price),
                        Cell.text("Tồn đầu kỳ " + (m.name != null ? m.name : ""))
                ));
            }
        } else {
            rows.add(List.of(
                    Cell.number(1),
                    Cell.text("VT-STEEL-10"),
                    Cell.text("Thép cuộn CB240-T Ø10"),
                    Cell.text("kg"),
                    Cell.text("WH-HN-01"),
                    Cell.text("Kho Trung Tâm Hà Nội"),
                    Cell.text("2026-01-01"),
                    Cell.number(1000),
                    Cell.number(16500),
                    Cell.number(16500000),
                    Cell.text("Tồn kho đầu kỳ Thép cuộn")
            ));
        }

        int[] widths = {8, 16, 32, 12, 16, 26, 16, 14, 16, 18, 30};
        byte[] bytes = XlsxWriter.write("Mau ton kho dau ky", widths, rows, true);
        return Response.ok(bytes)
                .header("Content-Disposition", "attachment; filename=\"ton-kho-dau-ky-mau.xlsx\"")
                .build();
    }

    private Response templateExcelCash() {
        List<List<Cell>> rows = new ArrayList<>();
        rows.add(List.of(
                Cell.header("STT"),
                Cell.header("Mã tài khoản"),
                Cell.header("Tên tài khoản quỹ"),
                Cell.header("Ngày chứng từ"),
                Cell.header("Số tiền"),
                Cell.header("Diễn giải")
        ));

        List<Account> sampleAccounts = em.createQuery(
                "select a from Account a where a.code like '111%' order by a.code asc", Account.class)
                .setMaxResults(3).getResultList();
        if (sampleAccounts.isEmpty()) {
            sampleAccounts = em.createQuery("select a from Account a order by a.code asc", Account.class)
                    .setMaxResults(2).getResultList();
        }

        int stt = 1;
        if (!sampleAccounts.isEmpty()) {
            for (Account a : sampleAccounts) {
                rows.add(List.of(
                        Cell.number(stt++),
                        Cell.text(a.code != null ? a.code : ""),
                        Cell.text(a.name != null ? a.name : ""),
                        Cell.text("2026-01-01"),
                        Cell.number(45000000L),
                        Cell.text("Tồn quỹ đầu kỳ " + (a.name != null ? a.name : ""))
                ));
            }
        } else {
            rows.add(List.of(
                    Cell.number(1),
                    Cell.text("1111"),
                    Cell.text("Tiền mặt Việt Nam Đồng"),
                    Cell.text("2026-01-01"),
                    Cell.number(45000000L),
                    Cell.text("Tồn quỹ tiền mặt đầu kỳ")
            ));
        }

        int[] widths = {8, 16, 32, 16, 20, 32};
        byte[] bytes = XlsxWriter.write("Mau ton quy dau ky", widths, rows, true);
        return Response.ok(bytes)
                .header("Content-Disposition", "attachment; filename=\"ton-quy-dau-ky-mau.xlsx\"")
                .build();
    }

    /**
     * Import tồn kho / tồn quỹ đầu kỳ từ file Excel (.xlsx) hoặc CSV.
     * Tồn kho: Composite key (Mã vật tư, Mã kho).
     * Tồn quỹ: Composite key (Mã tài khoản quỹ).
     * Cơ chế: REPLACE / UPSERT (cho phép import nhiều lần, cập nhật số liệu nếu đã có).
     */
    @POST
    @Path("/import-excel")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response importExcel(@RestForm("file") FileUpload file, @QueryParam("kind") String kind) {
        permissions.require(module(), "IMPORT");
        if (file == null || file.uploadedFile() == null) {
            throw bad("Chưa chọn tệp Excel hoặc CSV để import");
        }
        try (InputStream in = Files.newInputStream(file.uploadedFile())) {
            List<List<String>> rawRows = XlsxReader.read(in);
            Map<String, Object> result = processImportGrid(rawRows, kind);
            return Response.ok(result).build();
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (Exception ex) {
            throw bad("Lỗi xử lý file import: " + ex.getMessage());
        }
    }

    /** Hỗ trợ import qua mảng JSON rows. */
    @POST
    @Path("/import-json")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response importJson(@QueryParam("kind") String kind, List<Map<String, Object>> rows) {
        permissions.require(module(), "IMPORT");
        if (rows == null || rows.isEmpty()) throw bad("Danh sách import rỗng");
        boolean isCash = "cash".equalsIgnoreCase(kind)
                || rows.stream().anyMatch(r -> r.containsKey("accountId") || r.containsKey("accountCode"));
        List<List<String>> grid = new ArrayList<>();
        if (isCash) {
            grid.add(List.of("Mã tài khoản", "Ngày chứng từ", "Số tiền", "Diễn giải"));
            for (Map<String, Object> r : rows) {
                grid.add(List.of(
                        String.valueOf(r.getOrDefault("accountCode", r.getOrDefault("accountId", ""))),
                        String.valueOf(r.getOrDefault("date", "")),
                        String.valueOf(r.getOrDefault("amount", "")),
                        String.valueOf(r.getOrDefault("name", ""))
                ));
            }
        } else {
            grid.add(List.of("Mã vật tư", "Mã kho", "Ngày chứng từ", "Số lượng", "Đơn giá", "Thành tiền", "Diễn giải"));
            for (Map<String, Object> r : rows) {
                grid.add(List.of(
                        String.valueOf(r.getOrDefault("materialCode", r.getOrDefault("materialId", ""))),
                        String.valueOf(r.getOrDefault("warehouseCode", r.getOrDefault("warehouseId", ""))),
                        String.valueOf(r.getOrDefault("date", "")),
                        String.valueOf(r.getOrDefault("quantity", "")),
                        String.valueOf(r.getOrDefault("unitPrice", "")),
                        String.valueOf(r.getOrDefault("amount", "")),
                        String.valueOf(r.getOrDefault("name", ""))
                ));
            }
        }
        Map<String, Object> result = processImportGrid(grid, isCash ? "cash" : "material");
        return Response.ok(result).build();
    }

    private Map<String, Object> processImportGrid(List<List<String>> rows) {
        return processImportGrid(rows, null);
    }

    private Map<String, Object> processImportGrid(List<List<String>> rows, String kindParam) {
        if (rows == null || rows.isEmpty()) {
            throw bad("File dữ liệu rỗng");
        }

        int headerIdx = -1;
        for (int i = 0; i < Math.min(5, rows.size()); i++) {
            List<String> r = rows.get(i);
            if (isHeaderRow(r)) {
                headerIdx = i;
                break;
            }
        }

        boolean isCash = "cash".equalsIgnoreCase(kindParam);
        if (!isCash && headerIdx >= 0) {
            isCash = isCashHeader(rows.get(headerIdx));
        }

        if (isCash) {
            return processImportCashGrid(rows, headerIdx);
        }
        return processImportMaterialGrid(rows, headerIdx);
    }

    private Map<String, Object> processImportCashGrid(List<List<String>> rows, int headerIdx) {
        int colAccCode = -1, colAccName = -1, colDate = -1, colAmount = -1, colNote = -1;
        int dataStart = 0;
        if (headerIdx >= 0) {
            List<String> h = rows.get(headerIdx);
            dataStart = headerIdx + 1;
            for (int c = 0; c < h.size(); c++) {
                String name = normHeader(h.get(c));
                if (name.contains("ma tai khoan") || name.contains("ma tk") || name.equals("account") || name.equals("tk")) {
                    colAccCode = c;
                } else if (name.contains("ten tai khoan") || name.contains("ten tk")) {
                    colAccName = c;
                } else if (name.contains("ngay") || name.contains("date")) {
                    colDate = c;
                } else if (name.contains("so tien") || name.contains("thanh tien") || name.equals("amount") || name.equals("tien")) {
                    colAmount = c;
                } else if (name.contains("dien giai") || name.contains("ghi chu") || name.equals("note") || name.equals("description")) {
                    colNote = c;
                }
            }
        }

        if (colAccCode == -1) colAccCode = 1;
        if (colDate == -1) colDate = 3;
        if (colAmount == -1) colAmount = 4;
        if (colNote == -1) colNote = 5;

        Map<String, Account> accountsByCode = new HashMap<>();
        Map<String, Account> accountsByName = new HashMap<>();
        for (Account a : em.createQuery("select a from Account a", Account.class).getResultList()) {
            if (a.code != null) accountsByCode.put(a.code.trim().toLowerCase(), a);
            if (a.name != null) accountsByName.put(a.name.trim().toLowerCase(), a);
            if (a.id != null) accountsByCode.put(a.id.trim().toLowerCase(), a);
        }

        List<OpeningBalance> existingList = em.createQuery(
                "select o from OpeningBalance o where o.kind = 'cash'", OpeningBalance.class).getResultList();
        Map<String, OpeningBalance> existingMap = new HashMap<>();
        for (OpeningBalance o : existingList) {
            if (o.accountId != null) {
                existingMap.put(o.accountId, o);
            }
        }

        int created = 0;
        int updated = 0;
        List<String> errors = new ArrayList<>();

        for (int i = dataStart; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            int lineNum = i + 1;
            if (r.stream().allMatch(String::isBlank)) continue;

            String accCode = getCell(r, colAccCode);
            String accName = getCell(r, colAccName);
            String dateStr = getCell(r, colDate);
            String amountStr = getCell(r, colAmount);
            String noteStr = getCell(r, colNote);

            if (accCode.isBlank() && accName.isBlank()) {
                errors.add("Dòng " + lineNum + ": Thiếu mã hoặc tên tài khoản quỹ");
                continue;
            }

            Account acc = null;
            if (!accCode.isBlank()) acc = accountsByCode.get(accCode.toLowerCase());
            if (acc == null && !accName.isBlank()) acc = accountsByName.get(accName.toLowerCase());
            if (acc == null) {
                errors.add("Dòng " + lineNum + ": Không tìm thấy tài khoản '" + (accCode.isBlank() ? accName : accCode) + "' trong Danh mục");
                continue;
            }

            long amount = parseLongQuiet(amountStr, -1);
            if (amount < 0) {
                errors.add("Dòng " + lineNum + ": Số tiền không hợp lệ ('" + amountStr + "')");
                continue;
            }

            LocalDate date = parseDateQuiet(dateStr);
            if (date == null) {
                date = LocalDate.of(2026, 1, 1);
            }

            String desc = !noteStr.isBlank() ? noteStr : ("Tồn quỹ đầu kỳ " + acc.name);

            OpeningBalance existing = existingMap.get(acc.id);
            if (existing != null) {
                existing.amount = amount;
                existing.date = date;
                if (!noteStr.isBlank()) {
                    existing.name = noteStr;
                }
                normalize(existing);
                updated++;
            } else {
                OpeningBalance o = new OpeningBalance();
                o.id = UUID.randomUUID().toString();
                o.code = nextCode(codePrefix());
                o.kind = "cash";
                o.direction = "debit";
                o.accountId = acc.id;
                o.quantity = 0;
                o.unitPrice = 0;
                o.amount = amount;
                o.date = date;
                o.name = desc;
                o.interestRate = BigDecimal.ZERO;
                normalize(o);
                em.persist(o);
                existingMap.put(acc.id, o);
                created++;
            }
        }

        em.flush();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", created + updated);
        resp.put("created", created);
        resp.put("updated", updated);
        resp.put("errors", errors);
        return resp;
    }

    private Map<String, Object> processImportMaterialGrid(List<List<String>> rows, int headerIdx) {
        int colMatCode = -1, colMatName = -1, colWhCode = -1, colWhName = -1;
        int colDate = -1, colQty = -1, colPrice = -1, colAmount = -1, colNote = -1;

        int dataStart = 0;
        if (headerIdx >= 0) {
            List<String> h = rows.get(headerIdx);
            dataStart = headerIdx + 1;
            for (int c = 0; c < h.size(); c++) {
                String name = normHeader(h.get(c));
                if (name.contains("ma vat tu") || name.contains("ma vt") || name.contains("ma hang") || name.equals("material") || name.equals("product")) {
                    colMatCode = c;
                } else if (name.contains("ten vat tu") || name.contains("ten vt") || name.contains("ten hang")) {
                    colMatName = c;
                } else if (name.contains("ma kho") || name.equals("kho") || name.equals("warehouse") || name.equals("kho hang")) {
                    colWhCode = c;
                } else if (name.contains("ten kho")) {
                    colWhName = c;
                } else if (name.contains("ngay") || name.contains("date")) {
                    colDate = c;
                } else if (name.contains("so luong") || name.equals("sl") || name.equals("qty") || name.equals("quantity")) {
                    colQty = c;
                } else if (name.contains("don gia") || name.contains("gia") || name.equals("price") || name.equals("unitprice")) {
                    colPrice = c;
                } else if (name.contains("thanh tien") || name.contains("tien") || name.equals("amount")) {
                    colAmount = c;
                } else if (name.contains("dien giai") || name.contains("ghi chu") || name.equals("note") || name.equals("description")) {
                    colNote = c;
                }
            }
        }

        // Vị trí mặc định nếu không khớp tiêu đề
        if (colMatCode == -1) colMatCode = 1;
        if (colWhCode == -1) colWhCode = 4;
        if (colDate == -1) colDate = 6;
        if (colQty == -1) colQty = 7;
        if (colPrice == -1) colPrice = 8;
        if (colAmount == -1) colAmount = 9;
        if (colNote == -1) colNote = 10;

        // Bảng tra cứu danh mục
        Map<String, Material> matsByCode = new HashMap<>();
        Map<String, Material> matsByName = new HashMap<>();
        for (Material m : em.createQuery("select m from Material m", Material.class).getResultList()) {
            if (m.code != null) matsByCode.put(m.code.trim().toLowerCase(), m);
            if (m.name != null) matsByName.put(m.name.trim().toLowerCase(), m);
            if (m.id != null) matsByCode.put(m.id.trim().toLowerCase(), m);
        }

        Map<String, Warehouse> whsByCode = new HashMap<>();
        Map<String, Warehouse> whsByName = new HashMap<>();
        for (Warehouse w : em.createQuery("select w from Warehouse w", Warehouse.class).getResultList()) {
            if (w.code != null) whsByCode.put(w.code.trim().toLowerCase(), w);
            if (w.name != null) whsByName.put(w.name.trim().toLowerCase(), w);
            if (w.id != null) whsByCode.put(w.id.trim().toLowerCase(), w);
        }

        // Bảng tồn đầu kỳ hiện có để đối chiếu composite key (materialId, warehouseId)
        List<OpeningBalance> existingList = em.createQuery(
                "select o from OpeningBalance o where o.kind = 'material'", OpeningBalance.class)
                .getResultList();
        Map<String, OpeningBalance> existingMap = new HashMap<>();
        for (OpeningBalance o : existingList) {
            if (o.materialId != null && o.warehouseId != null) {
                existingMap.put(o.materialId + "::" + o.warehouseId, o);
            }
        }

        int created = 0;
        int updated = 0;
        List<String> errors = new ArrayList<>();

        for (int i = dataStart; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            int lineNum = i + 1;
            if (r.stream().allMatch(String::isBlank)) continue;

            String matCode = getCell(r, colMatCode);
            String matName = getCell(r, colMatName);
            String whCode = getCell(r, colWhCode);
            String whName = getCell(r, colWhName);
            String dateStr = getCell(r, colDate);
            String qtyStr = getCell(r, colQty);
            String priceStr = getCell(r, colPrice);
            String amountStr = getCell(r, colAmount);
            String noteStr = getCell(r, colNote);

            if (matCode.isBlank() && matName.isBlank()) {
                errors.add("Dòng " + lineNum + ": Thiếu mã hoặc tên vật tư");
                continue;
            }
            if (whCode.isBlank() && whName.isBlank()) {
                errors.add("Dòng " + lineNum + ": Thiếu mã hoặc tên kho");
                continue;
            }

            Material mat = null;
            if (!matCode.isBlank()) mat = matsByCode.get(matCode.toLowerCase());
            if (mat == null && !matName.isBlank()) mat = matsByName.get(matName.toLowerCase());
            if (mat == null) {
                errors.add("Dòng " + lineNum + ": Không tìm thấy vật tư '" + (matCode.isBlank() ? matName : matCode) + "' trong Danh mục");
                continue;
            }

            Warehouse wh = null;
            if (!whCode.isBlank()) wh = whsByCode.get(whCode.toLowerCase());
            if (wh == null && !whName.isBlank()) wh = whsByName.get(whName.toLowerCase());
            if (wh == null) {
                errors.add("Dòng " + lineNum + ": Không tìm thấy kho '" + (whCode.isBlank() ? whName : whCode) + "' trong Danh mục");
                continue;
            }

            long qty = parseLongQuiet(qtyStr, -1);
            if (qty < 0) {
                errors.add("Dòng " + lineNum + ": Số lượng không hợp lệ ('" + qtyStr + "')");
                continue;
            }

            long price = parseLongQuiet(priceStr, 0);
            if (price < 0) {
                errors.add("Dòng " + lineNum + ": Đơn giá không hợp lệ ('" + priceStr + "')");
                continue;
            }

            long amount = parseLongQuiet(amountStr, 0);
            if (amount <= 0 && qty > 0 && price > 0) {
                amount = qty * price;
            }

            LocalDate date = parseDateQuiet(dateStr);
            if (date == null) {
                date = LocalDate.of(2026, 1, 1);
            }

            String desc = !noteStr.isBlank() ? noteStr : (mat.name + " tồn kho " + wh.name);

            // Composite key: materialId + warehouseId -> REPLACE nếu đã có, INSERT nếu chưa có
            String compositeKey = mat.id + "::" + wh.id;
            OpeningBalance existing = existingMap.get(compositeKey);

            if (existing != null) {
                // REPLACE
                existing.quantity = qty;
                existing.unitPrice = price;
                existing.amount = amount;
                existing.date = date;
                if (!noteStr.isBlank()) {
                    existing.name = noteStr;
                }
                normalize(existing);
                updated++;
            } else {
                // INSERT
                OpeningBalance o = new OpeningBalance();
                o.id = UUID.randomUUID().toString();
                o.code = nextCode(codePrefix());
                o.kind = "material";
                o.direction = "debit";
                o.materialId = mat.id;
                o.warehouseId = wh.id;
                o.quantity = qty;
                o.unitPrice = price;
                o.amount = amount;
                o.date = date;
                o.name = desc;
                o.interestRate = BigDecimal.ZERO;
                normalize(o);
                em.persist(o);
                existingMap.put(compositeKey, o);
                created++;
            }
        }

        em.flush();

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", created + updated);
        resp.put("created", created);
        resp.put("updated", updated);
        resp.put("errors", errors);
        return resp;
    }

    private static String getCell(List<String> r, int idx) {
        if (r == null || idx < 0 || idx >= r.size()) return "";
        String s = r.get(idx);
        return s != null ? s.trim() : "";
    }

    private static boolean isHeaderRow(List<String> row) {
        for (String cell : row) {
            String norm = normHeader(cell);
            if (norm.contains("ma vat tu") || norm.contains("ma vt") || norm.contains("ma kho") || norm.contains("so luong")
                    || norm.contains("tai khoan") || norm.contains("ma tk") || norm.contains("quy")) {
                return true;
            }
        }
        return false;
    }

    private static boolean isCashHeader(List<String> header) {
        for (String cell : header) {
            String norm = normHeader(cell);
            if (norm.contains("ma vat tu") || norm.contains("ma vt") || norm.contains("kho hang") || norm.contains("ma kho") || norm.contains("so luong")) {
                return false;
            }
        }
        for (String cell : header) {
            String norm = normHeader(cell);
            if (norm.contains("tai khoan") || norm.contains("ma tk") || norm.contains("quy") || norm.contains("tien mat")) {
                return true;
            }
        }
        return false;
    }

    private static String normHeader(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s.trim().toLowerCase(), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}", "").replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
    }

    private static long parseLongQuiet(String s, long def) {
        if (s == null || s.isBlank()) return def;
        String clean = s.trim().replaceAll("\\s", "");
        if (clean.endsWith(".0") || clean.endsWith(",0") || clean.endsWith(".00") || clean.endsWith(",00")) {
            clean = clean.substring(0, clean.lastIndexOf(clean.contains(".") ? "." : ","));
        }
        if (clean.matches("^\\d{1,3}([.,]\\d{3})+$")) {
            clean = clean.replaceAll("[.,]", "");
        } else {
            clean = clean.replace(",", "");
            if (clean.contains(".")) clean = clean.substring(0, clean.indexOf('.'));
        }
        try {
            return Long.parseLong(clean);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static LocalDate parseDateQuiet(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        try {
            return LocalDate.parse(t);
        } catch (Exception ignored) { }
        if (t.contains("/")) {
            String[] p = t.split("/");
            if (p.length == 3) {
                try {
                    int d = Integer.parseInt(p[0]);
                    int m = Integer.parseInt(p[1]);
                    int y = Integer.parseInt(p[2]);
                    return LocalDate.of(y, m, d);
                } catch (Exception ignored) { }
            }
        }
        try {
            int serial = Integer.parseInt(t);
            if (serial > 30000 && serial < 60000) {
                return LocalDate.of(1899, 12, 30).plusDays(serial);
            }
        } catch (Exception ignored) { }
        return null;
    }
}
