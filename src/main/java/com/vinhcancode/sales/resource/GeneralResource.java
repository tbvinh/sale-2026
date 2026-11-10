package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Account;
import com.vinhcancode.sales.entity.GeneralVoucher;
import com.vinhcancode.sales.entity.GeneralVoucherLine;
import com.vinhcancode.sales.service.PermissionService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import jakarta.persistence.Query;
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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Tong hop: phieu ke toan, phieu bu tru cong no, bang can doi so phat sinh
 * va cac lenh xu ly (ket chuyen loi lai, danh lai so phieu, in phieu, tinh lai so du).
 */
@Path("/general")
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
@Authenticated                                   // CS-S1
public class GeneralResource {
    static final Map<String,String> PREFIX = Map.of("journal", "PK", "offset", "BT");

    private static final Map<String,String> SORTABLE = Map.of(
            "no", "v.code", "date", "v.date", "type", "v.type",
            "partner", "v.partnerName", "amount", "v.amount");

    private static final int MAX_UNPAGED = 10_000;
    private static final int MAX_PRINT = 500;

    @Inject EntityManager em;
    @Inject JsonWebToken jwt;
    @Inject PermissionService permissions;

    // ---------- Danh sach chung tu ----------
    @GET @Path("/vouchers")
    public Map<String, Object> list(@QueryParam("q") String q,
                                    @QueryParam("type") String type,
                                    @QueryParam("dateFrom") String dateFrom,
                                    @QueryParam("dateTo") String dateTo,
                                    @QueryParam("page") Integer page,
                                    @QueryParam("pageSize") Integer pageSize,
                                    @QueryParam("sort") String sort,
                                    @QueryParam("dir") @DefaultValue("desc") String dir) {
        permissions.require("general", "READ");
        StringBuilder where = new StringBuilder(" where v.status <> 'cancelled'");
        Map<String, Object> params = new HashMap<>();

        if (q != null && !q.isBlank()) {
            where.append(" and (lower(v.code) like :q or lower(v.name) like :q or lower(v.partnerName) like :q)");
            params.put("q", "%" + q.trim().toLowerCase() + "%");
        }
        if (type != null && !type.isBlank()) {
            if (!PREFIX.containsKey(type)) throw MasterResource.bad("Loại chứng từ không hợp lệ");
            where.append(" and v.type = :type");
            params.put("type", type);
        }
        LocalDate from = date(dateFrom);
        LocalDate to = date(dateTo);
        if (from != null) { where.append(" and v.date >= :from"); params.put("from", from); }
        if (to != null) { where.append(" and v.date <= :to"); params.put("to", to); }

        boolean paged = page != null || pageSize != null;
        int pg = Math.max(1, page == null ? 1 : page);
        int size = Math.min(Math.max(1, pageSize == null ? 10 : pageSize), 100);

        String path = sort == null ? null : SORTABLE.get(sort);
        String order = " order by " + (path == null ? "v.date" : path)
                + ("asc".equalsIgnoreCase(dir) ? " asc" : " desc") + ", v.code desc";

        Query query = em.createQuery("select distinct v from GeneralVoucher v left join fetch v.lines" + where + order);
        Query count = em.createQuery("select count(v) from GeneralVoucher v" + where);
        params.forEach((k, val) -> { query.setParameter(k, val); count.setParameter(k, val); });

        List<?> items = (paged ? query.setFirstResult((pg - 1) * size).setMaxResults(size)
                : query.setMaxResults(MAX_UNPAGED)).getResultList();
        return Map.of("items", items, "total", ((Number) count.getSingleResult()).longValue());
    }

    @GET @Path("/vouchers/{id}")
    public GeneralVoucher get(@PathParam("id") String id) {
        permissions.require("general", "READ");
        GeneralVoucher v = em.find(GeneralVoucher.class, id);
        if (v == null) throw new NotFoundException();
        v.lines.size();                     // khởi tạo lazy trong transaction của request
        return v;
    }

    // ---------- Them / sua / huy chung tu ----------
    @POST @Path("/vouchers") @Transactional
    public Response create(GeneralVoucher v) {
        permissions.require("general", "CREATE");
        v.id = null;
        v.code = null;
        normalize(v);
        validate(v);
        v.code = nextNo(v.type);
        v.status = "posted";
        v.createdBy = username();
        v.updatedBy = v.createdBy;
        linkLines(v, v.lines);
        em.persist(v);
        flushOrConflict("Số chứng từ đã tồn tại hoặc dữ liệu không hợp lệ");
        return Response.status(Response.Status.CREATED).entity(v).build();
    }

    @PUT @Path("/vouchers/{id}") @Transactional
    public GeneralVoucher update(@PathParam("id") String id, GeneralVoucher in) {
        permissions.require("general", "UPDATE");
        GeneralVoucher v = em.find(GeneralVoucher.class, id);
        if (v == null) throw new NotFoundException();
        if ("cancelled".equals(v.status)) throw MasterResource.bad("Chứng từ đã hủy không thể sửa");
        if (in.type != null && !in.type.equals(v.type)) throw MasterResource.bad("Không được đổi loại chứng từ");

        v.date = in.date;
        v.name = in.name;
        v.partnerId = in.partnerId;
        v.partnerName = in.partnerName;
        if (!v.lines.isEmpty()) {
            v.lines.clear();
            em.flush();                     // xóa dòng cũ trước khi chèn dòng mới (UNIQUE voucher_id,pos)
        }
        linkLines(v, in.lines);
        normalize(v);
        validate(v);
        v.updatedBy = username();
        flushOrConflict("Dữ liệu không hợp lệ");
        return v;
    }

    // CS-S13: chung tu da lap khong xoa cung — chuyen trang thai 'cancelled'
    @DELETE @Path("/vouchers/{id}") @Transactional
    public void cancel(@PathParam("id") String id) {
        permissions.require("general", "DELETE");
        GeneralVoucher v = em.find(GeneralVoucher.class, id);
        if (v == null) throw new NotFoundException();
        v.status = "cancelled";
        v.updatedBy = username();
    }

    // ---------- Bang can doi so phat sinh ----------
    @GET @Path("/trial-balance")
    public Map<String, Object> trialBalance(@QueryParam("dateFrom") String dateFrom,
                                            @QueryParam("dateTo") String dateTo) {
        permissions.require("general", "READ");
        LocalDate[] range = range(dateFrom, dateTo);
        LocalDate from = range[0];
        LocalDate to = range[1];

        List<Account> accounts = em.createQuery("select a from Account a order by a.code", Account.class)
                .setMaxResults(MAX_UNPAGED).getResultList();

        Map<String, long[]> opening = new HashMap<>();
        @SuppressWarnings("unchecked")
        List<Object[]> balances = em.createQuery("select o.accountId, o.direction, sum(o.amount)"
                        + " from OpeningBalance o where o.kind = 'account' and o.accountId is not null"
                        + " group by o.accountId, o.direction")
                .getResultList();
        for (Object[] row : balances) {
            long[] x = opening.computeIfAbsent((String) row[0], k -> new long[2]);
            long amount = decimal(row[2]).longValue();
            if ("credit".equals(row[1])) x[1] += amount; else x[0] += amount;
        }

        Map<String, Long> periodDebit = grouped("select l.accountId, sum(l.debit) from GeneralVoucherLine l"
                + " join l.voucher v where v.status = 'posted' and v.date between :from and :to"
                + " group by l.accountId", from, to);
        Map<String, Long> periodCredit = grouped("select l.accountId, sum(l.credit) from GeneralVoucherLine l"
                + " join l.voucher v where v.status = 'posted' and v.date between :from and :to"
                + " group by l.accountId", from, to);

        long tOpeningDebit = 0, tOpeningCredit = 0, tPeriodDebit = 0, tPeriodCredit = 0;
        long tClosingDebit = 0, tClosingCredit = 0;
        List<Map<String, Object>> items = new ArrayList<>();

        for (Account a : accounts) {
            long[] op = opening.getOrDefault(a.id, new long[2]);
            long pd = periodDebit.getOrDefault(a.id, 0L);
            long pc = periodCredit.getOrDefault(a.id, 0L);
            if (op[0] == 0 && op[1] == 0 && pd == 0 && pc == 0) continue;

            long net = (op[0] + pd) - (op[1] + pc);
            long closingDebit = net > 0 ? net : 0;
            long closingCredit = net < 0 ? -net : 0;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("accountId", a.id);
            row.put("code", a.code);
            row.put("name", a.name);
            row.put("openingDebit", op[0]);
            row.put("openingCredit", op[1]);
            row.put("periodDebit", pd);
            row.put("periodCredit", pc);
            row.put("closingDebit", closingDebit);
            row.put("closingCredit", closingCredit);
            items.add(row);

            tOpeningDebit += op[0]; tOpeningCredit += op[1];
            tPeriodDebit += pd; tPeriodCredit += pc;
            tClosingDebit += closingDebit; tClosingCredit += closingCredit;
        }

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("openingDebit", tOpeningDebit);
        totals.put("openingCredit", tOpeningCredit);
        totals.put("periodDebit", tPeriodDebit);
        totals.put("periodCredit", tPeriodCredit);
        totals.put("closingDebit", tClosingDebit);
        totals.put("closingCredit", tClosingCredit);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("dateFrom", from);
        res.put("dateTo", to);
        res.put("items", items);
        res.put("totals", totals);
        return res;
    }

    // ---------- Lenh xu ly ----------
    // 1) Ket chuyen lo lai: tinh doanh thu/gia von trong ky va tao phieu ke toan 911 <-> 421
    @POST @Path("/commands/close-profit-loss") @Transactional
    public Map<String, Object> closeProfitLoss(Map<String, Object> body) {
        permissions.require("general", "UPDATE");
        LocalDate[] range = range(str(body, "dateFrom"), str(body, "dateTo"));
        LocalDate from = range[0];
        LocalDate to = range[1];

        Object[] amounts = profitAndCost(from, to);
        long revenue = decimal(amounts[0]).longValue();
        long cost = decimal(amounts[1]).longValue();
        long profit = revenue - cost;
        if (profit == 0) throw MasterResource.bad("Không có chênh lệch lỗ lãi để kết chuyển");

        String profitAccount = str(body, "accountId");
        if (blank(profitAccount)) profitAccount = accountIdByCode("421");
        if (blank(profitAccount)) throw MasterResource.bad("Chưa có tài khoản 421 để kết chuyển");
        String account911 = accountIdByCode("911");
        if (blank(account911)) throw MasterResource.bad("Chưa có tài khoản 911 để kết chuyển");

        GeneralVoucher v = new GeneralVoucher();
        v.type = "journal";
        v.date = to;
        v.name = "Kết chuyển lỗ lãi kỳ " + from + " - " + to;
        v.status = "posted";
        v.code = nextNo("journal");
        v.createdBy = username();
        v.updatedBy = v.createdBy;

        GeneralVoucherLine line1 = new GeneralVoucherLine();
        GeneralVoucherLine line2 = new GeneralVoucherLine();
        if (profit > 0) {
            line1.accountId = account911; line1.debit = profit; line1.note = "Kết chuyển lãi";
            line2.accountId = profitAccount; line2.credit = profit; line2.note = "Lợi nhuận sau thuế";
        } else {
            long loss = -profit;
            line1.accountId = profitAccount; line1.debit = loss; line1.note = "Lỗ kỳ này";
            line2.accountId = account911; line2.credit = loss; line2.note = "Kết chuyển lỗ";
        }
        v.lines.add(line1);
        v.lines.add(line2);
        linkLines(v, v.lines);
        validate(v);
        em.persist(v);
        flushOrConflict("Không thể tạo phiếu kết chuyển");

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("voucher", v);
        res.put("revenue", revenue);
        res.put("cost", cost);
        res.put("profit", profit);
        res.put("dateFrom", from);
        res.put("dateTo", to);
        return res;
    }

    // 5) Danh lai so phieu: PK0001.., BT0001.. theo ngay lap
    @POST @Path("/commands/renumber") @Transactional
    public Map<String, Object> renumber(Map<String, Object> body) {
        permissions.require("general", "UPDATE");
        String type = str(body, "type");
        if (blank(type)) type = "journal";
        if (!PREFIX.containsKey(type)) throw MasterResource.bad("Loại chứng từ không hợp lệ");
        String prefix = PREFIX.get(type);

        // Hai buoc: doi sang ma tam (tranh trung UNIQUE khi so cu dao thu tu) roi moi danh so chinh thuc.
        em.createNativeQuery("update general_vouchers g set code = :tmp || lpad(x.rn::text, 4, '0')"
                        + " from (select id, row_number() over (order by doc_date, id) rn"
                        + " from general_vouchers where type = :type) x where g.id = x.id")
                .setParameter("tmp", "TMP" + prefix)
                .setParameter("type", type)
                .executeUpdate();

        int count = em.createNativeQuery("update general_vouchers g set code = :p || lpad(x.rn::text, 4, '0')"
                        + " from (select id, row_number() over (order by doc_date, id) rn"
                        + " from general_vouchers where type = :type) x where g.id = x.id")
                .setParameter("p", prefix)
                .setParameter("type", type)
                .executeUpdate();

        List<Object[]> mm = em.createQuery("select min(v.code), max(v.code) from GeneralVoucher v where v.type = :t",
                        Object[].class)
                .setParameter("t", type)
                .getResultList();
        Object[] row = mm.isEmpty() ? new Object[]{null, null} : mm.get(0);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("type", type);
        res.put("prefix", prefix);
        res.put("count", count);
        res.put("first", row[0]);
        res.put("last", row[1]);
        return res;
    }

    // 7) Tinh lai so du: tinh lai so luong/gia tri ton cho tung vat tu, hang hoa
    @POST @Path("/commands/recalculate") @Transactional
    public Map<String, Object> recalculate() {
        permissions.require("general", "UPDATE");
        em.createNativeQuery("delete from stock_balances").executeUpdate();
        int materials = em.createNativeQuery("insert into stock_balances (material_id, qty, value, updated_at)"
                        + " select l.product_id,"
                        + " sum(case when d.type = 'export' then -l.qty else l.qty end),"
                        + " sum(case when d.type = 'export' then -l.qty * l.price else l.qty * l.price end), now()"
                        + " from inv_doc_line l join inv_doc d on d.id = l.doc_id"
                        + " where d.type <> 'transfer' group by l.product_id")
                .executeUpdate();

        Object[] totals = (Object[]) em.createNativeQuery(
                        "select coalesce(sum(qty), 0), coalesce(sum(value), 0) from stock_balances")
                .getSingleResult();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("materials", materials);
        res.put("totalQty", decimal(totals[0]).longValue());
        res.put("totalValue", decimal(totals[1]).longValue());
        return res;
    }

    // 6) In phieu: danh dau da in va tra danh sach phieu trong khoang ngay
    @POST @Path("/commands/print") @Transactional
    public Map<String, Object> batchPrint(Map<String, Object> body) {
        permissions.require("general", "READ");
        String type = str(body, "type");
        LocalDate[] range = range(str(body, "dateFrom"), str(body, "dateTo"));
        LocalDate from = range[0];
        LocalDate to = range[1];

        StringBuilder where = new StringBuilder(" where v.status = 'posted' and v.date between :from and :to");
        Map<String, Object> params = new HashMap<>();
        params.put("from", from);
        params.put("to", to);
        if (!blank(type)) {
            if (!PREFIX.containsKey(type)) throw MasterResource.bad("Loại chứng từ không hợp lệ");
            where.append(" and v.type = :type");
            params.put("type", type);
        }

        Query query = em.createQuery("select v from GeneralVoucher v" + where + " order by v.date asc, v.code asc");
        params.forEach(query::setParameter);
        @SuppressWarnings("unchecked")
        List<GeneralVoucher> vouchers = query.setMaxResults(MAX_PRINT).getResultList();
        if (vouchers.isEmpty()) throw MasterResource.bad("Không có phiếu để in trong khoảng ngày đã chọn");

        OffsetDateTime now = OffsetDateTime.now();
        String user = username();
        List<Map<String, Object>> items = new ArrayList<>();
        for (GeneralVoucher v : vouchers) {
            v.printedAt = now;
            v.printedBy = user;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", v.id);
            row.put("no", v.code);
            row.put("date", v.date);
            row.put("type", v.type);
            row.put("name", v.name);
            row.put("partnerName", v.partnerName);
            row.put("amount", v.amount);
            items.add(row);
        }
        em.flush();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("count", vouchers.size());
        res.put("items", items);
        res.put("dateFrom", from);
        res.put("dateTo", to);
        res.put("printedBy", user);
        return res;
    }

    // ---------- helper ----------
    private Object[] profitAndCost(LocalDate from, LocalDate to) {
        Query query = em.createNativeQuery("select coalesce(sum(e.qty * e.price), 0),"
                + " coalesce(sum(e.qty * coalesce(i.avg_price, 0)), 0)"
                + " from inv_doc_line e join inv_doc de on de.id = e.doc_id"
                + " left join (select l.product_id, sum(l.qty * l.price) / nullif(sum(l.qty), 0) as avg_price"
                + "            from inv_doc_line l join inv_doc d on d.id = l.doc_id"
                + "            where d.type = 'import' and d.doc_date <= :to group by l.product_id) i"
                + " on i.product_id = e.product_id"
                + " where de.type = 'export' and de.doc_date between :from and :to");
        query.setParameter("from", from);
        query.setParameter("to", to);
        return (Object[]) query.getSingleResult();
    }

    private String accountIdByCode(String code) {
        List<String> ids = em.createQuery("select a.id from Account a where a.code = :c", String.class)
                .setParameter("c", code).setMaxResults(1).getResultList();
        return ids.isEmpty() ? null : ids.get(0);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Long> grouped(String jpql, LocalDate from, LocalDate to) {
        List<Object[]> rows = em.createQuery(jpql)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        Map<String, Long> out = new HashMap<>();
        for (Object[] r : rows) out.put((String) r[0], decimal(r[1]).longValue());
        return out;
    }

    private void normalize(GeneralVoucher v) {
        if (v.date == null) v.date = LocalDate.now();
        if (v.name == null) v.name = "";
        if (v.lines == null) v.lines = new ArrayList<>();

        if (blank(v.partnerId)) {
            v.partnerId = null;
            v.partnerName = null;
        } else {
            List<String> names = em.createQuery("select p.name from Partner p where p.id = :id", String.class)
                    .setParameter("id", v.partnerId).setMaxResults(1).getResultList();
            if (!names.isEmpty()) v.partnerName = names.get(0);   // CS-S9
        }
    }

    private static void validate(GeneralVoucher v) {
        if (v.type == null || !PREFIX.containsKey(v.type)) throw MasterResource.bad("Loại chứng từ không hợp lệ");
        if (v.lines == null || v.lines.size() < 2) throw MasterResource.bad("Chứng từ phải có ít nhất 2 dòng bút toán");

        long debit = 0, credit = 0;
        int pos = 1;
        for (GeneralVoucherLine line : v.lines) {
            if (blank(line.accountId)) throw MasterResource.bad("Dòng " + pos + " chưa chọn tài khoản");
            if (line.debit < 0 || line.credit < 0) throw MasterResource.bad("Số tiền không hợp lệ");
            if (line.debit > 0 && line.credit > 0) throw MasterResource.bad("Mỗi dòng chỉ ghi Nợ hoặc Có");
            debit += line.debit;
            credit += line.credit;
            pos++;
        }
        if (debit == 0 && credit == 0) throw MasterResource.bad("Số tiền phải lớn hơn 0");
        if (debit != credit) throw MasterResource.bad("Tổng Nợ phải bằng tổng Có");
        v.amount = debit;
    }

    private static void linkLines(GeneralVoucher v, List<GeneralVoucherLine> lines) {
        for (int i = 0; i < lines.size(); i++) {
            GeneralVoucherLine line = lines.get(i);
            line.id = null;                        // server cap id
            line.voucher = v;                      // ⇒ voucher_id duoc ghi trong INSERT
            line.pos = i;
            if (!v.lines.contains(line)) v.lines.add(line);
        }
    }

    private String nextNo(String type) {
        String prefix = PREFIX.get(type);
        List<String> last = em.createQuery("select v.code from GeneralVoucher v where v.code like :p order by v.code desc", String.class)
                .setParameter("p", prefix + "%").setMaxResults(1).getResultList();
        int n = 0;
        if (!last.isEmpty()) {
            try { n = Integer.parseInt(last.get(0).substring(prefix.length())); } catch (NumberFormatException ignored) { }
        }
        return prefix + String.format("%04d", n + 1);
    }

    private String username() {
        String name = jwt.getName();
        return name == null || name.isBlank() ? null : name;
    }

    private void flushOrConflict(String msg) {
        try { em.flush(); }
        catch (PersistenceException ex) { throw conflict(msg); }
    }

    private static WebApplicationException conflict(String msg) {
        return new WebApplicationException(Response.status(Response.Status.CONFLICT)
                .entity(Map.of("message", msg)).type(MediaType.APPLICATION_JSON).build());
    }

    private static String str(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        return v == null ? null : v.toString();
    }

    private static LocalDate[] range(String dateFrom, String dateTo) {
        LocalDate to = date(dateTo);
        if (to == null) to = LocalDate.now();
        LocalDate from = date(dateFrom);
        if (from == null) from = to.withDayOfMonth(1);
        if (from.isAfter(to)) throw MasterResource.bad("Khoảng ngày không hợp lệ");
        return new LocalDate[]{from, to};
    }

    private static LocalDate date(String s) {
        if (s == null || s.isBlank()) return null;
        try { return LocalDate.parse(s.trim()); }
        catch (DateTimeParseException ex) { throw MasterResource.bad("Ngày không hợp lệ (yyyy-MM-dd)"); }
    }

    private static BigDecimal decimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        return new BigDecimal(o.toString());
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }
}
