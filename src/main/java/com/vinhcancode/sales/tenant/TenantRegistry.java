package com.vinhcancode.sales.tenant;

import com.vinhcancode.sales.service.TenantProvisioner;
import io.agroal.api.AgroalDataSource;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/** Anh xa ma/id cong ty -> schema tenant, cache trong bo nho va kiem tra quyen truy cap cong ty cua user. */
@ApplicationScoped
public class TenantRegistry {

    private static final Pattern SCHEMA = Pattern.compile("[a-z][a-z0-9_]{1,62}");
    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private final Map<String, String> codes = new ConcurrentHashMap<>();

    @Inject
    AgroalDataSource dataSource;

    @Inject
    TenantProvisioner provisioner;

    /**
     * Kiem tra quyen truy cap cong ty cua user va tra ve ma/id cong ty hop le (hoac null neu dung public).
     */
    public String resolveAllowedCompany(String username, boolean isSystemAdmin, String requestedCompany) {
        if (isSystemAdmin || username == null || username.isBlank()) {
            return requestedCompany;
        }
        if (QuarkusTransaction.isActive()) {
            return QuarkusTransaction.suspendingExisting().call(
                    () -> checkUserCompanyAccess(username, requestedCompany));
        }
        return checkUserCompanyAccess(username, requestedCompany);
    }

    private String checkUserCompanyAccess(String username, String requestedCompany) {
        String userSql = "select id, lower(coalesce(role, '')), coalesce(allow_public, false), default_company_id "
                + "from public.users where lower(username) = ?";
        Long userId;
        String role;
        boolean allowPublic;
        Long defaultCompanyId;

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(userSql)) {
            ps.setString(1, username.trim().toLowerCase());
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return requestedCompany;
                userId = rs.getLong(1);
                role = rs.getString(2);
                allowPublic = rs.getBoolean(3);
                long defId = rs.getLong(4);
                defaultCompanyId = rs.wasNull() ? null : defId;
            }

            if ("admin".equals(role)) {
                return requestedCompany;
            }

            boolean wantsPublic = requestedCompany == null
                    || requestedCompany.isBlank()
                    || "public".equalsIgnoreCase(requestedCompany.trim());

            if (wantsPublic) {
                if (allowPublic) {
                    return null;
                }
                if (defaultCompanyId != null) {
                    return String.valueOf(defaultCompanyId);
                }
                String firstCoSql = "select uc.company_id from public.user_companies uc "
                        + "join public.dmcongty c on c.id = uc.company_id "
                        + "where uc.user_id = ? and c.status = 'active' "
                        + "order by uc.is_owner desc, uc.company_id asc limit 1";
                try (PreparedStatement psFirst = conn.prepareStatement(firstCoSql)) {
                    psFirst.setLong(1, userId);
                    try (ResultSet rsFirst = psFirst.executeQuery()) {
                        if (rsFirst.next()) {
                            return String.valueOf(rsFirst.getLong(1));
                        }
                    }
                }
                throw forbidden("Tài khoản của bạn chưa được phân quyền vào công ty nào");
            }

            String reqKey = requestedCompany.trim().toLowerCase();
            String checkSql = "select c.id from public.dmcongty c "
                    + "where c.status = 'active' "
                    + "and (c.id::text = ? or lower(c.code) = ? or lower(c.schema_name) = ?) "
                    + "and (exists (select 1 from public.user_companies uc where uc.user_id = ? and uc.company_id = c.id) "
                    + "     or c.id = ?)";
            try (PreparedStatement psCheck = conn.prepareStatement(checkSql)) {
                psCheck.setString(1, requestedCompany.trim());
                psCheck.setString(2, reqKey);
                psCheck.setString(3, reqKey);
                psCheck.setLong(4, userId);
                if (defaultCompanyId != null) {
                    psCheck.setLong(5, defaultCompanyId);
                } else {
                    psCheck.setLong(5, -1L);
                }
                try (ResultSet rsCheck = psCheck.executeQuery()) {
                    if (rsCheck.next()) {
                        return String.valueOf(rsCheck.getLong(1));
                    }
                }
            }
            throw forbidden("Bạn không có quyền quản trị hoặc truy cập dữ liệu công ty này");
        } catch (SQLException e) {
            throw new IllegalStateException("Cannot verify company access for user " + username, e);
        }
    }

    public String resolveSchema(String company) {
        if (company == null || company.isBlank()) return "public";
        String key = company.trim().toLowerCase();
        if ("public".equals(key)) return "public";
        String cached = cache.get(key);
        if (cached != null) return cached;

        if (QuarkusTransaction.isActive()) {
            return QuarkusTransaction.suspendingExisting().call(() -> lookupAndMigrateSchema(company, key));
        }
        return lookupAndMigrateSchema(company, key);
    }

    private String lookupAndMigrateSchema(String company, String key) {
        String sql = "select schema_name from public.dmcongty "
                + "where status = 'active' and (id::text = ? or lower(code) = ? or schema_name = ?)";
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, company.trim());
            statement.setString(2, key);
            statement.setString(3, key);
            try (ResultSet rs = statement.executeQuery()) {
                if (rs.next()) {
                    String schema = rs.getString(1);
                    if (!validSchema(schema)) throw invalid();
                    provisioner.ensureMigrated(schema);
                    cache.put(key, schema);
                    cache.put(schema.toLowerCase(), schema);
                    return schema;
                }
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Cannot resolve tenant " + company, e);
        }
        throw invalid();
    }

    /** Ma cong ty (dung lam thu muc upload) tu id / code / schema. */
    public String resolveCompanyCode(String company) {
        if (company == null || company.isBlank()) return "public";
        String key = company.trim().toLowerCase();
        if ("public".equals(key)) return "public";
        String cached = codes.get(key);
        if (cached != null) return cached;

        String sql = "select code from public.dmcongty "
                + "where status = 'active' and (id::text = ? or lower(code) = ? or schema_name = ?)";
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, company.trim());
            statement.setString(2, key);
            statement.setString(3, key);
            try (ResultSet rs = statement.executeQuery()) {
                if (rs.next()) {
                    String code = rs.getString(1);
                    codes.put(key, code);
                    codes.put(code.toLowerCase(), code);
                    return code;
                }
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Cannot resolve company " + company, e);
        }
        throw invalid();
    }

    public boolean validSchema(String schema) {
        return schema != null && !"public".equalsIgnoreCase(schema) && SCHEMA.matcher(schema).matches();
    }

    public void refresh() {
        cache.clear();
        codes.clear();
    }

    private static WebApplicationException invalid() {
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("message", "Công ty không tồn tại hoặc đã ngừng hoạt động"))
                .type(MediaType.APPLICATION_JSON)
                .build());
    }

    private static WebApplicationException forbidden(String message) {
        return new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                .entity(Map.of("message", message))
                .type(MediaType.APPLICATION_JSON)
                .build());
    }
}
