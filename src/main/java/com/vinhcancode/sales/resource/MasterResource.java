/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vinhcancode.sales.entity.MasterEntity;
import com.vinhcancode.sales.service.PermissionService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
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
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 *
 * @author tbvin
 * @param <T>
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Authenticated                       // cần cookie JWT hợp lệ; muốn chỉ admin được ghi thì thêm @RolesAllowed("admin") lên POST/PUT/DELETE
public abstract class MasterResource<T extends MasterEntity> {

    @Inject protected EntityManager em;
    @Inject protected ObjectMapper mapper;
    @Inject protected PermissionService permissions;

    // --- mỗi danh mục khai báo ---
    protected abstract Class<T> type();
    protected abstract List<String> searchFields();                     // field dùng cho ô tìm kiếm q
    protected String module() { return "catalog"; }                     // khoá quyền tương ứng (RBAC)
    protected String codePrefix() { return null; }                      // "NCC" => tự sinh mã NCC0001 khi code trống
    protected boolean codeRequired() { return false; }                  // tài khoản kế toán bắt buộc nhập số hiệu
    protected String from() { return "from " + type().getSimpleName() + " e"; }
    protected Map<String, String> sortable() { return Map.of("code", "e.code", "name", "e.name"); }
    protected void applyFilters(MultivaluedMap<String, String> f, Where w) { }
    protected void normalize(T e) { }                                   // chuẩn hóa trước khi lưu

    // --- tiện ích điều kiện lọc ---
    public static class Where {
        final StringBuilder sql = new StringBuilder(" where 1=1");
        final Map<String, Object> params = new HashMap<>();
        public Where and(String cond) { sql.append(" and ").append(cond); return this; }
        public Where and(String cond, String name, Object value) { params.put(name, value); return and(cond); }
    }
    protected static String first(MultivaluedMap<String, String> f, String key) {
        String v = f.getFirst(key);
        return v == null || v.isBlank() ? null : v.trim();
    }

    protected void requirePermission(String action) {
        permissions.require(module(), action);
    }

    // ---------- GET list ----------
    @GET
    public Map<String, Object> list(@QueryParam("q") String q,
                                    @QueryParam("page") Integer page,
                                    @QueryParam("pageSize") Integer pageSize,
                                    @QueryParam("sort") String sort,
                                    @QueryParam("dir") @DefaultValue("asc") String dir,
                                    @Context UriInfo uri) {
        requirePermission("READ");
        // Frontend use() gọi GET không tham số để lấy TOÀN BỘ danh sách (đổ dropdown) => không phân trang.
        // Danh mục lớn (nhà cung cấp, vật tư…) hãy dùng useQuery có phân trang; ở đây chặn tối đa 10.000 dòng.
        boolean paged = page != null || pageSize != null;
        int pg = Math.max(1, page == null ? 1 : page);
        int size = Math.min(Math.max(1, pageSize == null ? 10 : pageSize), 100);

        Where w = new Where();
        if (q != null && !q.isBlank()) {
            String cond = searchFields().stream()
                    .map(f -> "lower(e." + f + ") like :q")
                    .collect(Collectors.joining(" or "));
            w.and("(" + cond + ")", "q", "%" + q.trim().toLowerCase() + "%");
        }
        applyFilters(uri.getQueryParameters(), w);

        // Chỉ cho sắp xếp theo field nằm trong danh sách trắng (chống JPQL injection)
        String path = sort == null ? null : sortable().get(sort);
        String order = (path == null ? " order by e.name asc" : " order by " + path + ("desc".equalsIgnoreCase(dir) ? " desc" : " asc"))
                + ", e.id asc";

        TypedQuery<T> query = em.createQuery("select e " + from() + w.sql + order, type());
        TypedQuery<Long> count = em.createQuery("select count(e) " + from() + w.sql, Long.class);
        w.params.forEach((k, v) -> { query.setParameter(k, v); count.setParameter(k, v); });

        List<T> items = (paged ? query.setFirstResult((pg - 1) * size).setMaxResults(size) : query.setMaxResults(10_000))
                .getResultList();
        return Map.of("items", items, "total", count.getSingleResult());
    }

    @GET @Path("/{id}")
    public T get(@PathParam("id") String id) {
        requirePermission("READ");
        T e = em.find(type(), id);
        if (e == null) throw new NotFoundException();
        return e;
    }

    // ---------- POST ----------
    @POST @Transactional
    public Response create(Map<String, Object> body) {
        requirePermission("CREATE");
        body.remove("id");
        T e = mapper.convertValue(body, type());
        validate(e);
        e.name = e.name.trim();
        e.code = blank(e.code) ? (codePrefix() != null ? nextCode(codePrefix()) : null) : e.code.trim();
        normalize(e);
        em.persist(e);
        flushOrConflict("Mã đã tồn tại hoặc dữ liệu không hợp lệ");   // đẩy xuống DB ngay để bắt lỗi unique => 409
        return Response.status(Response.Status.CREATED).entity(e).build();
    }

    @POST @Path("/import") @Transactional
    public Response importRows(List<Map<String, Object>> body) {
        requirePermission("IMPORT");
        if (body == null || body.isEmpty()) throw bad("Danh sách import rỗng");
        if (body.size() > 5_000) throw bad("Chỉ import tối đa 5000 dòng mỗi lần");
        int imported = 0;
        for (Map<String, Object> row : body) {
            row.remove("id");
            T e = mapper.convertValue(row, type());
            validate(e);
            e.name = e.name.trim();
            e.code = blank(e.code) ? (codePrefix() != null ? nextCode(codePrefix()) : null) : e.code.trim();
            normalize(e);
            em.persist(e);
            flushOrConflict("Dữ liệu import không hợp lệ hoặc bị trùng mã");
            imported++;
        }
        return Response.status(Response.Status.CREATED).entity(Map.of("imported", imported)).build();
    }

    // ---------- PUT ----------
    @PUT @Path("/{id}") @Transactional
    public T update(@PathParam("id") String id, Map<String, Object> body) {
        requirePermission("UPDATE");
        T e = em.find(type(), id);
        if (e == null) throw new NotFoundException();
        body.remove("id");
        try { mapper.updateValue(e, body); } catch (JsonMappingException ex) { throw new BadRequestException(ex.getMessage()); }
        validate(e);
        e.name = e.name.trim();
        e.code = blank(e.code) ? (codePrefix() != null ? nextCode(codePrefix()) : null) : e.code.trim();
        normalize(e);
        flushOrConflict("Mã đã tồn tại hoặc dữ liệu không hợp lệ");
        return e;
    }

    // ---------- DELETE ----------
    @DELETE @Path("/{id}") @Transactional
    public Response delete(@PathParam("id") String id) {
        requirePermission("DELETE");
        T e = em.find(type(), id);
        if (e == null) throw new NotFoundException();
        em.remove(e);
        flushOrConflict("Không thể xóa: bản ghi đang được sử dụng");   // vướng khóa ngoại (vd. loại vật tư đang có vật tư) => 409
        return Response.noContent().build();
    }

    // ---------- helper ----------
    protected void validate(T e) {
        if (blank(e.name)) throw bad("Tên không được để trống");
        if (codeRequired() && blank(e.code)) throw bad("Mã/số hiệu không được để trống");
    }
    protected static boolean blank(String s) { return s == null || s.isBlank(); }

    // Vi phạm unique / khóa ngoại chỉ nổ khi flush => flush chủ động để trả 409 kèm { "message": ... } thay vì 500
    protected void flushOrConflict(String msg) {
        try { em.flush(); }
        catch (PersistenceException ex) {
            throw new WebApplicationException(Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("message", msg)).type(MediaType.APPLICATION_JSON).build());
        }
    }
    protected static WebApplicationException bad(String msg) {
        return new WebApplicationException(Response.status(400).entity(Map.of("message", msg)).type(MediaType.APPLICATION_JSON).build());
    }
    // Mã tăng dần: NCC0001, NCC0002… (bỏ qua các mã tuỳ chỉnh có ký tự chữ/gạch ngang như NCC-HOAPHAT)
    protected String nextCode(String prefix) {
        List<String> codes = em.createQuery("select e.code from " + type().getSimpleName() + " e where e.code like :p", String.class)
                .setParameter("p", prefix + "%").getResultList();
        int n = 0;
        for (String c : codes) {
            if (c != null && c.startsWith(prefix)) {
                try {
                    int v = Integer.parseInt(c.substring(prefix.length()));
                    if (v > n) n = v;
                } catch (NumberFormatException ignored) { }
            }
        }
        return prefix + String.format("%04d", n + 1);
    }
}