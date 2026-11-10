package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Bank;
import com.vinhcancode.sales.entity.BankVoucher;
import com.vinhcancode.sales.service.PermissionService;
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
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Ngan hang: bao co / bao no / phieu luan chuyen tien te + so tien gui ngan hang.
 * Mot bang duy nhat (bank_vouchers); loai chung tu quyet dinh tien to so hieu.
 */
@Path("/bank")
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
@Authenticated                                   // CS-S1
public class BankVoucherResource {
    static final Map<String,String> PREFIX = Map.of("credit", "BC", "debit", "BN", "transfer", "LC");

    // Whitelist cot sap xep (BE-R12)
    private static final Map<String,String> SORTABLE = Map.of(
            "no", "v.code", "date", "v.date", "type", "v.type",
            "partner", "v.partnerName", "amount", "v.amount");

    private static final int MAX_UNPAGED = 10_000;

    @Inject EntityManager em;
    @Inject JsonWebToken jwt;
    @Inject PermissionService permissions;

    // ---------- Danh sach chung tu ----------
    @GET @Path("/vouchers")
    public Map<String, Object> list(@QueryParam("q") String q,
                                    @QueryParam("type") String type,
                                    @QueryParam("bankId") String bankId,
                                    @QueryParam("dateFrom") String dateFrom,
                                    @QueryParam("dateTo") String dateTo,
                                    @QueryParam("page") Integer page,
                                    @QueryParam("pageSize") Integer pageSize,
                                    @QueryParam("sort") String sort,
                                    @QueryParam("dir") @DefaultValue("desc") String dir) {
        permissions.require("bank", "READ");
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
        if (bankId != null && !bankId.isBlank()) {
            // Chứng từ liên quan tới ngân hàng: chứng từ chính hoặc đích của phiếu luân chuyển
            where.append(" and (v.bankId = :bankId or v.toBankId = :bankId)");
            params.put("bankId", bankId.trim());
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

        TypedQuery<BankVoucher> query = em.createQuery("select v from BankVoucher v" + where + order, BankVoucher.class);
        TypedQuery<Long> count = em.createQuery("select count(v) from BankVoucher v" + where, Long.class);
        params.forEach((k, val) -> { query.setParameter(k, val); count.setParameter(k, val); });

        List<BankVoucher> items = (paged ? query.setFirstResult((pg - 1) * size).setMaxResults(size)
                : query.setMaxResults(MAX_UNPAGED)).getResultList();
        return Map.of("items", items, "total", count.getSingleResult());
    }

    @GET @Path("/vouchers/{id}")
    public BankVoucher get(@PathParam("id") String id) {
        permissions.require("bank", "READ");
        BankVoucher v = em.find(BankVoucher.class, id);
        if (v == null) throw new NotFoundException();
        return v;
    }

    // ---------- Them / sua / huy chung tu ----------
    @POST @Path("/vouchers") @Transactional
    public Response create(BankVoucher v) {
        permissions.require("bank", "CREATE");
        v.id = null;
        normalize(v);
        validate(v);
        v.code = nextNo(v.type);
        v.status = "posted";
        v.createdBy = username();
        v.updatedBy = v.createdBy;
        em.persist(v);
        flushOrConflict("Số chứng từ đã tồn tại hoặc dữ liệu không hợp lệ");
        return Response.status(Response.Status.CREATED).entity(v).build();
    }

    @PUT @Path("/vouchers/{id}") @Transactional
    public BankVoucher update(@PathParam("id") String id, BankVoucher in) {
        permissions.require("bank", "UPDATE");
        BankVoucher v = em.find(BankVoucher.class, id);
        if (v == null) throw new NotFoundException();
        if ("cancelled".equals(v.status)) throw MasterResource.bad("Chứng từ đã hủy không thể sửa");
        if (in.type != null && !in.type.equals(v.type)) throw MasterResource.bad("Không được đổi loại chứng từ");

        v.date = in.date;
        v.name = in.name;
        v.bankId = in.bankId;
        v.toBankId = in.toBankId;
        v.partnerId = in.partnerId;
        v.partnerName = in.partnerName;
        v.accountId = in.accountId;
        v.amount = in.amount;
        v.currency = in.currency;
        normalize(v);
        validate(v);
        v.updatedBy = username();
        flushOrConflict("Dữ liệu không hợp lệ");
        return v;
    }

    // CS-S13: chung tu da lap khong xoa cung — chuyen trang thai 'cancelled'
    @DELETE @Path("/vouchers/{id}") @Transactional
    public void cancel(@PathParam("id") String id) {
        permissions.require("bank", "DELETE");
        BankVoucher v = em.find(BankVoucher.class, id);
        if (v == null) throw new NotFoundException();
        v.status = "cancelled";
        v.updatedBy = username();
    }

    // ---------- So tien gui ngan hang ----------
    @GET @Path("/ledger")
    public Map<String, Object> ledger(@QueryParam("bankId") String bankId,
                                      @QueryParam("dateFrom") String dateFrom,
                                      @QueryParam("dateTo") String dateTo) {
        permissions.require("bank", "READ");
        if (bankId == null || bankId.isBlank()) throw MasterResource.bad("Vui lòng chọn ngân hàng");
        if (em.find(Bank.class, bankId) == null) throw new NotFoundException();

        LocalDate to = date(dateTo);
        if (to == null) to = LocalDate.now();
        LocalDate from = date(dateFrom);
        if (from == null) from = to.withDayOfMonth(1);
        if (from.isAfter(to)) throw MasterResource.bad("Khoảng ngày không hợp lệ");

        Map<String, Object> params = Map.of("bid", bankId);
        long openingIn = sumWhere("((v.type = 'credit' and v.bankId = :bid) or (v.type = 'transfer' and v.toBankId = :bid))", params, from);
        long openingOut = sumWhere("((v.type = 'debit' and v.bankId = :bid) or (v.type = 'transfer' and v.bankId = :bid))", params, from);
        long opening = openingIn - openingOut;

        TypedQuery<BankVoucher> query = em.createQuery(
                "select v from BankVoucher v where v.status = 'posted' and v.date between :from and :to"
                        + " and (v.bankId = :bid or v.toBankId = :bid) order by v.date asc, v.code asc", BankVoucher.class);
        query.setParameter("bid", bankId);
        query.setParameter("from", from);
        query.setParameter("to", to);

        long totalIn = 0, totalOut = 0, balance = opening;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (BankVoucher v : query.getResultList()) {
            // Tien vao: bao co, hoac nhan tien tu phieu luan chuyen. Tien ra: bao no, hoac chuyen di.
            boolean incoming = "transfer".equals(v.type) ? bankId.equals(v.toBankId) : "credit".equals(v.type);
            long in = incoming ? v.amount : 0;
            long out = incoming ? 0 : v.amount;
            totalIn += in;
            totalOut += out;
            balance += in - out;

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", v.id);
            r.put("no", v.code);
            r.put("date", v.date);
            r.put("type", v.type);
            r.put("name", v.name);
            r.put("partnerName", v.partnerName);
            r.put("bankId", v.bankId);
            r.put("toBankId", v.toBankId);
            r.put("in", in);
            r.put("out", out);
            r.put("balance", balance);
            rows.add(r);
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("bankId", bankId);
        res.put("dateFrom", from);
        res.put("dateTo", to);
        res.put("opening", opening);
        res.put("totalIn", totalIn);
        res.put("totalOut", totalOut);
        res.put("closing", balance);
        res.put("items", rows);
        return res;
    }

    // ---------- helper ----------
    private void normalize(BankVoucher v) {
        if (blank(v.currency)) v.currency = "VND";
        if (v.date == null) v.date = LocalDate.now();
        if (v.name == null) v.name = "";
        if (v.amount < 0) v.amount = 0;

        if (!"transfer".equals(v.type) || blank(v.toBankId)) v.toBankId = null;

        if (blank(v.partnerId)) {
            v.partnerId = null;
            v.partnerName = null;
        } else {
            List<String> names = em.createQuery("select p.name from Partner p where p.id = :id", String.class)
                    .setParameter("id", v.partnerId).setMaxResults(1).getResultList();
            if (!names.isEmpty()) v.partnerName = names.get(0);   // CS-S9
        }
    }

    private static void validate(BankVoucher v) {
        if (v.type == null || !PREFIX.containsKey(v.type)) throw MasterResource.bad("Loại chứng từ không hợp lệ");
        if (blank(v.bankId)) throw MasterResource.bad("Chưa chọn ngân hàng");
        if (v.amount <= 0) throw MasterResource.bad("Số tiền phải lớn hơn 0");
        if ("transfer".equals(v.type)) {
            if (blank(v.toBankId)) throw MasterResource.bad("Phiếu luân chuyển phải có ngân hàng nhận");
            if (v.toBankId.equals(v.bankId)) throw MasterResource.bad("Ngân hàng nhận phải khác ngân hàng nguồn");
        }
    }

    private String nextNo(String type) {
        String prefix = PREFIX.get(type);
        List<String> last = em.createQuery("select v.code from BankVoucher v where v.code like :p order by v.code desc", String.class)
                .setParameter("p", prefix + "%").setMaxResults(1).getResultList();
        int n = 0;
        if (!last.isEmpty()) {
            try { n = Integer.parseInt(last.get(0).substring(prefix.length())); } catch (NumberFormatException ignored) { }
        }
        return prefix + String.format("%04d", n + 1);
    }

    private long sumWhere(String condition, Map<String, Object> params, LocalDate from) {
        TypedQuery<Long> query = em.createQuery("select coalesce(sum(v.amount), 0) from BankVoucher v"
                + " where v.status = 'posted' and " + condition + " and v.date < :from", Long.class);
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
