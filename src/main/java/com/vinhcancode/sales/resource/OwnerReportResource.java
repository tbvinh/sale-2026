package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.DmCongTy;
import com.vinhcancode.sales.entity.User;
import com.vinhcancode.sales.entity.UserCompany;
import com.vinhcancode.sales.service.AdminService;
import com.vinhcancode.sales.service.TenantProvisioner;
import io.agroal.api.AgroalDataSource;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Báo cáo thống kê dành riêng cho Chủ sở hữu công ty (Owner / company_admin) và Quản trị viên (admin):
 * - Thống kê khách hàng mua hàng theo Tháng / Quý / Năm
 * - Biểu đồ doanh số từng công ty theo Tháng / Quý / Năm
 */
@Path("/reports/owner")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class OwnerReportResource {

    private static final Pattern VALID_SCHEMA = Pattern.compile("[a-z][a-z0-9_]{1,62}");

    @Inject
    AgroalDataSource dataSource;

    @Inject
    TenantProvisioner provisioner;

    @Inject
    JsonWebToken jwt;

    @GET
    @Path("/analytics")
    public Map<String, Object> analytics(@QueryParam("periodType") String periodType,
                                         @QueryParam("year") Integer year,
                                         @QueryParam("quarter") Integer quarter,
                                         @QueryParam("month") Integer month,
                                         @QueryParam("companyId") String companyIdParam,
                                         @QueryParam("q") String q) {
        String username = jwt != null ? jwt.getName() : null;
        Set<String> groups = jwt != null ? jwt.getGroups() : null;
        boolean isSystemAdmin = groups != null && groups.contains("admin");

        List<CompanyInfo> ownerCompanies = resolveOwnerCompanies(username, isSystemAdmin);

        String pType = (periodType == null || periodType.isBlank())
                ? "month"
                : periodType.trim().toLowerCase(Locale.ROOT);
        if (!"month".equals(pType) && !"quarter".equals(pType) && !"year".equals(pType)) {
            pType = "month";
        }

        LocalDate now = LocalDate.now();
        int targetYear = (year != null && year >= 2000 && year <= 2100) ? year : now.getYear();
        int targetQuarter = (quarter != null && quarter >= 1 && quarter <= 4)
                ? quarter
                : ((now.getMonthValue() - 1) / 3 + 1);
        int targetMonth = (month != null && month >= 1 && month <= 12) ? month : now.getMonthValue();

        // Khoảng thời gian cho bảng thống kê khách hàng mua hàng
        LocalDate custFrom;
        LocalDate custTo;
        if ("month".equals(pType)) {
            YearMonth ym = YearMonth.of(targetYear, targetMonth);
            custFrom = ym.atDay(1);
            custTo = ym.atEndOfMonth();
        } else if ("quarter".equals(pType)) {
            int startMonth = (targetQuarter - 1) * 3 + 1;
            YearMonth ymStart = YearMonth.of(targetYear, startMonth);
            YearMonth ymEnd = YearMonth.of(targetYear, startMonth + 2);
            custFrom = ymStart.atDay(1);
            custTo = ymEnd.atEndOfMonth();
        } else {
            custFrom = LocalDate.of(targetYear, 1, 1);
            custTo = LocalDate.of(targetYear, 12, 31);
        }

        // Khoảng thời gian cho chuỗi thời gian biểu đồ (Chart Series)
        List<String> periodLabels = new ArrayList<>();
        LocalDate chartFrom;
        LocalDate chartTo;
        int startYearForChart = targetYear - 4;
        if ("month".equals(pType)) {
            chartFrom = LocalDate.of(targetYear, 1, 1);
            chartTo = LocalDate.of(targetYear, 12, 31);
            for (int m = 1; m <= 12; m++) {
                periodLabels.add("T" + m + "/" + targetYear);
            }
        } else if ("quarter".equals(pType)) {
            chartFrom = LocalDate.of(targetYear, 1, 1);
            chartTo = LocalDate.of(targetYear, 12, 31);
            for (int qt = 1; qt <= 4; qt++) {
                periodLabels.add("Quý " + qt + "/" + targetYear);
            }
        } else {
            chartFrom = LocalDate.of(startYearForChart, 1, 1);
            chartTo = LocalDate.of(targetYear, 12, 31);
            for (int y = startYearForChart; y <= targetYear; y++) {
                periodLabels.add("Năm " + y);
            }
        }

        String filterCid = (companyIdParam == null || companyIdParam.isBlank() || "all".equalsIgnoreCase(companyIdParam.trim()))
                ? null
                : companyIdParam.trim();
        String keyword = (q == null || q.isBlank()) ? null : q.trim().toLowerCase(Locale.ROOT);

        List<Map<String, Object>> companyListOut = new ArrayList<>();
        List<Map<String, Object>> companyChartOut = new ArrayList<>();
        Map<String, CustomerAgg> customerAggMap = new LinkedHashMap<>();

        BigDecimal grandTotalRevenue = BigDecimal.ZERO;
        long grandTotalOrders = 0;
        BigDecimal grandTotalQty = BigDecimal.ZERO;

        try (Connection conn = dataSource.getConnection()) {
            for (CompanyInfo co : ownerCompanies) {
                Map<String, Object> coMeta = new LinkedHashMap<>();
                coMeta.put("id", String.valueOf(co.id));
                coMeta.put("code", co.code);
                coMeta.put("name", co.name);
                coMeta.put("schemaName", co.schemaName);
                companyListOut.add(coMeta);

                if (!isValidSchema(co.schemaName)) continue;
                try {
                    if (!"public".equalsIgnoreCase(co.schemaName)) {
                        provisioner.ensureMigrated(co.schemaName);
                    }
                } catch (Exception ignored) {
                }

                // 1) Tính doanh số của công ty này cho biểu đồ (Chart) và trong kỳ chọn
                int bucketCount = periodLabels.size();
                BigDecimal[] buckets = new BigDecimal[bucketCount];
                long[] bucketOrders = new long[bucketCount];
                for (int i = 0; i < bucketCount; i++) {
                    buckets[i] = BigDecimal.ZERO;
                }

                BigDecimal companyPeriodRevenue = BigDecimal.ZERO;
                long companyPeriodOrders = 0;
                BigDecimal companyPeriodQty = BigDecimal.ZERO;
                Set<String> companyPeriodCustomers = new LinkedHashSet<>();

                LocalDate queryMinDate = chartFrom.isBefore(custFrom) ? chartFrom : custFrom;
                LocalDate queryMaxDate = chartTo.isAfter(custTo) ? chartTo : custTo;

                String docSql = "SELECT d.id, d.doc_date, d.partner_id, d.partner_name, "
                        + "COALESCE(SUM(l.qty), 0) AS total_qty, "
                        + "COALESCE(SUM(ROUND(l.qty * l.price, 0)), 0) AS total_rev "
                        + "FROM " + quoteIdent(co.schemaName) + ".inv_doc d "
                        + "JOIN " + quoteIdent(co.schemaName) + ".inv_doc_line l ON l.doc_id = d.id "
                        + "WHERE d.type = 'export' AND d.doc_date BETWEEN ? AND ? "
                        + "GROUP BY d.id, d.doc_date, d.partner_id, d.partner_name "
                        + "ORDER BY d.doc_date ASC, d.id ASC";

                try (PreparedStatement ps = conn.prepareStatement(docSql)) {
                    ps.setDate(1, Date.valueOf(queryMinDate));
                    ps.setDate(2, Date.valueOf(queryMaxDate));
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            Date sqlDate = rs.getDate("doc_date");
                            if (sqlDate == null) continue;
                            LocalDate dDate = sqlDate.toLocalDate();
                            String partnerId = rs.getString("partner_id");
                            String partnerName = rs.getString("partner_name");
                            BigDecimal docQty = nonNull(rs.getBigDecimal("total_qty")).setScale(2, RoundingMode.HALF_UP);
                            BigDecimal docRev = nonNull(rs.getBigDecimal("total_rev")).setScale(0, RoundingMode.HALF_UP);

                            // Đưa vào bucket biểu đồ nếu nằm trong [chartFrom, chartTo]
                            if (!dDate.isBefore(chartFrom) && !dDate.isAfter(chartTo)) {
                                int bIdx = -1;
                                if ("month".equals(pType) && dDate.getYear() == targetYear) {
                                    bIdx = dDate.getMonthValue() - 1;
                                } else if ("quarter".equals(pType) && dDate.getYear() == targetYear) {
                                    bIdx = (dDate.getMonthValue() - 1) / 3;
                                } else if ("year".equals(pType)) {
                                    bIdx = dDate.getYear() - startYearForChart;
                                }
                                if (bIdx >= 0 && bIdx < bucketCount) {
                                    buckets[bIdx] = buckets[bIdx].add(docRev);
                                    bucketOrders[bIdx]++;
                                }
                            }

                            // Đưa vào thống kê kỳ hiện tại [custFrom, custTo]
                            if (!dDate.isBefore(custFrom) && !dDate.isAfter(custTo)) {
                                companyPeriodRevenue = companyPeriodRevenue.add(docRev);
                                companyPeriodOrders++;
                                companyPeriodQty = companyPeriodQty.add(docQty);
                                String cleanPId = (partnerId == null || partnerId.isBlank()) ? "khach-vang-lai" : partnerId.trim();
                                String cleanPName = (partnerName == null || partnerName.isBlank()) ? "Khách vãng lai" : partnerName.trim();
                                companyPeriodCustomers.add(cleanPId.toLowerCase(Locale.ROOT) + "|" + cleanPName.toLowerCase(Locale.ROOT));

                                // Nếu công ty này khớp bộ lọc companyId (hoặc đang chọn Tất cả công ty)
                                boolean matchCoFilter = (filterCid == null)
                                        || filterCid.equalsIgnoreCase(String.valueOf(co.id))
                                        || filterCid.equalsIgnoreCase(co.code);
                                if (matchCoFilter) {
                                    boolean matchKeyword = (keyword == null)
                                            || cleanPName.toLowerCase(Locale.ROOT).contains(keyword)
                                            || cleanPId.toLowerCase(Locale.ROOT).contains(keyword)
                                            || co.name.toLowerCase(Locale.ROOT).contains(keyword);
                                    if (matchKeyword) {
                                        String aggKey = co.id + "::" + cleanPId.toLowerCase(Locale.ROOT) + "::" + cleanPName.toLowerCase(Locale.ROOT);
                                        CustomerAgg agg = customerAggMap.computeIfAbsent(aggKey, k -> {
                                            CustomerAgg a = new CustomerAgg();
                                            a.companyId = String.valueOf(co.id);
                                            a.companyCode = co.code;
                                            a.companyName = co.name;
                                            a.customerId = cleanPId;
                                            a.customerName = cleanPName;
                                            return a;
                                        });
                                        agg.orderCount++;
                                        agg.totalQty = agg.totalQty.add(docQty);
                                        agg.totalRevenue = agg.totalRevenue.add(docRev);
                                        if (agg.lastPurchaseDate == null || dDate.isAfter(agg.lastPurchaseDate)) {
                                            agg.lastPurchaseDate = dDate;
                                        }
                                        int mVal = dDate.getMonthValue();
                                        int qVal = (mVal - 1) / 3 + 1;
                                        agg.monthlyRevenue.merge(mVal, docRev, BigDecimal::add);
                                        agg.quarterlyRevenue.merge(qVal, docRev, BigDecimal::add);
                                    }
                                }
                            }
                        }
                    }
                } catch (SQLException ignored) {
                    // Nếu schema chưa có bảng inv_doc thì bỏ qua an toàn
                }

                BigDecimal chartTotalRev = BigDecimal.ZERO;
                List<Map<String, Object>> series = new ArrayList<>();
                for (int i = 0; i < bucketCount; i++) {
                    chartTotalRev = chartTotalRev.add(buckets[i]);
                    Map<String, Object> pt = new LinkedHashMap<>();
                    pt.put("label", periodLabels.get(i));
                    pt.put("revenue", buckets[i]);
                    pt.put("orderCount", bucketOrders[i]);
                    series.add(pt);
                }

                Map<String, Object> coChart = new LinkedHashMap<>();
                coChart.put("companyId", String.valueOf(co.id));
                coChart.put("companyCode", co.code);
                coChart.put("companyName", co.name);
                coChart.put("periodRevenue", companyPeriodRevenue);
                coChart.put("periodOrders", companyPeriodOrders);
                coChart.put("periodQty", companyPeriodQty);
                coChart.put("periodCustomers", companyPeriodCustomers.size());
                coChart.put("chartTotalRevenue", chartTotalRev);
                coChart.put("series", series);
                companyChartOut.add(coChart);

                if (filterCid == null || filterCid.equalsIgnoreCase(String.valueOf(co.id)) || filterCid.equalsIgnoreCase(co.code)) {
                    grandTotalRevenue = grandTotalRevenue.add(companyPeriodRevenue);
                    grandTotalOrders += companyPeriodOrders;
                    grandTotalQty = grandTotalQty.add(companyPeriodQty);
                }
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Không thể truy vấn dữ liệu báo cáo Owner", e);
        }

        // Sắp xếp danh sách khách hàng theo doanh số giảm dần
        List<CustomerAgg> sortedCusts = new ArrayList<>(customerAggMap.values());
        sortedCusts.sort(Comparator.comparing((CustomerAgg a) -> a.totalRevenue).reversed()
                .thenComparing(a -> a.orderCount, Comparator.reverseOrder())
                .thenComparing(a -> a.customerName, String.CASE_INSENSITIVE_ORDER));

        BigDecimal filteredCustTotalRev = BigDecimal.ZERO;
        long filteredCustTotalOrders = 0;
        BigDecimal filteredCustTotalQty = BigDecimal.ZERO;
        for (CustomerAgg a : sortedCusts) {
            filteredCustTotalRev = filteredCustTotalRev.add(a.totalRevenue);
            filteredCustTotalOrders += a.orderCount;
            filteredCustTotalQty = filteredCustTotalQty.add(a.totalQty);
        }

        List<Map<String, Object>> customerRows = new ArrayList<>();
        int rank = 1;
        for (CustomerAgg a : sortedCusts) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("rank", rank++);
            row.put("companyId", a.companyId);
            row.put("companyCode", a.companyCode);
            row.put("companyName", a.companyName);
            row.put("customerId", a.customerId);
            row.put("customerName", a.customerName);
            row.put("orderCount", a.orderCount);
            row.put("totalQty", a.totalQty);
            row.put("totalRevenue", a.totalRevenue);
            BigDecimal avgOrder = a.orderCount > 0
                    ? a.totalRevenue.divide(BigDecimal.valueOf(a.orderCount), 0, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            row.put("avgOrderValue", avgOrder);
            double sharePct = filteredCustTotalRev.signum() > 0
                    ? a.totalRevenue.multiply(BigDecimal.valueOf(10000))
                            .divide(filteredCustTotalRev, 0, RoundingMode.HALF_UP).doubleValue() / 100.0
                    : 0.0;
            row.put("sharePercent", sharePct);
            row.put("lastPurchaseDate", a.lastPurchaseDate != null ? a.lastPurchaseDate.toString() : null);

            Map<String, BigDecimal> qMap = new LinkedHashMap<>();
            for (int qt = 1; qt <= 4; qt++) {
                qMap.put("Q" + qt, a.quarterlyRevenue.getOrDefault(qt, BigDecimal.ZERO));
            }
            row.put("quarters", qMap);

            Map<String, BigDecimal> mMap = new LinkedHashMap<>();
            for (int m = 1; m <= 12; m++) {
                mMap.put("T" + m, a.monthlyRevenue.getOrDefault(m, BigDecimal.ZERO));
            }
            row.put("months", mMap);
            customerRows.add(row);
        }

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("revenue", filteredCustTotalRev);
        totals.put("orders", filteredCustTotalOrders);
        totals.put("qty", filteredCustTotalQty);
        totals.put("customers", customerRows.size());
        totals.put("companies", companyChartOut.size());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("periodType", pType);
        res.put("year", targetYear);
        res.put("quarter", targetQuarter);
        res.put("month", targetMonth);
        res.put("dateFrom", custFrom.toString());
        res.put("dateTo", custTo.toString());
        res.put("periodLabels", periodLabels);
        res.put("companies", companyListOut);
        res.put("companySalesChart", companyChartOut);
        res.put("customerStats", customerRows);
        res.put("totals", totals);
        return res;
    }

    private List<CompanyInfo> resolveOwnerCompanies(String username, boolean isSystemAdmin) {
        if (username == null || username.isBlank()) {
            throw forbidden("Chưa xác thực người dùng");
        }
        User user = User.findByUsername(username);
        boolean isOwnerRole = user != null && (
                "admin".equalsIgnoreCase(user.role)
                || AdminService.ROLE_COMPANY_ADMIN.equalsIgnoreCase(user.role)
        );
        List<UserCompany> links = user != null
                ? UserCompany.list("userId = ?1 order by isOwner desc, companyId asc", user.id)
                : List.of();
        Set<Long> ownerIds = new LinkedHashSet<>();
        Set<Long> allowedIds = new LinkedHashSet<>();
        for (UserCompany uc : links) {
            if (uc.companyId != null) {
                allowedIds.add(uc.companyId);
                if (Boolean.TRUE.equals(uc.isOwner)) {
                    ownerIds.add(uc.companyId);
                }
            }
        }
        if (user != null && user.defaultCompanyId != null) {
            allowedIds.add(user.defaultCompanyId);
        }

        if (!isSystemAdmin && !isOwnerRole && ownerIds.isEmpty()) {
            throw forbidden("Chỉ tài khoản Chủ sở hữu (Owner) mới có quyền xem báo cáo thống kê này");
        }

        List<DmCongTy> dbCompanies;
        if (isSystemAdmin) {
            dbCompanies = DmCongTy.list("status = ?1 order by id asc", "active");
        } else {
            Set<Long> targetIds = !ownerIds.isEmpty() ? ownerIds : allowedIds;
            if (targetIds.isEmpty()) {
                dbCompanies = List.of();
            } else {
                dbCompanies = DmCongTy.list("status = ?1 and id in ?2 order by id asc", "active", targetIds);
            }
        }

        List<CompanyInfo> result = new ArrayList<>();
        for (DmCongTy c : dbCompanies) {
            result.add(new CompanyInfo(c.id, c.code, c.name, c.schemaName));
        }
        if (result.isEmpty() && (isSystemAdmin || (user != null && Boolean.TRUE.equals(user.allowPublic)))) {
            result.add(new CompanyInfo(0L, "DEFAULT", "Công ty mặc định", "public"));
        }
        return result;
    }

    private static boolean isValidSchema(String schema) {
        return schema != null && ("public".equalsIgnoreCase(schema) || VALID_SCHEMA.matcher(schema).matches());
    }

    private static String quoteIdent(String ident) {
        return '"' + ident.replace("\"", "\"\"") + '"';
    }

    private static BigDecimal nonNull(BigDecimal b) {
        return b == null ? BigDecimal.ZERO : b;
    }

    private static WebApplicationException forbidden(String message) {
        return new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                .entity(Map.of("message", message))
                .type(MediaType.APPLICATION_JSON)
                .build());
    }

    private static class CompanyInfo {
        final Long id;
        final String code;
        final String name;
        final String schemaName;

        CompanyInfo(Long id, String code, String name, String schemaName) {
            this.id = id;
            this.code = code;
            this.name = name;
            this.schemaName = schemaName;
        }
    }

    private static class CustomerAgg {
        String companyId;
        String companyCode;
        String companyName;
        String customerId;
        String customerName;
        long orderCount = 0;
        BigDecimal totalQty = BigDecimal.ZERO;
        BigDecimal totalRevenue = BigDecimal.ZERO;
        LocalDate lastPurchaseDate = null;
        Map<Integer, BigDecimal> monthlyRevenue = new HashMap<>();
        Map<Integer, BigDecimal> quarterlyRevenue = new HashMap<>();
    }
}
