package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Account;
import com.vinhcancode.sales.entity.CashVoucher;
import com.vinhcancode.sales.entity.Customer;
import com.vinhcancode.sales.entity.DmCongTy;
import com.vinhcancode.sales.entity.InvDoc;
import com.vinhcancode.sales.entity.Partner;
import com.vinhcancode.sales.entity.Supplier;
import com.vinhcancode.sales.service.AmountInWords;
import com.vinhcancode.sales.service.PermissionService;
import com.vinhcancode.sales.tenant.TenantContext;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Tien mat: phieu thu / phieu chi / phieu doi tien te + so quy.
 * Mot bang duy nhat (cash_vouchers); loai phieu quyet dinh tien to so phieu.
 */
@Path("/cash")
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
@Authenticated                                   // CS-S1
public class CashVoucherResource {
    static final Map<String,String> PREFIX = Map.of("receipt", "PT", "payment", "PC", "exchange", "PD");

    // Whitelist cot sap xep (BE-R12)
    private static final Map<String,String> SORTABLE = Map.of(
            "no", "v.code", "date", "v.date", "type", "v.type",
            "partner", "v.partnerName", "amount", "v.amount");

    private static final int MAX_UNPAGED = 10_000;

    @Inject EntityManager em;
    @Inject JsonWebToken jwt;
    @Inject PermissionService permissions;
    @Inject TenantContext tenant;

    // ---------- Danh sach phieu ----------
    @GET @Path("/vouchers")
    public Map<String, Object> list(@QueryParam("q") String q,
                                    @QueryParam("type") String type,
                                    @QueryParam("dateFrom") String dateFrom,
                                    @QueryParam("dateTo") String dateTo,
                                    @QueryParam("page") Integer page,
                                    @QueryParam("pageSize") Integer pageSize,
                                    @QueryParam("sort") String sort,
                                    @QueryParam("dir") @DefaultValue("desc") String dir) {
        permissions.require("cash", "READ");
        StringBuilder where = new StringBuilder(" where v.status <> 'cancelled'");
        Map<String, Object> params = new HashMap<>();

        if (q != null && !q.isBlank()) {
            where.append(" and (lower(v.code) like :q or lower(v.name) like :q or lower(v.partnerName) like :q)");
            params.put("q", "%" + q.trim().toLowerCase() + "%");
        }
        if (type != null && !type.isBlank()) {
            if (!PREFIX.containsKey(type)) throw MasterResource.bad("Loại phiếu không hợp lệ");
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

        TypedQuery<CashVoucher> query = em.createQuery("select v from CashVoucher v" + where + order, CashVoucher.class);
        TypedQuery<Long> count = em.createQuery("select count(v) from CashVoucher v" + where, Long.class);
        params.forEach((k, val) -> { query.setParameter(k, val); count.setParameter(k, val); });

        List<CashVoucher> items = (paged ? query.setFirstResult((pg - 1) * size).setMaxResults(size)
                : query.setMaxResults(MAX_UNPAGED)).getResultList();
        return Map.of("items", items, "total", count.getSingleResult());
    }

    @GET @Path("/vouchers/{id}")
    public Map<String, Object> get(@PathParam("id") String id) {
        permissions.require("cash", "READ");
        CashVoucher v = em.find(CashVoucher.class, id);
        if (v == null) throw new NotFoundException();
        return detail(v);
    }

    // Du lieu day du cho ban in: dia chi doi tuong, tai khoan, so tien bang chu, cong ty dang chon.
    private Map<String, Object> detail(CashVoucher v) {
        Account account = blank(v.accountId) ? null : em.find(Account.class, v.accountId);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", v.id);
        row.put("code", v.code);
        row.put("date", v.date);
        row.put("type", v.type);
        row.put("partnerId", v.partnerId);
        row.put("partnerName", v.partnerName);
        row.put("partnerAddress", partnerAddress(v.partnerId));
        row.put("accountId", v.accountId);
        row.put("accountCode", account == null ? null : account.code);
        row.put("accountName", account == null ? null : account.name);
        row.put("name", v.name);
        row.put("amount", v.amount);
        row.put("amountInWords", AmountInWords.vnd(v.amount));
        row.put("currency", v.currency);
        row.put("amountCurrency", v.amountCurrency);
        row.put("fxRate", v.fxRate);
        row.put("sourceDocId", v.sourceDocId);
        row.put("sourceDocNo", v.sourceDocNo);
        row.put("status", v.status);
        row.put("createdBy", v.createdBy);
        row.put("updatedBy", v.updatedBy);
        row.put("company", company());
        return row;
    }

    private String partnerAddress(String partnerId) {
        if (blank(partnerId)) return null;
        Partner partner = em.find(Partner.class, partnerId);
        if (partner != null) return partner.address;
        Customer customer = em.find(Customer.class, partnerId);
        if (customer != null) return customer.address;
        Supplier supplier = em.find(Supplier.class, partnerId);
        return supplier == null ? null : supplier.address;
    }

    private Map<String, Object> company() {
        DmCongTy company = null;
        String schema = tenant.getSchema();
        if (schema != null) company = DmCongTy.findBySchema(schema);
        if (company == null && tenant.getCompanyId() != null) {
            String key = tenant.getCompanyId().trim();
            company = DmCongTy.find("id::text = ?1 or lower(code) = ?2 or lower(schemaName) = ?2",
                    key, key.toLowerCase()).firstResult();
        }
        Map<String, Object> row = new LinkedHashMap<>();
        if (company == null) return row;
        row.put("id", company.id);
        row.put("code", company.code);
        row.put("name", company.name);
        row.put("address", company.address);
        row.put("taxCode", company.taxCode);
        row.put("phone", company.phone);
        return row;
    }

    // ---------- Them / sua / huy phieu ----------
    @POST @Path("/vouchers") @Transactional
    public Response create(CashVoucher v) {
        permissions.require("cash", "CREATE");
        v.id = null;
        normalize(v);
        validate(v);
        v.code = nextNo(v.type);
        v.status = "posted";
        v.createdBy = username();
        v.updatedBy = v.createdBy;
        em.persist(v);
        flushOrConflict("Số phiếu đã tồn tại hoặc dữ liệu không hợp lệ");
        return Response.status(Response.Status.CREATED).entity(v).build();
    }

    @PUT @Path("/vouchers/{id}") @Transactional
    public CashVoucher update(@PathParam("id") String id, CashVoucher in) {
        permissions.require("cash", "UPDATE");
        CashVoucher v = em.find(CashVoucher.class, id);
        if (v == null) throw new NotFoundException();
        if ("cancelled".equals(v.status)) throw MasterResource.bad("Phiếu đã hủy không thể sửa");
        if (in.type != null && !in.type.equals(v.type)) throw MasterResource.bad("Không được đổi loại phiếu");

        v.date = in.date;
        v.name = in.name;
        v.partnerId = in.partnerId;
        v.partnerName = in.partnerName;
        v.accountId = in.accountId;
        v.amount = in.amount;
        v.currency = in.currency;
        v.amountCurrency = in.amountCurrency;
        v.fxRate = in.fxRate;
        v.sourceDocId = in.sourceDocId;
        v.sourceDocNo = in.sourceDocNo;
        normalize(v);
        validate(v);
        v.updatedBy = username();
        flushOrConflict("Dữ liệu không hợp lệ");
        return v;
    }

    // CS-S13: chung tu da lap khong xoa cung — chuyen trang thai 'cancelled' (an khoi danh sach/so quy)
    @DELETE @Path("/vouchers/{id}") @Transactional
    public void cancel(@PathParam("id") String id) {
        permissions.require("cash", "DELETE");
        CashVoucher v = em.find(CashVoucher.class, id);
        if (v == null) throw new NotFoundException();
        v.status = "cancelled";
        v.updatedBy = username();
    }

    // ---------- So quy tien mat ----------
    @GET @Path("/book")
    public Map<String, Object> book(@QueryParam("dateFrom") String dateFrom,
                                    @QueryParam("dateTo") String dateTo,
                                    @QueryParam("accountId") String accountId) {
        permissions.require("cash", "READ");
        LocalDate to = date(dateTo);
        if (to == null) to = LocalDate.now();
        LocalDate from = date(dateFrom);
        if (from == null) from = to.withDayOfMonth(1);
        if (from.isAfter(to)) throw MasterResource.bad("Khoảng ngày không hợp lệ");

        StringBuilder base = new StringBuilder(" from CashVoucher v where v.status = 'posted'");
        Map<String, Object> params = new HashMap<>();
        if (!blank(accountId)) { base.append(" and v.accountId = :acc"); params.put("acc", accountId); }

        long openingIn = sumInRange("select coalesce(sum(v.amount), 0)" + base
                + " and v.type <> 'payment' and v.date < :from", params, from);
        long openingOut = sumInRange("select coalesce(sum(v.amount), 0)" + base
                + " and v.type = 'payment' and v.date < :from", params, from);
        long opening = openingIn - openingOut;

        TypedQuery<CashVoucher> query = em.createQuery(
                "select v" + base + " and v.date between :from and :to order by v.date asc, v.code asc", CashVoucher.class);
        params.forEach(query::setParameter);
        query.setParameter("from", from);
        query.setParameter("to", to);

        long totalIn = 0, totalOut = 0, balance = opening;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (CashVoucher v : query.getResultList()) {
            boolean out = "payment".equals(v.type);
            long receipt = out ? 0 : v.amount;         // thu + doi tien te (quy doi VND) => tang quy
            long payment = out ? v.amount : 0;
            totalIn += receipt;
            totalOut += payment;
            balance += receipt - payment;

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", v.id);
            r.put("no", v.code);
            r.put("date", v.date);
            r.put("type", v.type);
            r.put("name", v.name);
            r.put("partnerName", v.partnerName);
            r.put("accountId", v.accountId);
            r.put("currency", v.currency);
            r.put("amountCurrency", v.amountCurrency);
            r.put("receipt", receipt);
            r.put("payment", payment);
            r.put("balance", balance);
            rows.add(r);
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("dateFrom", from);
        res.put("dateTo", to);
        res.put("opening", opening);
        res.put("totalReceipt", totalIn);
        res.put("totalPayment", totalOut);
        res.put("closing", balance);
        res.put("items", rows);
        return res;
    }

    // ---------- Tao phieu thu/chi tu phieu nhap/xuat ----------
    @GET @Path("/vouchers/by-source/{docId}")
    public Map<String, Object> getBySource(@PathParam("docId") Long docId) {
        permissions.require("cash", "READ");
        List<CashVoucher> list = em.createQuery(
                "select v from CashVoucher v where v.sourceDocId = :id and v.status <> 'cancelled'", CashVoucher.class)
                .setParameter("id", docId).setMaxResults(1).getResultList();
        if (list.isEmpty()) {
            return Map.of();
        }
        return detail(list.get(0));
    }

    @POST @Path("/vouchers/from-inventory/{docId}") @Transactional
    public Response fromInventory(@PathParam("docId") Long docId) {
        permissions.require("cash", "CREATE");
        InvDoc doc = InvDoc.findById(docId);
        if (doc == null) throw new NotFoundException();
        if (!"import".equals(doc.type) && !"export".equals(doc.type) && !"return".equals(doc.type)) {
            throw MasterResource.bad("Chỉ tạo được phiếu thu/chi từ phiếu nhập, xuất hoặc trả kho");
        }
        long existed = em.createQuery("select count(v) from CashVoucher v where v.sourceDocId = :id and v.status <> 'cancelled'", Long.class)
                .setParameter("id", docId).getSingleResult();
        if (existed > 0) throw conflict("Phiếu kho này đã được tạo phiếu thu/chi");

        Object raw = em.createNativeQuery("select coalesce(sum(qty * price), 0) from inv_doc_line where doc_id = :id")
                .setParameter("id", docId).getSingleResult();
        long amount = raw == null ? 0 : ((Number) raw).longValue();
        if (amount <= 0) throw MasterResource.bad("Phiếu kho chưa có giá trị để tạo phiếu thu/chi");

        String type = "import".equals(doc.type) ? "payment" : "receipt";
        CashVoucher v = new CashVoucher();
        v.type = type;
        v.date = doc.date != null ? doc.date : LocalDate.now();
        v.amount = amount;
        v.amountCurrency = amount;
        v.currency = "VND";
        v.fxRate = BigDecimal.ZERO;
        v.sourceDocId = docId;
        v.sourceDocNo = doc.no;
        v.name = ("payment".equals(type) ? "Chi tiền nhập hàng " : "Thu tiền bán hàng ") + doc.no;
        v.accountId = defaultCashAccount();
        v.status = "posted";
        v.code = nextNo(type);
        v.createdBy = username();
        v.updatedBy = v.createdBy;

        // Doi tac: server tra theo phieu kho, khong nhan snapshot tu client (CS-S9)
        @SuppressWarnings("unchecked")
        List<Object[]> partner = em.createNativeQuery("select partner_id, partner_name from inv_doc where id = :id")
                .setParameter("id", docId).getResultList();
        if (!partner.isEmpty()) {
            Object[] p = partner.get(0);
            v.partnerId = p[0] == null ? null : p[0].toString();
            v.partnerName = p[1] == null ? null : p[1].toString();
        }

        em.persist(v);
        flushOrConflict("Không thể tạo phiếu thu/chi");
        return Response.status(Response.Status.CREATED).entity(v).build();
    }

    // ---------- helper ----------
    private void normalize(CashVoucher v) {
        if (blank(v.currency)) v.currency = "VND";
        if (v.fxRate == null || v.fxRate.signum() < 0) v.fxRate = BigDecimal.ZERO;
        if (v.amountCurrency < 0) v.amountCurrency = 0;
        if (v.date == null) v.date = LocalDate.now();
        if (v.name == null) v.name = "";
        if (v.amount < 0) v.amount = 0;

        if ("VND".equals(v.currency)) {
            v.amountCurrency = v.amount;
        } else if ("exchange".equals(v.type) && v.amount <= 0 && v.amountCurrency > 0 && v.fxRate.signum() > 0) {
            v.amount = v.fxRate.multiply(BigDecimal.valueOf(v.amountCurrency)).setScale(0, RoundingMode.HALF_UP).longValue();
        }

        if (blank(v.partnerId)) {
            v.partnerId = null;
            v.partnerName = null;
        } else {
            List<String> names = em.createQuery("select p.name from Partner p where p.id = :id", String.class)
                    .setParameter("id", v.partnerId).setMaxResults(1).getResultList();
            if (!names.isEmpty()) v.partnerName = names.get(0);   // CS-S9
        }
        v.sourceDocNo = blank(v.sourceDocNo) ? null : v.sourceDocNo;
    }

    private static void validate(CashVoucher v) {
        if (v.type == null || !PREFIX.containsKey(v.type)) throw MasterResource.bad("Loại phiếu không hợp lệ");
        if (v.amount <= 0) throw MasterResource.bad("Số tiền phải lớn hơn 0");
        if ("exchange".equals(v.type) && (v.amountCurrency <= 0 || v.fxRate.signum() <= 0)) {
            throw MasterResource.bad("Phiếu đổi tiền tệ phải có số ngoại tệ và tỷ giá");
        }
    }

    private String nextNo(String type) {
        String prefix = PREFIX.get(type);
        List<String> last = em.createQuery("select v.code from CashVoucher v where v.code like :p order by v.code desc", String.class)
                .setParameter("p", prefix + "%").setMaxResults(1).getResultList();
        int n = 0;
        if (!last.isEmpty()) {
            try { n = Integer.parseInt(last.get(0).substring(prefix.length())); } catch (NumberFormatException ignored) { }
        }
        return prefix + String.format("%04d", n + 1);
    }

    private String defaultCashAccount() {
        List<String> ids = em.createQuery("select a.id from Account a where a.code like '111%' order by a.code", String.class)
                .setMaxResults(1).getResultList();
        return ids.isEmpty() ? null : ids.get(0);
    }

    private long sumInRange(String jpql, Map<String, Object> params, LocalDate from) {
        TypedQuery<Long> query = em.createQuery(jpql, Long.class);
        params.forEach(query::setParameter);
        query.setParameter("from", from);
        return query.getSingleResult();
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

    private static LocalDate date(String s) {
        if (s == null || s.isBlank()) return null;
        try { return LocalDate.parse(s.trim()); }
        catch (DateTimeParseException ex) { throw MasterResource.bad("Ngày không hợp lệ (yyyy-MM-dd)"); }
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }
}
