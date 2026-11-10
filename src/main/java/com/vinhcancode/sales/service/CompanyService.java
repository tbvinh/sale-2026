package com.vinhcancode.sales.service;

import com.vinhcancode.sales.dto.CompanyRequest;
import com.vinhcancode.sales.entity.DmCongTy;
import com.vinhcancode.sales.entity.Role;
import com.vinhcancode.sales.entity.User;
import com.vinhcancode.sales.entity.UserCompany;
import com.vinhcancode.sales.entity.UserRole;
import com.vinhcancode.sales.tenant.TenantRegistry;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Quan ly danh muc cong ty, cap schema tenant va gan user/owner theo cong ty. */
@ApplicationScoped
public class CompanyService {

    private static final Pattern SCHEMA = Pattern.compile("[a-z][a-z0-9_]{1,62}");

    @Inject
    EntityManager em;

    @Inject
    TenantProvisioner provisioner;

    @Inject
    TenantRegistry registry;

    @Inject
    AdminService adminService;

    public List<DmCongTy> listActive() {
        return DmCongTy.list("status = ?1 order by name", "active");
    }

    /** Danh sach cong ty active ma user duoc phep truy cap. */
    public List<DmCongTy> listForUser(String username, boolean isSystemAdmin) {
        if (isSystemAdmin) {
            return listActive();
        }
        if (blank(username)) return Collections.emptyList();
        User user = User.findByUsername(username);
        if (user == null || !Boolean.TRUE.equals(user.active)) return Collections.emptyList();

        List<UserCompany> links = UserCompany.list("userId = ?1", user.id);
        Set<Long> allowedIds = new LinkedHashSet<>();
        for (UserCompany uc : links) {
            if (uc.companyId != null) allowedIds.add(uc.companyId);
        }
        if (user.defaultCompanyId != null) {
            allowedIds.add(user.defaultCompanyId);
        }
        if (allowedIds.isEmpty()) {
            return Collections.emptyList();
        }
        return DmCongTy.list("status = ?1 and id in ?2 order by name", "active", allowedIds);
    }

    public List<DmCongTy> listAll() {
        return DmCongTy.list("order by id");
    }

    public DmCongTy create(DmCongTy req) {
        if (req == null || blank(req.code)) throw bad("Mã công ty không được để trống");
        if (blank(req.name)) throw bad("Tên công ty không được để trống");
        validateInfo(req);

        String code = req.code.trim();
        if (code.length() > 50) throw bad("Mã công ty tối đa 50 ký tự");
        if (req.name.trim().length() > 150) throw bad("Tên công ty tối đa 150 ký tự");
        String status = blank(req.status) ? "active" : req.status.trim().toLowerCase(Locale.ROOT);
        if (!"active".equals(status) && !"inactive".equals(status)) throw bad("Trạng thái không hợp lệ");
        String schema = blank(req.schemaName) ? generateSchema(code) : req.schemaName.trim().toLowerCase(Locale.ROOT);
        validateSchema(schema);
        if (DmCongTy.findByCode(code) != null) throw conflict("Mã công ty đã tồn tại");
        if (DmCongTy.findBySchema(schema) != null) throw conflict("Schema tenant đã tồn tại");

        provisioner.createSchema(schema);
        try {
            provisioner.migrate(schema);
        } catch (RuntimeException e) {
            provisioner.dropSchema(schema);
            throw bad("Không thể khởi tạo schema tenant: " + e.getMessage());
        }

        DmCongTy company = new DmCongTy();
        company.code = code;
        company.name = req.name.trim();
        company.address = clean(req.address);
        company.taxCode = clean(req.taxCode);
        company.phone = clean(req.phone);
        company.schemaName = schema;
        company.status = status;
        company.createdAt = LocalDateTime.now();
        try {
            QuarkusTransaction.requiringNew().run(() -> {
                company.persist();
                em.flush();
            });
        } catch (RuntimeException e) {
            provisioner.dropSchema(schema);
            throw conflict("Không thể lưu công ty: " + e.getMessage());
        }
        registry.refresh();
        return company;
    }

    public DmCongTy createWithUsers(CompanyRequest req) {
        if (req == null) throw bad("Dữ liệu không hợp lệ");
        DmCongTy company = create(req.toEntity());
        QuarkusTransaction.requiringNew().run(() -> syncCompanyUsers(company, req, true));
        registry.refresh();
        return company;
    }

    @Transactional
    public DmCongTy update(Long id, DmCongTy req) {
        DmCongTy company = find(id);
        if (req == null) throw bad("Dữ liệu không hợp lệ");
        validateInfo(req);
        if (!blank(req.name)) company.name = req.name.trim();
        if (req.address != null) company.address = clean(req.address);
        if (req.taxCode != null) company.taxCode = clean(req.taxCode);
        if (req.phone != null) company.phone = clean(req.phone);
        if (!blank(req.status)) {
            String status = req.status.trim().toLowerCase(Locale.ROOT);
            if (!"active".equals(status) && !"inactive".equals(status)) throw bad("Trạng thái không hợp lệ");
            company.status = status;
        }
        registry.refresh();
        return company;
    }

    @Transactional
    public DmCongTy updateWithUsers(Long id, CompanyRequest req) {
        if (req == null) throw bad("Dữ liệu không hợp lệ");
        DmCongTy company = update(id, req.toEntity());
        syncCompanyUsers(company, req, false);
        registry.refresh();
        return company;
    }

    public void syncCompanyUsers(DmCongTy company, CompanyRequest req, boolean isNew) {
        Role ownerRole = adminService.ensureCompanyAdminRole();
        Long ownerUserId = req.ownerUserId;

        boolean shouldAutoCreate = req.autoCreateOwner != null ? req.autoCreateOwner : (isNew && ownerUserId == null);
        if (shouldAutoCreate) {
            String username = !blank(req.ownerUsername)
                    ? req.ownerUsername.trim()
                    : AdminService.defaultOwnerUsername(company.code);
            String password = !blank(req.ownerPassword) ? req.ownerPassword : "123456";
            String fullName = !blank(req.ownerFullName)
                    ? req.ownerFullName.trim()
                    : ("Chủ sở hữu - " + company.name);

            User existing = User.findByUsername(username);
            if (existing == null) {
                User owner = new User();
                owner.username = username;
                owner.password = BcryptUtil.bcryptHash(password);
                owner.fullName = fullName;
                owner.role = ownerRole.code.toLowerCase(Locale.ROOT);
                owner.active = true;
                owner.allowPublic = false;
                owner.defaultCompanyId = company.id;
                owner.persist();
                em.flush();

                UserRole ur = new UserRole();
                ur.userId = owner.id;
                ur.roleId = ownerRole.id;
                ur.persist();
                ownerUserId = owner.id;
            } else {
                ownerUserId = existing.id;
                if (existing.defaultCompanyId == null) {
                    existing.defaultCompanyId = company.id;
                }
            }
        }

        if (req.userIds != null || ownerUserId != null) {
            Set<Long> targetUserIds = new LinkedHashSet<>();
            if (req.userIds != null) {
                for (Long uid : req.userIds) {
                    if (uid != null) targetUserIds.add(uid);
                }
            } else {
                List<UserCompany> current = UserCompany.list("companyId = ?1", company.id);
                for (UserCompany uc : current) {
                    targetUserIds.add(uc.userId);
                }
            }
            if (ownerUserId != null) {
                targetUserIds.add(ownerUserId);
            }

            UserCompany.delete("companyId", company.id);
            em.flush();

            for (Long uid : targetUserIds) {
                User u = em.find(User.class, uid);
                if (u == null) continue;
                boolean isOwner = ownerUserId != null && ownerUserId.equals(uid);
                UserCompany uc = new UserCompany();
                uc.userId = uid;
                uc.companyId = company.id;
                uc.isOwner = isOwner;
                uc.persist();

                if (isOwner || u.defaultCompanyId == null) {
                    u.defaultCompanyId = company.id;
                }
            }
            em.flush();
        }
    }

    /** Tra ve map companyId -> danh sach user duoc gan (kem thong tin owner). */
    public Map<Long, List<Map<String, Object>>> mapUsersByCompany() {
        Map<Long, User> userMap = new HashMap<>();
        for (User u : User.<User>listAll()) {
            userMap.put(u.id, u);
        }
        List<UserCompany> links = UserCompany.list("order by isOwner desc, userId asc");
        Map<Long, List<Map<String, Object>>> result = new HashMap<>();
        for (UserCompany uc : links) {
            User u = userMap.get(uc.userId);
            if (u == null) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", u.id);
            item.put("username", u.username);
            item.put("fullName", u.fullName);
            item.put("role", u.role);
            item.put("isOwner", Boolean.TRUE.equals(uc.isOwner));
            result.computeIfAbsent(uc.companyId, k -> new ArrayList<>()).add(item);
        }
        return result;
    }

    public void delete(Long id) {
        DmCongTy company = find(id);
        if ("public".equalsIgnoreCase(company.schemaName)) throw bad("Không thể xóa schema public");
        provisioner.dropSchema(company.schemaName);
        QuarkusTransaction.requiringNew().run(() -> {
            UserCompany.delete("companyId", id);
            em.createQuery("update User u set u.defaultCompanyId = null where u.defaultCompanyId = :cid")
                    .setParameter("cid", id)
                    .executeUpdate();
            DmCongTy.deleteById(id);
        });
        registry.refresh();
    }

    private DmCongTy find(Long id) {
        DmCongTy company = em.find(DmCongTy.class, id);
        if (company == null) throw notFound("Không tìm thấy công ty");
        return company;
    }

    public static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String clean(String value) {
        return blank(value) ? null : value.trim();
    }

    private static void validateInfo(DmCongTy req) {
        if (req.address != null && req.address.trim().length() > 500) throw bad("Địa chỉ tối đa 500 ký tự");
        if (req.taxCode != null && req.taxCode.trim().length() > 50) throw bad("Mã số thuế tối đa 50 ký tự");
        if (req.phone != null && req.phone.trim().length() > 50) throw bad("Điện thoại tối đa 50 ký tự");
    }

    private static void validateSchema(String schema) {
        if (schema == null || "public".equalsIgnoreCase(schema) || !SCHEMA.matcher(schema).matches()) {
            throw bad("Schema tenant không hợp lệ (chữ thường, số, _; không dùng public)");
        }
    }

    private static String generateSchema(String code) {
        String base = code.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (base.isBlank()) base = "company";
        String schema = "tenant_" + base;
        return schema.length() > 63 ? schema.substring(0, 63) : schema;
    }

    private static WebApplicationException bad(String message) {
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("message", message)).type(MediaType.APPLICATION_JSON).build());
    }

    private static WebApplicationException conflict(String message) {
        return new WebApplicationException(Response.status(Response.Status.CONFLICT)
                .entity(Map.of("message", message)).type(MediaType.APPLICATION_JSON).build());
    }

    private static WebApplicationException notFound(String message) {
        return new WebApplicationException(Response.status(Response.Status.NOT_FOUND)
                .entity(Map.of("message", message)).type(MediaType.APPLICATION_JSON).build());
    }
}
