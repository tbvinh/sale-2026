package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Material;
import com.vinhcancode.sales.service.PermissionService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
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
 * Chi doc du lieu tu inv_doc / inv_doc_line (khong tao bang rieng).
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
                                              @QueryParam("dateFrom") String dateFrom,
                                              @QueryParam("dateTo") String dateTo) {
        permissions.require("reports", "READ");
        if (materialId == null || materialId.isBlank()) throw MasterResource.bad("Chưa chọn vật tư");
        Material m = em.find(Material.class, materialId);
        if (m == null) throw new NotFoundException();

        LocalDate[] range = range(dateFrom, dateTo);
        LocalDate from = range[0];
        LocalDate to = range[1];

        Map<String, Object> p = new HashMap<>();
        p.put("pid", materialId);
        p.put("from", from);
        long[] inBefore = sums("select coalesce(sum(l.qty), 0), coalesce(sum(l.qty * l.price), 0)"
                + " from InvLine l join l.doc d where l.product.id = :pid"
                + " and d.type <> 'transfer' and d.type <> 'export' and d.date < :from", p);
        long[] outBefore = sums("select coalesce(sum(l.qty), 0), coalesce(sum(l.qty * l.price), 0)"
                + " from InvLine l join l.doc d where l.product.id = :pid"
                + " and d.type = 'export' and d.date < :from", p);

        long openingQty = inBefore[0] - outBefore[0];
        long openingValue = inBefore[1] - outBefore[1];
        long balanceQty = openingQty;
        long balanceValue = openingValue;

        @SuppressWarnings("unchecked")
        List<Object[]> lines = em.createQuery("select d.date, d.no, d.type, d.partner.name, l.qty, l.price, l.pos"
                        + " from InvLine l join l.doc d where l.product.id = :pid"
                        + " and d.type <> 'transfer' and d.date between :from and :to"
                        + " order by d.date asc, d.no asc, l.pos asc")
                .setParameter("pid", materialId)
                .setParameter("from", from)
                .setParameter("to", to)
                .setMaxResults(MAX_ROWS)
                .getResultList();

        long totalInQty = 0, totalInValue = 0, totalOutQty = 0, totalOutValue = 0;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object[] r : lines) {
            String type = (String) r[2];
            BigDecimal qty = decimal(r[4]);
            BigDecimal price = decimal(r[5]);
            boolean out = "export".equals(type);
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

    // 5) Bang tong hop NXT vat lieu, san pham, hang hoa
    @GET @Path("/stock-summary")
    public Map<String, Object> stockSummary(@QueryParam("dateFrom") String dateFrom,
                                            @QueryParam("dateTo") String dateTo,
                                            @QueryParam("q") String q) {
        permissions.require("reports", "READ");
        return stockSummaryBody(dateFrom, dateTo, q);
    }

    private Map<String, Object> stockSummaryBody(String dateFrom, String dateTo, String q) {
        LocalDate[] range = range(dateFrom, dateTo);
        LocalDate from = range[0];
        LocalDate to = range[1];

        Map<String, Object> pFrom = Map.of("from", from);
        Map<String, Object> pRange = Map.of("from", from, "to", to);

        Map<String, long[]> openIn = sumsByProduct("select l.product.id, sum(l.qty), sum(l.qty * l.price)"
                + " from InvLine l join l.doc d where d.type <> 'transfer' and d.type <> 'export'"
                + " and d.date < :from group by l.product.id", pFrom);
        Map<String, long[]> openOut = sumsByProduct("select l.product.id, sum(l.qty), sum(l.qty * l.price)"
                + " from InvLine l join l.doc d where d.type = 'export' and d.date < :from group by l.product.id", pFrom);
        Map<String, long[]> inRange = sumsByProduct("select l.product.id, sum(l.qty), sum(l.qty * l.price)"
                + " from InvLine l join l.doc d where d.type <> 'transfer' and d.type <> 'export'"
                + " and d.date between :from and :to group by l.product.id", pRange);
        Map<String, long[]> outRange = sumsByProduct("select l.product.id, sum(l.qty), sum(l.qty * l.price)"
                + " from InvLine l join l.doc d where d.type = 'export'"
                + " and d.date between :from and :to group by l.product.id", pRange);

        Map<String, Material> materials = new HashMap<>();
        for (Material m : em.createQuery("select m from Material m", Material.class).setMaxResults(MAX_ROWS).getResultList()) {
            materials.put(m.id, m);
        }

        Set<String> ids = new HashSet<>();
        ids.addAll(openIn.keySet());
        ids.addAll(openOut.keySet());
        ids.addAll(inRange.keySet());
        ids.addAll(outRange.keySet());

        String needle = q == null ? null : q.trim().toLowerCase();
        List<Map<String, Object>> items = new ArrayList<>();
        long tOpenQty = 0, tOpenValue = 0, tInQty = 0, tInValue = 0;
        long tOutQty = 0, tOutValue = 0, tCloseQty = 0, tCloseValue = 0;

        for (String pid : ids) {
            long openingQty = val(openIn, pid, 0) - val(openOut, pid, 0);
            long openingValue = val(openIn, pid, 1) - val(openOut, pid, 1);
            long inQty = val(inRange, pid, 0);
            long inValue = val(inRange, pid, 1);
            long outQty = val(outRange, pid, 0);
            long outValue = val(outRange, pid, 1);
            long closingQty = openingQty + inQty - outQty;
            long closingValue = openingValue + inValue - outValue;

            if (openingQty == 0 && openingValue == 0 && inQty == 0 && inValue == 0
                    && outQty == 0 && outValue == 0) continue;

            Material m = materials.get(pid);
            String code = m == null ? "" : nullToEmpty(m.code);
            String name = m == null ? pid : nullToEmpty(m.name);
            String unit = m == null ? "" : nullToEmpty(m.unit);

            if (needle != null && !needle.isEmpty()
                    && !name.toLowerCase().contains(needle) && !code.toLowerCase().contains(needle)) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("productId", pid);
            row.put("code", code);
            row.put("name", name);
            row.put("unit", unit);
            row.put("openingQty", openingQty);
            row.put("openingValue", openingValue);
            row.put("inQty", inQty);
            row.put("inValue", inValue);
            row.put("outQty", outQty);
            row.put("outValue", outValue);
            row.put("closingQty", closingQty);
            row.put("closingValue", closingValue);
            items.add(row);

            tOpenQty += openingQty; tOpenValue += openingValue;
            tInQty += inQty; tInValue += inValue;
            tOutQty += outQty; tOutValue += outValue;
            tCloseQty += closingQty; tCloseValue += closingValue;
        }
        items.sort(Comparator.comparing((Map<String, Object> r) -> (String) r.get("name"), String.CASE_INSENSITIVE_ORDER));

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
        res.put("items", items);
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

    // Gia von binh quan gia quyen theo cac phieu nhap den het ngay `to`
    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> avgCosts(LocalDate to) {
        List<Object[]> rows = em.createQuery("select l.product.id, sum(l.qty * l.price), sum(l.qty)"
                        + " from InvLine l join l.doc d where d.type = 'import' and d.date <= :to"
                        + " group by l.product.id")
                .setParameter("to", to)
                .getResultList();
        Map<String, BigDecimal> out = new HashMap<>();
        for (Object[] r : rows) {
            BigDecimal value = decimal(r[1]);
            BigDecimal qty = decimal(r[2]);
            if (qty.signum() > 0) out.put((String) r[0], value.divide(qty, 2, RoundingMode.HALF_UP));
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
