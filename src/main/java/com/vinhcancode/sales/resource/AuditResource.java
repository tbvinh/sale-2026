package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.AuditLog;
import com.vinhcancode.sales.service.PermissionService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Path("/admin/audit-logs")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class AuditResource {

    @Inject
    EntityManager em;

    @Inject
    PermissionService permissions;

    @GET
    public Map<String, Object> list(@QueryParam("q") String q,
                                    @QueryParam("module") String module,
                                    @QueryParam("username") String username,
                                    @QueryParam("page") @DefaultValue("1") int page,
                                    @QueryParam("pageSize") @DefaultValue("20") int pageSize) {
        if (!permissions.isAdmin() && !permissions.isCompanyAdmin() && !permissions.has("admin", "READ")) {
            throw new jakarta.ws.rs.ForbiddenException("Bạn không có quyền xem nhật ký hoạt động");
        }

        int pg = Math.max(1, page);
        int size = Math.min(Math.max(1, pageSize), 100);

        StringBuilder where = new StringBuilder(" where 1=1");
        Map<String, Object> params = new HashMap<>();

        if (module != null && !module.isBlank() && !"all".equalsIgnoreCase(module)) {
            where.append(" and lower(a.module) = :module");
            params.put("module", module.trim().toLowerCase());
        }

        if (username != null && !username.isBlank()) {
            where.append(" and lower(a.username) like :user");
            params.put("user", "%" + username.trim().toLowerCase() + "%");
        }

        if (q != null && !q.isBlank()) {
            where.append(" and (lower(a.description) like :q or lower(a.targetId) like :q or lower(a.action) like :q)");
            params.put("q", "%" + q.trim().toLowerCase() + "%");
        }

        TypedQuery<AuditLog> query = em.createQuery(
                "select a from AuditLog a" + where + " order by a.createdAt desc, a.id desc", AuditLog.class);
        TypedQuery<Long> countQuery = em.createQuery(
                "select count(a) from AuditLog a" + where, Long.class);

        params.forEach((k, v) -> {
            query.setParameter(k, v);
            countQuery.setParameter(k, v);
        });

        List<AuditLog> items = query.setFirstResult((pg - 1) * size).setMaxResults(size).getResultList();
        long total = countQuery.getSingleResult();

        return Map.of("items", items, "total", total, "page", pg, "pageSize", size);
    }
}
