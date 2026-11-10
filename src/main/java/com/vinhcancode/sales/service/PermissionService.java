package com.vinhcancode.sales.service;

import com.vinhcancode.sales.entity.Permission;
import com.vinhcancode.sales.entity.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Kiem tra quyen chi tiet (module + action) cua nguoi dung dang dang nhap.
 * - Vai tro admin va company_admin (Owner) luon co day du quyen nghiep vu trong pham vi cong ty duoc phep.
 * - Sub-user co custom_permissions = true se kiem tra tren bang user_permissions cua rieng user do.
 */
@ApplicationScoped
public class PermissionService {

    @Inject
    JsonWebToken jwt;

    @Inject
    EntityManager em;

    public boolean isAdmin() {
        Set<String> groups = jwt.getGroups();
        return groups != null && groups.contains("admin");
    }

    public boolean isCompanyAdmin() {
        Set<String> groups = jwt.getGroups();
        return groups != null && groups.contains(AdminService.ROLE_COMPANY_ADMIN);
    }

    public Set<String> rolesOf(String username) {
        if (username == null || username.isBlank()) return Set.of();
        List<String> codes = em.createQuery(
                        "select r.code from UserRole ur, Role r where ur.userId = "
                                + "(select u.id from User u where u.username = :username) and r.id = ur.roleId",
                        String.class)
                .setParameter("username", username)
                .getResultList();
        Set<String> roles = new LinkedHashSet<>();
        codes.forEach(c -> roles.add(c == null ? "" : c.toLowerCase(Locale.ROOT)));
        roles.remove("");
        return roles;
    }

    public boolean has(String module, String action) {
        if (isAdmin() || isCompanyAdmin()) return true;
        String username = jwt.getName();
        if (username == null || username.isBlank()) return false;
        User user = User.findByUsername(username);
        if (user == null || Boolean.FALSE.equals(user.active)) return false;
        if ("admin".equalsIgnoreCase(user.role) || AdminService.ROLE_COMPANY_ADMIN.equalsIgnoreCase(user.role)) {
            return true;
        }
        if (Boolean.TRUE.equals(user.customPermissions)) {
            Long count = em.createQuery(
                            "select count(up) from UserPermission up, Permission p "
                                    + "where up.userId = :userId and p.id = up.permissionId "
                                    + "and lower(p.module) = :module and upper(p.action) = :action",
                            Long.class)
                    .setParameter("userId", user.id)
                    .setParameter("module", module.toLowerCase(Locale.ROOT))
                    .setParameter("action", action.toUpperCase(Locale.ROOT))
                    .getSingleResult();
            return count != null && count > 0;
        }
        Long count = em.createQuery(
                        "select count(rp) from RolePermission rp, UserRole ur, Permission p "
                                + "where ur.userId = :userId "
                                + "and rp.roleId = ur.roleId and p.id = rp.permissionId "
                                + "and lower(p.module) = :module and upper(p.action) = :action",
                        Long.class)
                .setParameter("userId", user.id)
                .setParameter("module", module.toLowerCase(Locale.ROOT))
                .setParameter("action", action.toUpperCase(Locale.ROOT))
                .getSingleResult();
        return count != null && count > 0;
    }

    public void require(String module, String action) {
        if (!has(module, action)) {
            throw new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                    .entity(Map.of("message", "Bạn không có quyền " + action + " trên " + module))
                    .type(MediaType.APPLICATION_JSON)
                    .build());
        }
    }

    /** Ma tran quyen hieu luc cua mot nguoi dung: module -> action (chu thuong) -> boolean. */
    public Map<String, Map<String, Boolean>> effective(String username, boolean admin) {
        List<Permission> all = Permission.list("order by module, action");
        User user = username != null && !username.isBlank() ? User.findByUsername(username) : null;
        boolean fullAccess = admin
                || (user != null && ("admin".equalsIgnoreCase(user.role)
                || AdminService.ROLE_COMPANY_ADMIN.equalsIgnoreCase(user.role)));

        Set<String> granted = new LinkedHashSet<>();
        if (!fullAccess && user != null) {
            List<Object[]> rows;
            if (Boolean.TRUE.equals(user.customPermissions)) {
                rows = em.createQuery(
                                "select p.module, p.action from UserPermission up, Permission p "
                                        + "where up.userId = :userId and p.id = up.permissionId",
                                Object[].class)
                        .setParameter("userId", user.id)
                        .getResultList();
            } else {
                rows = em.createQuery(
                                "select p.module, p.action from RolePermission rp, UserRole ur, Permission p "
                                        + "where ur.userId = :userId "
                                        + "and rp.roleId = ur.roleId and p.id = rp.permissionId",
                                Object[].class)
                        .setParameter("userId", user.id)
                        .getResultList();
            }
            for (Object[] row : rows) {
                granted.add(row[0] + "|" + row[1]);
            }
        }

        Map<String, Map<String, Boolean>> matrix = new LinkedHashMap<>();
        for (Permission p : all) {
            String module = p.module == null ? "" : p.module.toLowerCase(Locale.ROOT);
            String action = p.action == null ? "" : p.action.toLowerCase(Locale.ROOT);
            matrix.computeIfAbsent(module, k -> new LinkedHashMap<>())
                    .put(action, fullAccess || granted.contains(p.module + "|" + p.action));
        }
        return matrix;
    }

    /** Danh sach role cua user (dung cho JWT groups). */
    public List<String> groupRoles(String username, String fallbackRole) {
        Set<String> roles = rolesOf(username);
        List<String> groups = new ArrayList<>();
        groups.add("user");
        if (roles.contains("admin")) groups.add("admin");
        roles.stream().filter(r -> !"admin".equals(r) && !"user".equals(r)).forEach(groups::add);
        if (roles.isEmpty() && fallbackRole != null && !fallbackRole.isBlank()) {
            String r = fallbackRole.trim().toLowerCase(Locale.ROOT).replaceFirst("^role_", "");
            if ("admin".equals(r)) groups.add("admin");
            else if (!"user".equals(r)) groups.add(r);
        }
        return groups;
    }
}
