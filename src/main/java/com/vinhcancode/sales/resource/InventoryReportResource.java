package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Material;
import com.vinhcancode.sales.entity.OpeningBalance;
import com.vinhcancode.sales.entity.Warehouse;
import com.vinhcancode.sales.service.PermissionService;
import com.vinhcancode.sales.service.XlsxWriter;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Bao cao kho: so chi tiet vat tu, tong hop NXT, so chi tiet ban hang va gia von.
 * Chi doc du lieu tu inv_doc / inv_doc_line va opening_balances (khong tao bang rieng).
 */
@Path("/inventory/reports")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated                                   // CS-S1
public class InventoryReportResource {
    private static final int MAX_ROWS = 5_000;

    @Inject EntityManager em;
    @Inject PermissionService permissions;

    // 4) So chi tiet vat lieu, san pham, hang hoa
    @GET @Path("/material-ledger")
    public Map<String, Object> materialLedger(@QueryParam("materialId") String materialId,
                                              @QueryParam("warehouseId") String warehouseId,
                                              @QueryParam("dateFrom") String dateFrom,
                                              @QueryParam("dateTo") String dateTo) {
        permissions.require("reports", "READ");
        return getMaterialLedgerReportData(materialId, warehouseId, dateFrom, dateTo);
    }

    /** Xuat Excel so chi tiet vat lieu, dung cu, san pham, hang hoa */
    @GET
    @Path("/material-ledger/export-excel")
    @Produces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public Response exportMaterialLedgerExcel(@QueryParam("materialId") String materialId,
                                              @QueryParam("warehouseId") String warehouseId,
                                              @QueryParam("dateFrom") String dateFrom,
                                              @QueryParam("dateTo") String dateTo) {
        permissions.require("reports", "READ");
        Map<String, Object> data = getMaterialLedgerReportData(materialId, warehouseId, dateFrom, dateTo);
        @SuppressWarnings("unchecked")
        Map<String, Object> mat = (Map<String, Object>) data.get("material");
        String matCode = mat != null ? (String) mat.get("code") : "";
        String matName = mat != null ? (String) mat.get("name") : "";
        String matUnit = mat != null ? (String) mat.get("unit") : "";

        List<List<XlsxWriter.Cell>> rows = new ArrayList<>();
        // Title & metadata
        rows.add(List.of(XlsxWriter.Cell.title("SỔ CHI TIẾT VẬT LIỆU, DỤNG CỤ, SẢN PHẨM, HÀNG HÓA")));
        rows.add(List.of(XlsxWriter.Cell.text("Từ ngày: " + data.get("dateFrom") + "   Đến ngày: " + data.get("dateTo"))));
        rows.add(List.of(XlsxWriter.Cell.text("Mặt hàng: [" + matCode + "] " + matName + "   ĐVT: " + (matUnit != null ? matUnit : ""))));
        rows.add(List.of()); // empty row

        // Header
        rows.add(List.of(
                XlsxWriter.Cell.header("Ngày"),
                XlsxWriter.Cell.header("Số CT"),
                XlsxWriter.Cell.header("Loại"),
                XlsxWriter.Cell.header("Đối tác"),
                XlsxWriter.Cell.header("Kho"),
                XlsxWriter.Cell.header("Đơn giá"),
                XlsxWriter.Cell.header("SL Nhập"),
                XlsxWriter.Cell.header("Tiền Nhập"),
                XlsxWriter.Cell.header("SL Xuất"),
                XlsxWriter.Cell.header("Tiền Xuất"),
                XlsxWriter.Cell.header("Tồn SL"),
                XlsxWriter.Cell.header("Tồn Tiền")
        ));

        // Opening row
        rows.add(List.of(
                XlsxWriter.Cell.label("Số dư đầu kỳ"),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.totalNumber(data.get("openingQty")),
                XlsxWriter.Cell.totalNumber(data.get("openingValue"))
        ));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        if (items != null) {
            for (Map<String, Object> r : items) {
                String type = (String) r.get("type");
                BigDecimal qty = (BigDecimal) r.get("qty");
                BigDecimal price = (BigDecimal) r.get("price");
                BigDecimal amount = (BigDecimal) r.get("amount");
                boolean isOut = qty != null && qty.compareTo(BigDecimal.ZERO) < 0;

                String typeLabel = "import".equals(type) ? "Nhập"
                        : ("export".equals(type) ? "Xuất"
                        : ("return".equals(type) ? "Trả lại" : ("transfer".equals(type) ? "Điều chuyển" : type)));

                String wh = "transfer".equals(type)
                        ? (r.get("warehouseOutName") + " -> " + r.get("warehouseInName"))
                        : (isOut ? (String) r.get("warehouseOutName") : (String) r.get("warehouseInName"));

                rows.add(List.of(
                        XlsxWriter.Cell.text(r.get("date") != null ? r.get("date").toString() : ""),
                        XlsxWriter.Cell.text(r.get("no") != null ? r.get("no").toString() : ""),
                        XlsxWriter.Cell.text(typeLabel),
                        XlsxWriter.Cell.text(r.get("partnerName") != null ? r.get("partnerName").toString() : ""),
                        XlsxWriter.Cell.text(wh != null ? wh : ""),
                        XlsxWriter.Cell.number(price),
                        !isOut ? XlsxWriter.Cell.number(qty) : XlsxWriter.Cell.text(""),
                        !isOut ? XlsxWriter.Cell.number(amount) : XlsxWriter.Cell.text(""),
                        isOut ? XlsxWriter.Cell.number(qty != null ? qty.abs() : 0) : XlsxWriter.Cell.text(""),
                        isOut ? XlsxWriter.Cell.number(amount != null ? amount.abs() : 0) : XlsxWriter.Cell.text(""),
                        XlsxWriter.Cell.number(r.get("balanceQty")),
                        XlsxWriter.Cell.number(r.get("balanceValue"))
                ));
            }
        }

        // Summary row
        rows.add(List.of(
                XlsxWriter.Cell.total("Cộng phát sinh"),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.totalNumber(data.get("totalInQty")),
                XlsxWriter.Cell.totalNumber(data.get("totalInValue")),
                XlsxWriter.Cell.totalNumber(data.get("totalOutQty")),
                XlsxWriter.Cell.totalNumber(data.get("totalOutValue")),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text("")
        ));

        // Closing row
        rows.add(List.of(
                XlsxWriter.Cell.total("Số dư cuối kỳ"),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.text(""),
                XlsxWriter.Cell.totalNumber(data.get("closingQty")),
                XlsxWriter.Cell.totalNumber(data.get("closingValue"))
        ));

        int[] widths = new int[]{12, 14, 12, 28, 24, 14, 12, 16, 12, 16, 12, 16};
        byte[] bytes = XlsxWriter.write("Sổ chi tiết", widths, rows, false);
        String fileName = "so-chi-tiet-" + (matCode != null && !matCode.isBlank() ? matCode : "vat-tu") + ".xlsx";

        return Response.ok(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"")
                .build();
    }

    public Map<String, Object> getMaterialLedgerReportData(String materialId,
                                                           String warehouseId,
                                                           String dateFrom,
                                                           String dateTo) {
        if (materialId == null || materialId.isBlank()) {
            List<String> firstMat = em.createQuery("select m.id from Material m order by m.code asc", String.class)
                    .setMaxResults(1)
                    .getResultList();
            if (!firstMat.isEmpty()) {
                materialId = firstMat.get(0);
            } else {
                throw MasterResource.bad("Chưa có danh mục vật tư");
            }
        }

        Material m = em.find(Material.class, materialId);
        if (m == null) {
            List<Material> list = em.createQuery("from Material where code = :code", Material.class)
                    .setParameter("code", materialId)
                    .getResultList();
            if (!list.isEmpty()) {
                m = list.get(0);
                materialId = m.id;
            }
        }
        if (m == null) throw new NotFoundException();

        LocalDate[] range = range(dateFrom, dateTo);
        LocalDate from = range[0];
        LocalDate to = range[1];

        boolean hasWarehouse = warehouseId != null && !warehouseId.isBlank() && !warehouseId.equalsIgnoreCase("all");

        Map<String, Object> pOpen = new HashMap<>();
        pOpen.put("pid", materialId);
        pOpen.put("from", from);
        String openHql = "select coalesce(sum(o.quantity), 0), coalesce(sum(o.amount), 0)"
                + " from OpeningBalance o where o.kind = 'material' and o.materialId = :pid"
                + " and (o.date is null or o.date <= :from)";
        if (hasWarehouse) {
            openHql += " and o.warehouseId = :wid";
            pOpen.put("wid", warehouseId);
        }
        long[] openBal = sums(openHql, pOpen);

        Map<String, Object> pInBf = new HashMap<>();
        pInBf.put("pid", materialId);
        pInBf.put("from", from);
        String inBfHql = "select coalesce(sum(l.qty), 0), coalesce(sum(l.qty * l.price), 0)"
                + " from InvLine l join l.doc d where l.product.id = :pid"
                + " and (d.type = 'import' or d.type = 'return' or d.type = 'transfer') and d.date < :from";
        if (hasWarehouse) {
            inBfHql += " and d.warehouseIn.id = :wid";
            pInBf.put("wid", warehouseId);
        }
        long[] inBefore = sums(inBfHql, pInBf);

        Map<String, Object> pOutBf = new HashMap<>();
        pOutBf.put("pid", materialId);
        pOutBf.put("from", from);
        String outBfHql = "select coalesce(sum(l.qty), 0), coalesce(sum(l.qty * l.price), 0)"
                + " from InvLine l join l.doc d where l.product.id = :pid"
                + " and (d.type = 'export' or d.type = 'transfer') and d.date < :from";
        if (hasWarehouse) {
            outBfHql += " and d.warehouseOut.id = :wid";
            pOutBf.put("wid", warehouseId);
        }
        long[] outBefore = sums(outBfHql, pOutBf);

        long openingQty = openBal[0] + inBefore[0] - outBefore[0];
        long openingValue = openBal[1] + inBefore[1] - outBefore[1];
        long balanceQty = openingQty;
        long balanceValue = openingValue;

        Map<String, Object> pLines = new HashMap<>();
        pLines.put("pid", materialId);
        pLines.put("from", from);
        pLines.put("to", to);
        String linesHql = "select d.date, d.no, d.type, d.partner.name, l.qty, l.price, l.pos,"
                + " d.warehouseIn.id, d.warehouseIn.name, d.warehouseOut.id, d.warehouseOut.name"
                + " from InvLine l join l.doc d where l.product.id = :pid and d.date between :from and :to";
        if (hasWarehouse) {
            linesHql += " and ((d.warehouseIn.id = :wid and d.type in ('import', 'return', 'transfer'))"
                    + " or (d.warehouseOut.id = :wid and d.type in ('export', 'transfer')))";
            pLines.put("wid", warehouseId);
        }
        linesHql += " order by d.date asc, d.no asc, l.pos asc";

        jakarta.persistence.Query query = em.createQuery(linesHql);
        pLines.forEach(query::setParameter);

        @SuppressWarnings("unchecked")
        List<Object[]> lines = query.setMaxResults(MAX_ROWS).getResultList();

        long totalInQty = 0, totalInValue = 0, totalOutQty = 0, totalOutValue = 0;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object[] r : lines) {
            String type = (String) r[2];
            BigDecimal qty = decimal(r[4]);
            BigDecimal price = decimal(r[5]);
            String inWid = (String) r[7];
            String outWid = (String) r[9];

            boolean out;
            if (hasWarehouse) {
                if ("transfer".equals(type)) {
                    out = warehouseId.equals(outWid);
                } else {
                    out = "export".equals(type);
                }
            } else {
                out = "export".equals(type);
            }

            BigDecimal signedQty = out ? qty.negate() : qty;
            BigDecimal amount = signedQty.multiply(price);

            if (out) { totalOutQty += qty.longValue(); totalOutValue += amount.abs().longValue(); }
            else { totalInQty += qty.longValue(); totalInValue += amount.longValue(); }

            balanceQty += signedQty.longValue();
            balanceValue += amount.longValue();

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", r[0]);
            row.put("no", r[1]);
            row.put("type", type);
            row.put("partnerName", r[3]);
            row.put("qty", signedQty);
            row.put("price", price);
            row.put("amount", amount);
            row.put("warehouseInName", r[8]);
            row.put("warehouseOutName", r[10]);
            row.put("balanceQty", balanceQty);
            row.put("balanceValue", balanceValue);
            rows.add(row);
        }

        Map<String, Object> material = new LinkedHashMap<>();
        material.put("id", m.id);
        material.put("code", m.code);
        material.put("name", m.name);
        material.put("unit", m.unit);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("material", material);
        res.put("warehouseId", hasWarehouse ? warehouseId : null);
        res.put("dateFrom", from);
        res.put("dateTo", to);
        res.put("openingQty", openingQty);
        res.put("openingValue", openingValue);
        res.put("totalInQty", totalInQty);
        res.put("totalInValue", totalInValue);
        res.put("totalOutQty", totalOutQty);
        res.put("totalOutValue", totalOutValue);
        res.put("closingQty", balanceQty);
        res.put("closingValue", balanceValue);
        res.put("items", rows);
        return res;
    }

    // 5) Bang tong hop NXT vat lieu, san pham, hang hoa (theo tung loai kho va tong cac kho)
    @GET @Path("/stock-summary")
    public Map<String, Object> stockSummary(@QueryParam("dateFrom") String dateFrom,
                                            @QueryParam("dateTo") String dateTo,
                                            @QueryParam("warehouseId") String warehouseId,
                                            @QueryParam("q") String q) {
        permissions.require("reports", "READ");
        return stockSummaryBody(dateFrom, dateTo, warehouseId, q);
    }

    private Map<String, Object> stockSummaryBody(String dateFrom, String dateTo, String warehouseId, String q) {
        LocalDate[] range = range(dateFrom, dateTo);
        LocalDate from = range[0];
        LocalDate to = range[1];

        boolean hasWarehouse = warehouseId != null && !warehouseId.isBlank() && !warehouseId.equalsIgnoreCase("all");

        Map<String, Object> pFrom = Map.of("from", from);
        Map<String, Object> pRange = Map.of("from", from, "to", to);

        // 1. So du ton dau ky tu OpeningBalance
        Map<String, long[]> openBal = sumsByProductAndWarehouse(
                "select o.materialId, o.warehouseId, sum(o.quantity), sum(o.amount)"
                + " from OpeningBalance o where o.kind = 'material' and (o.date is null or o.date <= :from)"
                + " group by o.materialId, o.warehouseId", pFrom);

        // 2. Nhap kho truoc :from (import, return, transfer -> warehouseIn)
        Map<String, long[]> inBefore = sumsByProductAndWarehouse(
                "select l.product.id, d.warehouseIn.id, sum(l.qty), sum(l.qty * l.price)"
                + " from InvLine l join l.doc d where (d.type = 'import' or d.type = 'return' or d.type = 'transfer')"
                + " and d.date < :from group by l.product.id, d.warehouseIn.id", pFrom);

        // 3. Xuat kho truoc :from (export, transfer -> warehouseOut)
        Map<String, long[]> outBefore = sumsByProductAndWarehouse(
                "select l.product.id, d.warehouseOut.id, sum(l.qty), sum(l.qty * l.price)"
                + " from InvLine l join l.doc d where (d.type = 'export' or d.type = 'transfer')"
                + " and d.date < :from group by l.product.id, d.warehouseOut.id", pFrom);

        // 4. Nhap kho trong ky [:from, :to]
        Map<String, long[]> inRange = sumsByProductAndWarehouse(
                "select l.product.id, d.warehouseIn.id, sum(l.qty), sum(l.qty * l.price)"
                + " from InvLine l join l.doc d where (d.type = 'import' or d.type = 'return' or d.type = 'transfer')"
                + " and d.date between :from and :to group by l.product.id, d.warehouseIn.id", pRange);

        // 5. Xuat kho trong ky [:from, :to]
        Map<String, long[]> outRange = sumsByProductAndWarehouse(
                "select l.product.id, d.warehouseOut.id, sum(l.qty), sum(l.qty * l.price)"
                + " from InvLine l join l.doc d where (d.type = 'export' or d.type = 'transfer')"
                + " and d.date between :from and :to group by l.product.id, d.warehouseOut.id", pRange);

        Map<String, Material> materials = new HashMap<>();
        for (Material m : em.createQuery("select m from Material m", Material.class).setMaxResults(MAX_ROWS).getResultList()) {
            materials.put(m.id, m);
        }

        Map<String, Warehouse> warehouses = new LinkedHashMap<>();
        for (Warehouse w : em.createQuery("select w from Warehouse w order by w.code asc", Warehouse.class).getResultList()) {
            warehouses.put(w.id, w);
        }

        Set<String> allKeys = new HashSet<>();
        allKeys.addAll(openBal.keySet());
        allKeys.addAll(inBefore.keySet());
        allKeys.addAll(outBefore.keySet());
        allKeys.addAll(inRange.keySet());
        allKeys.addAll(outRange.keySet());

        String needle = q == null ? null : q.trim().toLowerCase();
        List<Map<String, Object>> items = new ArrayList<>();
        Map<String, Map<String, Object>> whMap = new LinkedHashMap<>();
        Map<String, Map<String, Object>> prodMap = new LinkedHashMap<>();

        long tOpenQty = 0, tOpenValue = 0, tInQty = 0, tInValue = 0;
        long tOutQty = 0, tOutValue = 0, tCloseQty = 0, tCloseValue = 0;

        for (String key : allKeys) {
            String[] parts = key.split("::", 2);
            String pid = parts[0];
            String wid = parts.length > 1 ? parts[1] : "";

            if (hasWarehouse && !warehouseId.equals(wid)) continue;

            long openBalQty = val(openBal, key, 0);
            long openBalVal = val(openBal, key, 1);
            long inBfQty = val(inBefore, key, 0);
            long inBfVal = val(inBefore, key, 1);
            long outBfQty = val(outBefore, key, 0);
            long outBfVal = val(outBefore, key, 1);

            long openingQty = openBalQty + inBfQty - outBfQty;
            long openingValue = openBalVal + inBfVal - outBfVal;

            long inQty = val(inRange, key, 0);
            long inValue = val(inRange, key, 1);
            long outQty = val(outRange, key, 0);
            long outValue = val(outRange, key, 1);

            long closingQty = openingQty + inQty - outQty;
            long closingValue = openingValue + inValue - outValue;

            if (openingQty == 0 && openingValue == 0 && inQty == 0 && inValue == 0
                    && outQty == 0 && outValue == 0 && closingQty == 0 && closingValue == 0) continue;

            Material m = materials.get(pid);
            if (m != null && "service".equalsIgnoreCase(m.kind)) {
                // Theo chuan ke toan: Dich vu khong theo doi ton kho vat ly (NXT)
                continue;
            }
            String code = m == null ? "" : nullToEmpty(m.code);
            String name = m == null ? pid : nullToEmpty(m.name);
            String unit = m == null ? "" : nullToEmpty(m.unit);

            Warehouse w = warehouses.get(wid);
            String whCode = w == null ? "" : nullToEmpty(w.code);
            String whName = w == null ? (wid.isEmpty() ? "Chưa phân loại" : wid) : nullToEmpty(w.name);

            if (needle != null && !needle.isEmpty()) {
                boolean match = name.toLowerCase().contains(needle)
                        || code.toLowerCase().contains(needle)
                        || whName.toLowerCase().contains(needle)
                        || whCode.toLowerCase().contains(needle);
                if (!match) continue;
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("productId", pid);
            row.put("code", code);
            row.put("name", name);
            row.put("unit", unit);
            row.put("warehouseId", wid);
            row.put("warehouseCode", whCode);
            row.put("warehouseName", whName);
            row.put("openingQty", openingQty);
            row.put("openingValue", openingValue);
            row.put("inQty", inQty);
            row.put("inValue", inValue);
            row.put("outQty", outQty);
            row.put("outValue", outValue);
            row.put("closingQty", closingQty);
            row.put("closingValue", closingValue);
            items.add(row);

            // Tong hop theo tung kho
            Map<String, Object> whSum = whMap.computeIfAbsent(wid, k -> {
                Map<String, Object> sm = new LinkedHashMap<>();
                sm.put("warehouseId", wid);
                sm.put("warehouseCode", whCode);
                sm.put("warehouseName", whName);
                sm.put("openingQty", 0L);
                sm.put("openingValue", 0L);
                sm.put("inQty", 0L);
                sm.put("inValue", 0L);
                sm.put("outQty", 0L);
                sm.put("outValue", 0L);
                sm.put("closingQty", 0L);
                sm.put("closingValue", 0L);
                return sm;
            });
            whSum.put("openingQty", (Long) whSum.get("openingQty") + openingQty);
            whSum.put("openingValue", (Long) whSum.get("openingValue") + openingValue);
            whSum.put("inQty", (Long) whSum.get("inQty") + inQty);
            whSum.put("inValue", (Long) whSum.get("inValue") + inValue);
            whSum.put("outQty", (Long) whSum.get("outQty") + outQty);
            whSum.put("outValue", (Long) whSum.get("outValue") + outValue);
            whSum.put("closingQty", (Long) whSum.get("closingQty") + closingQty);
            whSum.put("closingValue", (Long) whSum.get("closingValue") + closingValue);

            // Tong hop theo tung mat hang (tong cac kho)
            Map<String, Object> prodSum = prodMap.computeIfAbsent(pid, k -> {
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("productId", pid);
                pm.put("code", code);
                pm.put("name", name);
                pm.put("unit", unit);
                pm.put("openingQty", 0L);
                pm.put("openingValue", 0L);
                pm.put("inQty", 0L);
                pm.put("inValue", 0L);
                pm.put("outQty", 0L);
                pm.put("outValue", 0L);
                pm.put("closingQty", 0L);
                pm.put("closingValue", 0L);
                return pm;
            });
            prodSum.put("openingQty", (Long) prodSum.get("openingQty") + openingQty);
            prodSum.put("openingValue", (Long) prodSum.get("openingValue") + openingValue);
            prodSum.put("inQty", (Long) prodSum.get("inQty") + inQty);
            prodSum.put("inValue", (Long) prodSum.get("inValue") + inValue);
            prodSum.put("outQty", (Long) prodSum.get("outQty") + outQty);
            prodSum.put("outValue", (Long) prodSum.get("outValue") + outValue);
            prodSum.put("closingQty", (Long) prodSum.get("closingQty") + closingQty);
            prodSum.put("closingValue", (Long) prodSum.get("closingValue") + closingValue);

            tOpenQty += openingQty; tOpenValue += openingValue;
            tInQty += inQty; tInValue += inValue;
            tOutQty += outQty; tOutValue += outValue;
            tCloseQty += closingQty; tCloseValue += closingValue;
        }

        items.sort(Comparator.comparing((Map<String, Object> r) -> (String) r.get("warehouseName"), String.CASE_INSENSITIVE_ORDER)
                .thenComparing((Map<String, Object> r) -> (String) r.get("name"), String.CASE_INSENSITIVE_ORDER));

        List<Map<String, Object>> byProductList = new ArrayList<>(prodMap.values());
        byProductList.sort(Comparator.comparing((Map<String, Object> r) -> (String) r.get("name"), String.CASE_INSENSITIVE_ORDER));

        List<Map<String, Object>> whList = new ArrayList<>(whMap.values());
        whList.sort(Comparator.comparing((Map<String, Object> r) -> (String) r.get("warehouseCode"), String.CASE_INSENSITIVE_ORDER));

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("openingQty", tOpenQty);
        totals.put("openingValue", tOpenValue);
        totals.put("inQty", tInQty);
        totals.put("inValue", tInValue);
        totals.put("outQty", tOutQty);
        totals.put("outValue", tOutValue);
        totals.put("closingQty", tCloseQty);
        totals.put("closingValue", tCloseValue);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("dateFrom", from);
        res.put("dateTo", to);
        res.put("warehouseId", hasWarehouse ? warehouseId : null);
        res.put("items", items);
        res.put("warehouseSummaries", whList);
        res.put("byProduct", byProductList);
        res.put("totals", totals);
        return res;
    }

    // 6) So chi tiet ban hang
    @GET @Path("/sales")
    public Map<String, Object> sales(@QueryParam("dateFrom") String dateFrom,
                                     @QueryParam("dateTo") String dateTo,
                                     @QueryParam("q") String q) {
        permissions.require("reports", "READ");
        LocalDate[] range = range(dateFrom, dateTo);
        return salesReport(range[0], range[1], q, false);
    }

    // 7) So chi tiet ban hang va gia von
    @GET @Path("/sales-cogs")
    public Map<String, Object> salesCogs(@QueryParam("dateFrom") String dateFrom,
                                         @QueryParam("dateTo") String dateTo,
                                         @QueryParam("q") String q) {
        permissions.require("reports", "READ");
        LocalDate[] range = range(dateFrom, dateTo);
        return salesReport(range[0], range[1], q, true);
    }

    // ---------- helper ----------
    @SuppressWarnings("unchecked")
    private Map<String, Object> salesReport(LocalDate from, LocalDate to, String q, boolean withCost) {
        StringBuilder where = new StringBuilder(
                " from InvLine l join l.doc d where d.type = 'export' and d.date between :from and :to");
        Map<String, Object> params = new HashMap<>();
        params.put("from", from);
        params.put("to", to);
        if (q != null && !q.isBlank()) {
            where.append(" and (lower(l.product.name) like :q or lower(d.no) like :q or lower(d.partner.name) like :q)");
            params.put("q", "%" + q.trim().toLowerCase() + "%");
        }

        Map<String, BigDecimal> avgCost = withCost ? avgCosts(to) : Map.of();

        jakarta.persistence.Query query = em.createQuery("select d.date, d.no, d.partner.name, l.product.id,"
                + " l.product.name, l.qty, l.price" + where + " order by d.date asc, d.no asc, l.pos asc");
        params.forEach(query::setParameter);
        List<Object[]> lines = query.setMaxResults(MAX_ROWS).getResultList();

        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalProfit = BigDecimal.ZERO;
        List<Map<String, Object>> items = new ArrayList<>();

        for (Object[] r : lines) {
            BigDecimal qty = decimal(r[5]);
            BigDecimal price = decimal(r[6]);
            BigDecimal revenue = qty.multiply(price).setScale(0, RoundingMode.HALF_UP);
            BigDecimal cost = BigDecimal.ZERO;
            BigDecimal profit = BigDecimal.ZERO;
            if (withCost) {
                cost = qty.multiply(avgCost.getOrDefault((String) r[3], BigDecimal.ZERO)).setScale(0, RoundingMode.HALF_UP);
                profit = revenue.subtract(cost);
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", r[0]);
            row.put("no", r[1]);
            row.put("partnerName", r[2]);
            row.put("productId", r[3]);
            row.put("productName", r[4]);
            row.put("qty", qty);
            row.put("price", price);
            row.put("revenue", revenue);
            if (withCost) {
                row.put("cost", cost);
                row.put("profit", profit);
            }
            items.add(row);

            totalRevenue = totalRevenue.add(revenue);
            totalCost = totalCost.add(cost);
            totalProfit = totalProfit.add(profit);
        }

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("revenue", totalRevenue);
        if (withCost) {
            totals.put("cost", totalCost);
            totals.put("profit", totalProfit);
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("dateFrom", from);
        res.put("dateTo", to);
        res.put("withCost", withCost);
        res.put("items", items);
        res.put("totals", totals);
        return res;
    }

    // Gia von binh quan gia quyen theo ton dau ky va cac phieu nhap den het ngay `to`
    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> avgCosts(LocalDate to) {
        List<Object[]> importRows = em.createQuery("select l.product.id, sum(l.qty * l.price), sum(l.qty)"
                        + " from InvLine l join l.doc d where d.type = 'import' and d.date <= :to"
                        + " group by l.product.id")
                .setParameter("to", to)
                .getResultList();

        List<Object[]> openRows = em.createQuery("select o.materialId, sum(o.amount), sum(o.quantity)"
                        + " from OpeningBalance o where o.kind = 'material' and (o.date is null or o.date <= :to)"
                        + " group by o.materialId")
                .setParameter("to", to)
                .getResultList();

        Map<String, BigDecimal[]> sums = new HashMap<>();
        for (Object[] r : openRows) {
            if (r[0] != null) {
                sums.put((String) r[0], new BigDecimal[]{decimal(r[1]), decimal(r[2])});
            }
        }
        for (Object[] r : importRows) {
            String pid = (String) r[0];
            BigDecimal val = decimal(r[1]);
            BigDecimal qty = decimal(r[2]);
            BigDecimal[] cur = sums.computeIfAbsent(pid, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            cur[0] = cur[0].add(val);
            cur[1] = cur[1].add(qty);
        }

        Map<String, BigDecimal> out = new HashMap<>();
        for (Map.Entry<String, BigDecimal[]> e : sums.entrySet()) {
            BigDecimal totalVal = e.getValue()[0];
            BigDecimal totalQty = e.getValue()[1];
            if (totalQty.signum() > 0) {
                out.put(e.getKey(), totalVal.divide(totalQty, 2, RoundingMode.HALF_UP));
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, long[]> sumsByProductAndWarehouse(String jpql, Map<String, Object> params) {
        jakarta.persistence.Query query = em.createQuery(jpql);
        params.forEach(query::setParameter);
        List<Object[]> rows = query.getResultList();
        Map<String, long[]> out = new HashMap<>();
        for (Object[] r : rows) {
            String pid = (String) r[0];
            String wid = r[1] == null ? "" : (String) r[1];
            String key = pid + "::" + wid;
            long q = decimal(r[2]).longValue();
            long v = decimal(r[3]).longValue();
            long[] cur = out.get(key);
            if (cur == null) {
                out.put(key, new long[]{q, v});
            } else {
                cur[0] += q;
                cur[1] += v;
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, long[]> sumsByProduct(String jpql, Map<String, Object> params) {
        jakarta.persistence.Query query = em.createQuery(jpql);
        params.forEach(query::setParameter);
        List<Object[]> rows = query.getResultList();
        Map<String, long[]> out = new HashMap<>();
        for (Object[] r : rows) {
            out.put((String) r[0], new long[]{decimal(r[1]).longValue(), decimal(r[2]).longValue()});
        }
        return out;
    }

    private long[] sums(String jpql, Map<String, Object> params) {
        jakarta.persistence.Query query = em.createQuery(jpql);
        params.forEach(query::setParameter);
        Object[] r = (Object[]) query.getSingleResult();
        return new long[]{decimal(r[0]).longValue(), decimal(r[1]).longValue()};
    }

    private static long val(Map<String, long[]> map, String id, int index) {
        long[] v = map.get(id);
        return v == null ? 0 : v[index];
    }

    private static LocalDate[] range(String dateFrom, String dateTo) {
        LocalDate to = parseDate(dateTo);
        if (to == null) to = LocalDate.now();
        LocalDate from = parseDate(dateFrom);
        if (from == null) from = to.withDayOfMonth(1);
        if (from.isAfter(to)) throw MasterResource.bad("Khoảng ngày không hợp lệ");
        return new LocalDate[]{from, to};
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try { return LocalDate.parse(s.trim()); }
        catch (DateTimeParseException ex) { throw MasterResource.bad("Ngày không hợp lệ (yyyy-MM-dd)"); }
    }

    private static BigDecimal decimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        return new BigDecimal(o.toString());
    }

    private static String nullToEmpty(String s) { return s == null ? "" : s; }
}
