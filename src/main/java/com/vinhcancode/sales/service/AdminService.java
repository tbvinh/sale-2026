package com.vinhcancode.sales.service;

import com.vinhcancode.sales.dto.UserRequest;
import com.vinhcancode.sales.entity.DmCongTy;
import com.vinhcancode.sales.entity.Permission;
import com.vinhcancode.sales.entity.Role;
import com.vinhcancode.sales.entity.RolePermission;
import com.vinhcancode.sales.entity.User;
import com.vinhcancode.sales.entity.UserCompany;
import com.vinhcancode.sales.entity.UserPermission;
import com.vinhcancode.sales.entity.UserRole;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Nghiep vu quan tri: nguoi dung, sub-user cua Owner, vai tro, phan quyen cong ty (tenant) va ma tran phan quyen chi tiet.
 */
@ApplicationScoped
public class AdminService {

    public static final String ROLE_COMPANY_ADMIN = "company_admin";

    @Inject
    EntityManager em;

    @Inject
    PermissionService permissionService;

    // ---------- Nguoi dung ----------

    public Map<String, Object> listUsers(String q, String role, Integer page, Integer pageSize) {
        return listUsers(q, role, page, pageSize, null, true);
    }

    public Map<String, Object> listUsers(String q, String role, Integer page, Integer pageSize,
                                         String actorUsername, boolean isSystemAdmin) {
        StringBuilder where = new StringBuilder("1=1");
        Map<String, Object> params = new HashMap<>();

        if (!isSystemAdmin) {
            User actor = requireOwnerActor(actorUsername);
            Set<Long> ownerCids = getOwnerCompanyIds(actor);
            where.append(" and lower(coalesce(role, '')) <> 'admin'");
            where.append(" and (id = :actorId or createdByUserId = :actorId "
                    + "or id in (select uc.userId from UserCompany uc where uc.companyId in :ownerCids))");
            params.put("actorId", actor.id);
            params.put("ownerCids", ownerCids);
        }

        if (q != null && !q.isBlank()) {
            where.append(" and (lower(username) like :q or lower(coalesce(fullName, '')) like :q)");
            params.put("q", "%" + q.trim().toLowerCase(Locale.ROOT) + "%");
        }
        if (role != null && !role.isBlank()) {
            where.append(" and lower(role) = :role");
            params.put("role", role.trim().toLowerCase(Locale.ROOT));
        }
        PanacheQuery<User> query = User.find(where + " order by username", params);
        long total = query.count();
        List<User> items;
        if (page == null && pageSize == null) {
            items = query.list();
        } else {
            int pg = Math.max(1, page == null ? 1 : page);
            int size = Math.min(Math.max(1, pageSize == null ? 20 : pageSize), 100);
            items = query.page(pg - 1, size).list();
        }
        populateUserCompanies(items);
        return Map.of("items", items, "total", total);
    }

    public User getUser(Long id) {
        return getUser(id, null, true);
    }

    public User getUser(Long id, String actorUsername, boolean isSystemAdmin) {
        User user = em.find(User.class, id);
        if (user == null) throw notFound("Không tìm thấy người dùng");
        populateUserCompanies(List.of(user));
        if (!isSystemAdmin) {
            User actor = requireOwnerActor(actorUsername);
            Set<Long> ownerCids = getOwnerCompanyIds(actor);
            if (!canOwnerManageUser(actor, ownerCids, user)) {
                throw forbidden("Bạn không có quyền xem hoặc quản lý người dùng này");
            }
        }
        return user;
    }

    @Transactional
    public User createUser(UserRequest req) {
        return createUser(req, null, true);
    }

    @Transactional
    public User createUser(UserRequest req, String actorUsername, boolean isSystemAdmin) {
        if (req == null || blank(req.username)) throw bad("Tên đăng nhập không được để trống");
        if (blank(req.password)) throw bad("Mật khẩu không được để trống");

        ensureCompanyAdminRole();
        String rawUsername = req.username.trim();
        List<Long> targetCompanyIds = req.companyIds;
        List<Long> targetOwnerIds = req.ownerCompanyIds;
        Long targetDefaultCoId = req.defaultCompanyId;
        String targetRoleCode = blank(req.role) ? "user" : req.role.trim();
        boolean targetAllowPublic = Boolean.TRUE.equals(req.allowPublic);
        Long createdByUserId = null;

        if (!isSystemAdmin) {
            User actor = requireOwnerActor(actorUsername);
            Set<Long> ownerCids = getOwnerCompanyIds(actor);
            createdByUserId = actor.id;
            targetRoleCode = "user";
            targetAllowPublic = false;
            targetOwnerIds = Collections.emptyList();

            List<Long> filteredCids = new ArrayList<>();
            if (req.companyIds != null) {
                for (Long cid : req.companyIds) {
                    if (cid != null && ownerCids.contains(cid)) {
                        filteredCids.add(cid);
                    }
                }
            }
            if (filteredCids.isEmpty()) {
                if (req.defaultCompanyId != null && ownerCids.contains(req.defaultCompanyId)) {
                    filteredCids.add(req.defaultCompanyId);
                } else {
                    filteredCids.add(ownerCids.iterator().next());
                }
            }
            targetCompanyIds = filteredCids;
            targetDefaultCoId = (req.defaultCompanyId != null && filteredCids.contains(req.defaultCompanyId))
                    ? req.defaultCompanyId
                    : filteredCids.get(0);

            DmCongTy primaryCo = em.find(DmCongTy.class, targetDefaultCoId);
            rawUsername = ensureCompanyPrefix(rawUsername, primaryCo != null ? primaryCo.code : null);
        }

        if (User.findByUsername(rawUsername) != null) {
            throw conflict("Tên đăng nhập '" + rawUsername + "' đã tồn tại");
        }

        Role role = roleOrThrow(targetRoleCode);
        boolean isAdminRole = "admin".equalsIgnoreCase(role.code);

        User user = new User();
        user.username = rawUsername;
        user.password = BcryptUtil.bcryptHash(req.password);
        user.fullName = blank(req.fullName) ? null : req.fullName.trim();
        user.imageUrl = blank(req.imageUrl) ? null : req.imageUrl.trim();
        user.role = role.code.toLowerCase(Locale.ROOT);
        user.active = req.active == null ? Boolean.TRUE : req.active;
        user.allowPublic = isAdminRole || targetAllowPublic;
        user.createdByUserId = createdByUserId;
        user.persist();
        em.flush();

        writeRole(user.id, role.id);
        writeUserCompanies(user, targetCompanyIds, targetOwnerIds, targetDefaultCoId);
        if (req.permissions != null && !isAdminRole && !ROLE_COMPANY_ADMIN.equalsIgnoreCase(role.code)) {
            writeUserPermissions(user, req.permissions);
        }
        em.flush();
        populateUserCompanies(List.of(user));
        return user;
    }

    @Transactional
    public User updateUser(Long id, UserRequest req, String actor) {
        return updateUser(id, req, actor, true);
    }

    @Transactional
    public User updateUser(Long id, UserRequest req, String actorUsername, boolean isSystemAdmin) {
        User user = em.find(User.class, id);
        if (user == null) throw notFound("Không tìm thấy người dùng");
        if (req == null) throw bad("Dữ liệu không hợp lệ");
        ensureCompanyAdminRole();
        populateUserCompanies(List.of(user));

        if (!isSystemAdmin) {
            User actor = requireOwnerActor(actorUsername);
            Set<Long> ownerCids = getOwnerCompanyIds(actor);
            if (!canOwnerManageUser(actor, ownerCids, user)) {
                throw forbidden("Bạn không có quyền chỉnh sửa người dùng này");
            }
            boolean isSelf = actor.id.equals(user.id);
            if (!isSelf && ("admin".equalsIgnoreCase(user.role) || ROLE_COMPANY_ADMIN.equalsIgnoreCase(user.role))) {
                throw forbidden("Không thể chỉnh sửa tài khoản Chủ sở hữu hoặc Quản trị viên khác");
            }

            if (!blank(req.password)) user.password = BcryptUtil.bcryptHash(req.password);
            if (req.fullName != null) user.fullName = blank(req.fullName) ? null : req.fullName.trim();
            if (req.imageUrl != null) user.imageUrl = blank(req.imageUrl) ? null : req.imageUrl.trim();

            if (!isSelf) {
                if (req.active != null) user.active = req.active;
                user.allowPublic = false;
                List<Long> allowedForSub = new ArrayList<>();
                if (req.companyIds != null) {
                    for (Long cid : req.companyIds) {
                        if (cid != null && ownerCids.contains(cid)) allowedForSub.add(cid);
                    }
                    if (allowedForSub.isEmpty()) {
                        allowedForSub.add(ownerCids.iterator().next());
                    }
                    writeUserCompanies(user, allowedForSub, Collections.emptyList(), req.defaultCompanyId);
                }
                if (!blank(req.username)) {
                    Long primaryCid = user.defaultCompanyId != null ? user.defaultCompanyId : ownerCids.iterator().next();
                    DmCongTy primaryCo = em.find(DmCongTy.class, primaryCid);
                    String nextUsername = ensureCompanyPrefix(req.username, primaryCo != null ? primaryCo.code : null);
                    applyUsernameChange(user, nextUsername);
                }
                if (req.permissions != null) {
                    writeUserPermissions(user, req.permissions);
                }
            } else if (!blank(req.username)) {
                applyUsernameChange(user, req.username.trim());
            }
            flushOrConflict("Không thể cập nhật người dùng");
            populateUserCompanies(List.of(user));
            return user;
        }

        Role role = roleOrThrow(blank(req.role) ? user.role : req.role);
        boolean active = req.active == null ? !Boolean.FALSE.equals(user.active) : req.active;
        boolean wasAdmin = isAdmin(user);
        boolean willAdmin = "admin".equalsIgnoreCase(role.code);

        if (wasAdmin && (!willAdmin || !active) && countActiveAdmins() <= 1) {
            throw bad("Phải còn ít nhất một quản trị viên đang hoạt động");
        }
        if (actorUsername != null && actorUsername.equalsIgnoreCase(user.username) && (!willAdmin || !active)) {
            throw bad("Không thể tự khóa hoặc hạ quyền chính mình");
        }

        if (!blank(req.username)) {
            applyUsernameChange(user, req.username.trim());
        }
        if (!blank(req.password)) user.password = BcryptUtil.bcryptHash(req.password);
        if (req.fullName != null) user.fullName = blank(req.fullName) ? null : req.fullName.trim();
        if (req.imageUrl != null) user.imageUrl = blank(req.imageUrl) ? null : req.imageUrl.trim();
        user.role = role.code.toLowerCase(Locale.ROOT);
        user.active = active;
        if (willAdmin) {
            user.allowPublic = true;
        } else if (req.allowPublic != null) {
            user.allowPublic = req.allowPublic;
        }
        writeRole(user.id, role.id);
        if (req.companyIds != null || req.ownerCompanyIds != null || req.defaultCompanyId != null) {
            writeUserCompanies(user, req.companyIds, req.ownerCompanyIds, req.defaultCompanyId);
        }
        if (req.permissions != null && !willAdmin && !ROLE_COMPANY_ADMIN.equalsIgnoreCase(role.code)) {
            writeUserPermissions(user, req.permissions);
        } else if (Boolean.FALSE.equals(req.customPermissions)) {
            UserPermission.delete("userId", user.id);
            user.customPermissions = false;
        }
        flushOrConflict("Không thể cập nhật người dùng");
        populateUserCompanies(List.of(user));
        return user;
    }

    @Transactional
    public void deleteUser(Long id, String actor) {
        deleteUser(id, actor, true);
    }

    @Transactional
    public void deleteUser(Long id, String actorUsername, boolean isSystemAdmin) {
        User user = getUser(id, actorUsername, isSystemAdmin);
        if (actorUsername != null && actorUsername.equalsIgnoreCase(user.username)) {
            throw bad("Không thể xóa chính mình");
        }
        if (!isSystemAdmin) {
            if ("admin".equalsIgnoreCase(user.role) || ROLE_COMPANY_ADMIN.equalsIgnoreCase(user.role)) {
                throw forbidden("Không thể xóa tài khoản Chủ sở hữu hoặc Quản trị viên");
            }
        }
        if (isAdmin(user) && countActiveAdmins() <= 1) throw bad("Không thể xóa quản trị viên cuối cùng");
        UserPermission.delete("userId", user.id);
        UserCompany.delete("userId", user.id);
        UserRole.delete("userId", user.id);
        em.remove(user);
        flushOrConflict("Không thể xóa người dùng");
    }

    // ---------- Phan quyen User <-> Cong ty (Tenant & Owner) & Sub-user ----------

    private User requireOwnerActor(String actorUsername) {
        if (blank(actorUsername)) throw forbidden("Chưa xác thực người dùng");
        User actor = User.findByUsername(actorUsername);
        if (actor == null || Boolean.FALSE.equals(actor.active)) {
            throw forbidden("Tài khoản không hợp lệ");
        }
        populateUserCompanies(List.of(actor));
        return actor;
    }

    private Set<Long> getOwnerCompanyIds(User actor) {
        Set<Long> cids = new LinkedHashSet<>();
        if (actor.ownerCompanyIds != null) cids.addAll(actor.ownerCompanyIds);
        if (cids.isEmpty() && actor.companyIds != null) cids.addAll(actor.companyIds);
        if (cids.isEmpty() && actor.defaultCompanyId != null) cids.add(actor.defaultCompanyId);
        if (cids.isEmpty()) {
            throw forbidden("Tài khoản của bạn chưa được gán làm Chủ sở hữu công ty nào");
        }
        return cids;
    }

    private boolean canOwnerManageUser(User actor, Set<Long> ownerCids, User target) {
        if (target == null) return false;
        if (actor.id.equals(target.id)) return true;
        if ("admin".equalsIgnoreCase(target.role)) return false;
        if (actor.id.equals(target.createdByUserId)) return true;
        if (target.companyIds != null) {
            for (Long cid : target.companyIds) {
                if (ownerCids.contains(cid)) return true;
            }
        }
        return false;
    }

    /** Dam bao ten dang nhap cua sub-user luon co tien to <ma_cong_ty>_ de khong trung giua cac Owner. */
    public static String ensureCompanyPrefix(String rawUsername, String companyCode) {
        String cleanUser = rawUsername == null ? "" : rawUsername.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9._-]+", "_")
                .replaceAll("^_+|_+$", "");
        if (cleanUser.isEmpty()) cleanUser = "user1";
        if (companyCode == null || companyCode.isBlank()) return cleanUser;
        String prefix = companyCode.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (prefix.isEmpty()) return cleanUser;
        String fullPrefix = prefix + "_";
        if (cleanUser.startsWith(fullPrefix)) {
            return cleanUser;
        }
        return fullPrefix + cleanUser;
    }

    private void applyUsernameChange(User user, String nextUsername) {
        if (blank(nextUsername)) throw bad("Tên đăng nhập không được để trống");
        String trimmed = nextUsername.trim();
        if (trimmed.equals(user.username)) return;
        if ("admin".equalsIgnoreCase(user.username) && !"admin".equalsIgnoreCase(trimmed)) {
            throw bad("Không được đổi tên đăng nhập của tài khoản quản trị gốc (admin)");
        }
        User existing = User.find("lower(username) = ?1 and id <> ?2",
                trimmed.toLowerCase(Locale.ROOT), user.id).firstResult();
        if (existing != null) {
            throw conflict("Tên đăng nhập '" + trimmed + "' đã tồn tại");
        }
        user.username = trimmed;
    }

    private void writeUserPermissions(User user, Map<String, Map<String, Boolean>> matrix) {
        UserPermission.delete("userId", user.id);
        em.flush();
        user.customPermissions = true;
        if (matrix == null) return;
        for (Map.Entry<String, Map<String, Boolean>> modEntry : matrix.entrySet()) {
            if (modEntry.getValue() == null) continue;
            for (Map.Entry<String, Boolean> actEntry : modEntry.getValue().entrySet()) {
                if (!Boolean.TRUE.equals(actEntry.getValue())) continue;
                Permission perm = Permission.findOne(modEntry.getKey(), actEntry.getKey());
                if (perm == null) continue;
                UserPermission up = new UserPermission();
                up.userId = user.id;
                up.permissionId = perm.id;
                up.persist();
            }
        }
    }

    public void populateUserCompanies(List<User> users) {
        if (users == null || users.isEmpty()) return;
        Map<Long, DmCongTy> companyMap = new LinkedHashMap<>();
        for (DmCongTy c : DmCongTy.<DmCongTy>list("order by id")) {
            companyMap.put(c.id, c);
        }
        List<Long> userIds = new ArrayList<>();
        for (User u : users) {
            if (u.id != null) userIds.add(u.id);
            u.companyIds = new ArrayList<>();
            u.ownerCompanyIds = new ArrayList<>();
            u.companies = new ArrayList<>();
            if (u.allowPublic == null) {
                u.allowPublic = "admin".equalsIgnoreCase(u.role);
            }
            if (u.customPermissions == null) {
                u.customPermissions = false;
            }
        }
        if (userIds.isEmpty()) return;

        List<UserCompany> links = UserCompany.list("userId in ?1 order by isOwner desc, companyId asc", userIds);
        Map<Long, List<UserCompany>> byUser = new HashMap<>();
        for (UserCompany uc : links) {
            byUser.computeIfAbsent(uc.userId, k -> new ArrayList<>()).add(uc);
        }
        for (User u : users) {
            List<UserCompany> uLinks = byUser.getOrDefault(u.id, Collections.emptyList());
            for (UserCompany uc : uLinks) {
                DmCongTy c = companyMap.get(uc.companyId);
                if (c == null) continue;
                u.companyIds.add(c.id);
                if (Boolean.TRUE.equals(uc.isOwner)) {
                    u.ownerCompanyIds.add(c.id);
                }
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", c.id);
                item.put("code", c.code);
                item.put("name", c.name);
                item.put("schemaName", c.schemaName);
                item.put("isOwner", Boolean.TRUE.equals(uc.isOwner));
                u.companies.add(item);
            }
            u.permissions = permissionService.effective(u.username, "admin".equalsIgnoreCase(u.role));
        }
    }

    private void writeUserCompanies(User user, List<Long> companyIds, List<Long> ownerCompanyIds, Long defaultCompanyId) {
        Set<Long> owners = new LinkedHashSet<>();
        if (ownerCompanyIds != null) {
            for (Long cid : ownerCompanyIds) {
                if (cid != null) owners.add(cid);
            }
        }
        Set<Long> allIds = new LinkedHashSet<>();
        if (companyIds != null) {
            for (Long cid : companyIds) {
                if (cid != null) allIds.add(cid);
            }
        }
        allIds.addAll(owners);

        UserCompany.delete("userId", user.id);
        em.flush();

        for (Long cid : allIds) {
            if (em.find(DmCongTy.class, cid) == null) continue;
            UserCompany uc = new UserCompany();
            uc.userId = user.id;
            uc.companyId = cid;
            uc.isOwner = owners.contains(cid);
            uc.persist();
        }

        if (defaultCompanyId != null && allIds.contains(defaultCompanyId)) {
            user.defaultCompanyId = defaultCompanyId;
        } else if (!owners.isEmpty()) {
            user.defaultCompanyId = owners.iterator().next();
        } else if (!allIds.isEmpty()) {
            user.defaultCompanyId = allIds.iterator().next();
        } else {
            user.defaultCompanyId = null;
        }
    }

    /** Dam bao vai tro company_admin (Chu so huu cong ty / Owner) ton tai va co du quyen nghiep vu. */
    @Transactional
    public Role ensureCompanyAdminRole() {
        Role role = Role.findByCode(ROLE_COMPANY_ADMIN);
        if (role == null) {
            role = new Role();
            role.code = ROLE_COMPANY_ADMIN;
            role.name = "Chủ sở hữu công ty (Owner)";
            role.description = "Toàn quyền nghiệp vụ kế toán trong các công ty được phân quyền";
            role.persist();
            em.flush();
        }
        long permCount = RolePermission.count("roleId", role.id);
        if (permCount == 0) {
            List<Permission> allPerms = Permission.listAll();
            for (Permission p : allPerms) {
                RolePermission rp = new RolePermission();
                rp.roleId = role.id;
                rp.permissionId = p.id;
                rp.persist();
            }
            em.flush();
        }
        return role;
    }

    public static String defaultOwnerUsername(String companyCode) {
        if (companyCode == null || companyCode.isBlank()) return "user_company";
        String slug = companyCode.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (slug.isBlank()) slug = "company";
        return slug.startsWith("user_") ? slug : "user_" + slug;
    }

    // ---------- Vai tro ----------

    public List<Map<String, Object>> listRoles() {
        return listRoles(true);
    }

    public List<Map<String, Object>> listRoles(boolean isSystemAdmin) {
        ensureCompanyAdminRole();
        List<Map<String, Object>> items = new ArrayList<>();
        for (Role role : Role.<Role>list("order by id")) {
            if (!isSystemAdmin && "admin".equalsIgnoreCase(role.code)) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", role.id);
            row.put("code", role.code);
            row.put("name", role.name);
            row.put("description", role.description);
            row.put("builtin", isBuiltin(role.code));
            row.put("userCount", UserRole.count("roleId", role.id));
            row.put("permissionCount", RolePermission.count("roleId", role.id));
            items.add(row);
        }
        return items;
    }

    @Transactional
    public Role createRole(Role req) {
        if (req == null || blank(req.code)) throw bad("Mã vai trò không được để trống");
        if (blank(req.name)) throw bad("Tên vai trò không được để trống");
        String code = req.code.trim().toLowerCase(Locale.ROOT);
        if (!code.matches("[a-z0-9_-]{2,50}")) throw bad("Mã vai trò chỉ gồm chữ thường, số, _ hoặc -");
        if (Role.findByCode(code) != null) throw conflict("Mã vai trò đã tồn tại");

        Role role = new Role();
        role.code = code;
        role.name = req.name.trim();
        role.description = blank(req.description) ? null : req.description.trim();
        role.persist();
        return role;
    }

    @Transactional
    public Role updateRole(Long id, Role req) {
        Role role = roleOrThrow(id);
        if (req == null) throw bad("Dữ liệu không hợp lệ");
        if (req.code != null && !req.code.isBlank() && !req.code.equalsIgnoreCase(role.code)) {
            throw bad("Không được đổi mã vai trò");
        }
        if (blank(req.name)) throw bad("Tên vai trò không được để trống");
        role.name = req.name.trim();
        role.description = blank(req.description) ? null : req.description.trim();
        return role;
    }

    @Transactional
    public void deleteRole(Long id) {
        Role role = roleOrThrow(id);
        if (isBuiltin(role.code)) throw bad("Không thể xóa vai trò hệ thống");
        if (UserRole.count("roleId", role.id) > 0) throw conflict("Vai trò đang được gán cho người dùng");
        em.createQuery("delete from RolePermission rp where rp.roleId = :id").setParameter("id", role.id).executeUpdate();
        em.remove(role);
    }

    // ---------- Ma tran phan quyen ----------

    public Map<String, Map<String, Boolean>> rolePermissions(Long roleId) {
        Role role = roleOrThrow(roleId);
        List<Permission> all = Permission.list("order by module, action");
        Set<Long> granted = new LinkedHashSet<>();
        if (!"admin".equalsIgnoreCase(role.code)) {
            List<Long> ids = em.createQuery(
                            "select rp.permissionId from RolePermission rp where rp.roleId = :id", Long.class)
                    .setParameter("id", roleId)
                    .getResultList();
            granted.addAll(ids);
        }

        Map<String, Map<String, Boolean>> matrix = new LinkedHashMap<>();
        for (Permission p : all) {
            String module = p.module == null ? "" : p.module.toLowerCase(Locale.ROOT);
            String action = p.action == null ? "" : p.action.toLowerCase(Locale.ROOT);
            matrix.computeIfAbsent(module, k -> new LinkedHashMap<>())
                    .put(action, "admin".equalsIgnoreCase(role.code) || granted.contains(p.id));
        }
        return matrix;
    }

    @Transactional
    public void saveRolePermissions(Long roleId, Map<String, Map<String, Boolean>> body) {
        Role role = roleOrThrow(roleId);
        if ("admin".equalsIgnoreCase(role.code)) {
            throw bad("Vai trò Quản trị viên luôn có đầy đủ quyền");
        }
        em.createQuery("delete from RolePermission rp where rp.roleId = :id")
                .setParameter("id", roleId)
                .executeUpdate();
        if (body == null) return;

        for (Map.Entry<String, Map<String, Boolean>> moduleEntry : body.entrySet()) {
            if (moduleEntry.getValue() == null) continue;
            for (Map.Entry<String, Boolean> actionEntry : moduleEntry.getValue().entrySet()) {
                if (!Boolean.TRUE.equals(actionEntry.getValue())) continue;
                Permission permission = Permission.findOne(moduleEntry.getKey(), actionEntry.getKey());
                if (permission == null) continue;
                RolePermission link = new RolePermission();
                link.roleId = roleId;
                link.permissionId = permission.id;
                link.persist();
            }
        }
        flushOrConflict("Không thể lưu phân quyền");
    }

    // ---------- helper ----------

    private Role roleOrThrow(Long id) {
        Role role = em.find(Role.class, id);
        if (role == null) throw notFound("Không tìm thấy vai trò");
        return role;
    }

    private Role roleOrThrow(String code) {
        Role role = Role.findByCode(code);
        if (role == null) throw bad("Vai trò không hợp lệ");
        return role;
    }

    private void writeRole(Long userId, Long roleId) {
        UserRole.delete("userId", userId);
        UserRole link = new UserRole();
        link.userId = userId;
        link.roleId = roleId;
        link.persist();
    }

    private boolean isAdmin(User user) {
        if (user == null) return false;
        Set<String> roles = new LinkedHashSet<>();
        em.createQuery("select r.code from UserRole ur, Role r where ur.userId = :id and r.id = ur.roleId", String.class)
                .setParameter("id", user.id)
                .getResultList()
                .forEach(c -> roles.add(c == null ? "" : c.toLowerCase(Locale.ROOT)));
        if (roles.isEmpty() && user.role != null) roles.add(user.role.toLowerCase(Locale.ROOT));
        return roles.contains("admin");
    }

    private long countActiveAdmins() {
        return em.createQuery(
                        "select count(distinct u.id) from User u, UserRole ur, Role r "
                                + "where ur.userId = u.id and r.id = ur.roleId "
                                + "and lower(r.code) = 'admin' and u.active = true",
                        Long.class)
                .getSingleResult();
    }

    private static boolean isBuiltin(String code) {
        return "admin".equalsIgnoreCase(code)
                || "user".equalsIgnoreCase(code)
                || ROLE_COMPANY_ADMIN.equalsIgnoreCase(code);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private void flushOrConflict(String msg) {
        try {
            em.flush();
        } catch (PersistenceException ex) {
            throw conflict(msg);
        }
    }

    private static WebApplicationException bad(String msg) {
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("message", msg)).type(MediaType.APPLICATION_JSON).build());
    }

    private static WebApplicationException conflict(String msg) {
        return new WebApplicationException(Response.status(Response.Status.CONFLICT)
                .entity(Map.of("message", msg)).type(MediaType.APPLICATION_JSON).build());
    }

    private static WebApplicationException forbidden(String msg) {
        return new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                .entity(Map.of("message", msg)).type(MediaType.APPLICATION_JSON).build());
    }

    private static WebApplicationException notFound(String msg) {
        return new WebApplicationException(Response.status(Response.Status.NOT_FOUND)
                .entity(Map.of("message", msg)).type(MediaType.APPLICATION_JSON).build());
    }
}
