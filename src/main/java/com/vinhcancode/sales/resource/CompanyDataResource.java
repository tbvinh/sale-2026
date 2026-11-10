package com.vinhcancode.sales.resource;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vinhcancode.sales.dto.CompanyRequest;
import com.vinhcancode.sales.entity.DmCongTy;
import com.vinhcancode.sales.entity.Permission;
import com.vinhcancode.sales.entity.Role;
import com.vinhcancode.sales.entity.User;
import com.vinhcancode.sales.entity.UserCompany;
import com.vinhcancode.sales.entity.UserPermission;
import com.vinhcancode.sales.entity.UserRole;
import com.vinhcancode.sales.service.AdminService;
import com.vinhcancode.sales.service.CompanyService;
import com.vinhcancode.sales.service.TenantProvisioner;
import io.agroal.api.AgroalDataSource;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import org.eclipse.microprofile.jwt.JsonWebToken;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.ByteArrayOutputStream;
import java.io.FilterInputStream;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import org.postgresql.PGConnection;
import org.postgresql.copy.CopyManager;
import org.postgresql.copy.CopyOut;

/**
 * Sao luu / phuc hoi schema cong ty bang CSV trong ZIP, stream qua PostgreSQL COPY.
 * Khong doc toan bo du lieu vao bo nho: COPY TO STDOUT -> HTTP, ZIP -> COPY FROM STDIN.
 */
@Path("/company")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Authenticated
public class CompanyDataResource {

    private static final String FORMAT = "ketoan-company-backup-csv";
    private static final String MULTI_FORMAT = "ketoan-multi-company-backup-csv";
    private static final int FORMAT_VERSION = 2;
    private static final String ZIP_MIME = "application/zip";
    private static final int MAX_MANIFEST_BYTES = 2 * 1024 * 1024;

    private static final Set<String> EXCLUDED = Set.of(
            "flyway_schema_history", "dmcongty", "user_companies", "user_permissions",
            "users", "roles", "user_roles", "permissions", "role_permissions");

    private static final Set<String> CLONE_EXCLUDED = Set.of("flyway_schema_history", "dmcongty", "user_companies", "user_permissions");

    @Inject
    AgroalDataSource dataSource;

    @Inject
    TenantProvisioner provisioner;

    @Inject
    CompanyService companyService;

    @Inject
    AdminService adminService;

    @Inject
    JsonWebToken jwt;

    @Inject
    ObjectMapper mapper;

    private boolean isSystemAdmin() {
        Set<String> groups = jwt != null ? jwt.getGroups() : null;
        return groups != null && groups.contains("admin");
    }

    private void requireCompanyAccess(Long companyId) {
        if (companyId == null) {
            throw problem(Response.Status.BAD_REQUEST, "Chưa chọn công ty");
        }
        if (isSystemAdmin()) return;
        String username = jwt != null ? jwt.getName() : null;
        if (username == null || username.isBlank()) {
            throw problem(Response.Status.FORBIDDEN, "Chưa xác thực người dùng");
        }
        User actor = User.findByUsername(username);
        if (actor == null || Boolean.FALSE.equals(actor.active)) {
            throw problem(Response.Status.FORBIDDEN, "Tài khoản không hợp lệ");
        }
        long count = UserCompany.count("userId = ?1 and companyId = ?2", actor.id, companyId);
        boolean allowed = count > 0 || companyId.equals(actor.defaultCompanyId);
        if (!allowed) {
            throw problem(Response.Status.FORBIDDEN, "Bạn không có quyền sao lưu hoặc phục hồi dữ liệu của công ty này");
        }
    }

    @GET
    @Path("/{id}/export")
    @Produces(ZIP_MIME)
    @RolesAllowed({"admin", "company_admin"})
    public Response export(@PathParam("id") Long id) throws Exception {
        requireCompanyAccess(id);
        DmCongTy company = find(id);
        String schema = company.schemaName;
        provisioner.ensureMigrated(schema);

        List<Table> tables;
        try (Connection connection = dataSource.getConnection()) {
            tables = tables(connection, schema);
        }

        Map<String, Object> manifest = manifest(company, schema, tables);
        byte[] manifestBytes = mapper.writeValueAsBytes(manifest);
        String fileName = "company-" + safe(company.code) + "-" + manifest.get("schemaVersion") + ".csv.zip";

        return Response.ok((StreamingOutput) out -> stream(out, schema, tables, manifestBytes), ZIP_MIME)
                .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"")
                .build();
    }

    @GET
    @Path("/export-batch")
    @Produces(ZIP_MIME)
    @RolesAllowed("admin")
    public Response exportBatch(@QueryParam("ids") String idsParam) throws Exception {
        List<DmCongTy> allCompanies = companyService.listAll();
        List<DmCongTy> selected = new ArrayList<>();
        if (idsParam == null || idsParam.isBlank() || "all".equalsIgnoreCase(idsParam.trim())) {
            selected.addAll(allCompanies);
        } else {
            Map<Long, DmCongTy> byId = new LinkedHashMap<>();
            for (DmCongTy c : allCompanies) {
                byId.put(c.id, c);
            }
            for (String token : idsParam.split(",")) {
                String trimmed = token.trim();
                if (trimmed.isEmpty()) continue;
                try {
                    Long cid = Long.valueOf(trimmed);
                    DmCongTy found = byId.get(cid);
                    if (found == null) throw problem(Response.Status.NOT_FOUND, "Không tìm thấy công ty ID: " + cid);
                    selected.add(found);
                } catch (NumberFormatException e) {
                    throw problem(Response.Status.BAD_REQUEST, "ID công ty không hợp lệ: " + trimmed);
                }
            }
        }
        if (selected.isEmpty()) {
            throw problem(Response.Status.BAD_REQUEST, "Chưa chọn công ty nào để sao lưu");
        }
        if (selected.size() == 1) {
            return export(selected.get(0).id);
        }

        List<CompanyExportPlan> plans = new ArrayList<>();
        try (Connection connection = dataSource.getConnection()) {
            for (DmCongTy company : selected) {
                String schema = company.schemaName;
                provisioner.ensureMigrated(schema);
                List<Table> tbls = tables(connection, schema);
                Map<String, Object> coManifest = manifest(company, schema, tbls);
                byte[] coManifestBytes = mapper.writeValueAsBytes(coManifest);
                plans.add(new CompanyExportPlan(company, schema, tbls, coManifestBytes));
            }
        }

        Map<String, Object> bundleManifest = new LinkedHashMap<>();
        bundleManifest.put("format", MULTI_FORMAT);
        bundleManifest.put("formatVersion", FORMAT_VERSION);
        bundleManifest.put("exportedAt", OffsetDateTime.now().toString());
        bundleManifest.put("companyCount", plans.size());
        bundleManifest.put("companies", plans.stream().map(p -> p.company().code).toList());
        byte[] bundleManifestBytes = mapper.writeValueAsBytes(bundleManifest);

        String fileName = "companies-backup-" + plans.size() + "-companies.zip";
        return Response.ok((StreamingOutput) out -> streamBatch(out, plans, bundleManifestBytes), ZIP_MIME)
                .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"")
                .build();
    }

    private void streamBatch(OutputStream out, List<CompanyExportPlan> plans, byte[] bundleManifestBytes) throws IOException {
        try (Connection connection = dataSource.getConnection()) {
            CopyManager copy = connection.unwrap(PGConnection.class).getCopyAPI();
            try (ZipOutputStream outerZip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
                outerZip.putNextEntry(new ZipEntry("manifest.json"));
                outerZip.write(bundleManifestBytes);
                outerZip.closeEntry();

                for (CompanyExportPlan plan : plans) {
                    String entryName = "companies/company-" + safe(plan.company().code) + ".csv.zip";
                    outerZip.putNextEntry(new ZipEntry(entryName));
                    OutputStream nonClosingOut = new FilterOutputStream(outerZip) {
                        @Override
                        public void write(byte[] b, int off, int len) throws IOException {
                            out.write(b, off, len);
                        }

                        @Override
                        public void close() throws IOException {
                            out.flush();
                        }
                    };
                    try (ZipOutputStream nestedZip = new ZipOutputStream(nonClosingOut, StandardCharsets.UTF_8)) {
                        nestedZip.putNextEntry(new ZipEntry("manifest.json"));
                        nestedZip.write(plan.manifestBytes());
                        nestedZip.closeEntry();
                        for (Table table : plan.tables()) {
                            nestedZip.putNextEntry(new ZipEntry(table.name() + ".csv"));
                            CopyOut rows = copy.copyOut(copyOutSql(plan.schema(), table));
                            try {
                                byte[] chunk;
                                while ((chunk = rows.readFromCopy(true)) != null) {
                                    if (chunk.length > 0) nestedZip.write(chunk);
                                }
                            } finally {
                                try {
                                    if (rows.isActive()) rows.cancelCopy();
                                } catch (SQLException ignored) {
                                }
                            }
                            nestedZip.closeEntry();
                        }
                        nestedZip.finish();
                    }
                    outerZip.closeEntry();
                }
            }
        } catch (SQLException e) {
            throw new IOException("Multi-company export failed", e);
        }
    }

    private void stream(OutputStream out, String schema, List<Table> tables, byte[] manifestBytes) throws IOException {
        try (Connection connection = dataSource.getConnection()) {
            CopyManager copy = connection.unwrap(PGConnection.class).getCopyAPI();
            try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
                zip.putNextEntry(new ZipEntry("manifest.json"));
                zip.write(manifestBytes);
                zip.closeEntry();
                for (Table table : tables) {
                    zip.putNextEntry(new ZipEntry(table.name() + ".csv"));
                    CopyOut rows = copy.copyOut(copyOutSql(schema, table));
                    try {
                        byte[] chunk;
                        while ((chunk = rows.readFromCopy(true)) != null) {
                            if (chunk.length > 0) zip.write(chunk);
                        }
                    } finally {
                        try {
                            if (rows.isActive()) rows.cancelCopy();
                        } catch (SQLException ignored) {
                            // Bỏ qua lỗi huỷ COPY khi kết nối đã đóng.
                        }
                    }
                    zip.closeEntry();
                }
            }
        } catch (SQLException e) {
            throw new IOException("Company export failed", e);
        }
    }

    private Map<String, Object> manifest(DmCongTy company, String schema, List<Table> tables) {
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("format", FORMAT);
        manifest.put("formatVersion", FORMAT_VERSION);
        manifest.put("schemaVersion", provisioner.currentVersion(schema));
        manifest.put("latestVersion", provisioner.latestVersion());
        manifest.put("exportedAt", OffsetDateTime.now().toString());
        manifest.put("company", companyInfo(company));
        manifest.put("companyUsers", exportCompanyUsers(company.id));

        List<Map<String, Object>> tableList = new ArrayList<>();
        for (Table table : tables) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", table.name());
            item.put("columns", table.columns().stream()
                    .filter(column -> !column.generated())
                    .map(Column::name)
                    .toList());
            tableList.add(item);
        }
        manifest.put("tables", tableList);
        return manifest;
    }

    @POST
    @Path("/{sourceCompanyId}/clone")
    @RolesAllowed("admin")
    public Map<String, Object> clone(@PathParam("sourceCompanyId") Long sourceCompanyId, DmCongTy body) {
        DmCongTy source = find(sourceCompanyId);
        if (body == null || body.code == null || body.code.isBlank()
                || body.name == null || body.name.isBlank()) {
            throw problem(Response.Status.BAD_REQUEST, "Mã và tên công ty không được để trống");
        }
        String latest = provisioner.latestVersion();
        String sourceVersion = provisioner.currentVersion(source.schemaName);
        if (TenantProvisioner.versionNumber(sourceVersion) > TenantProvisioner.versionNumber(latest)) {
            throw problem(Response.Status.CONFLICT, "Schema nguồn mới hơn phiên bản ứng dụng");
        }

        DmCongTy request = new DmCongTy();
        request.code = body.code.trim();
        request.name = body.name.trim();
        request.address = body.address == null ? source.address : body.address;
        request.taxCode = body.taxCode == null ? source.taxCode : body.taxCode;
        request.phone = body.phone == null ? source.phone : body.phone;
        request.status = "active";

        DmCongTy target = companyService.create(request);
        try {
            Stats stats = cloneData(source.schemaName, target.schemaName);
            QuarkusTransaction.requiringNew().run(() -> {
                CompanyRequest ownerReq = new CompanyRequest();
                ownerReq.autoCreateOwner = true;
                companyService.syncCompanyUsers(target, ownerReq, true);
            });

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("sourceCompanyId", source.id);
            result.put("companyId", target.id);
            result.put("code", target.code);
            result.put("name", target.name);
            result.put("schemaName", target.schemaName);
            result.put("tables", stats.tables());
            result.put("rows", stats.rows());
            result.put("schemaVersion", provisioner.currentVersion(target.schemaName));
            return result;
        } catch (Exception e) {
            try { companyService.delete(target.id); } catch (RuntimeException ignored) { }
            if (e instanceof WebApplicationException wae) throw wae;
            throw problem(Response.Status.BAD_REQUEST, "Nhân bản thất bại: " + e.getMessage());
        }
    }

    @POST
    @Path("/import")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @RolesAllowed({"admin", "company_admin"})
    public Map<String, Object> importPackage(@RestForm("file") FileUpload file,
                                             @RestForm("companyId") String companyId,
                                             @RestForm("restoreUsers") String restoreUsers) {
        if (file == null || file.uploadedFile() == null) {
            throw problem(Response.Status.BAD_REQUEST, "Chưa chọn tệp sao lưu công ty");
        }
        boolean sysAdmin = isSystemAdmin();
        if (!sysAdmin) {
            if (companyId == null || companyId.isBlank()) {
                throw problem(Response.Status.FORBIDDEN, "Chủ sở hữu chỉ được phép phục hồi dữ liệu vào công ty của mình");
            }
            try {
                requireCompanyAccess(Long.valueOf(companyId.trim()));
            } catch (NumberFormatException e) {
                throw problem(Response.Status.BAD_REQUEST, "Công ty đích không hợp lệ");
            }
        }
        java.nio.file.Path uploaded = file.uploadedFile();

        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(uploaded), StandardCharsets.UTF_8)) {
            ZipEntry first = zip.getNextEntry();
            if (first == null || !"manifest.json".equals(first.getName())) {
                throw problem(Response.Status.BAD_REQUEST, "Tệp không đúng định dạng sao lưu công ty");
            }
            Map<String, Object> manifest = mapper.readValue(readEntry(zip, MAX_MANIFEST_BYTES),
                    new TypeReference<Map<String, Object>>() { });
            zip.closeEntry();

            String fmt = string(manifest, "format");
            if (MULTI_FORMAT.equals(fmt) && number(manifest.get("formatVersion")) == FORMAT_VERSION) {
                if (!sysAdmin) {
                    throw problem(Response.Status.FORBIDDEN, "Chỉ Quản trị viên hệ thống mới được phép phục hồi gói nhiều công ty");
                }
                return importMultiPackage(zip, restoreUsers);
            }
            if (!FORMAT.equals(fmt) || number(manifest.get("formatVersion")) != FORMAT_VERSION) {
                throw problem(Response.Status.BAD_REQUEST, "Định dạng tệp sao lưu không được hỗ trợ");
            }
            return importSingleCompanyFromStream(zip, manifest, companyId, restoreUsers, sysAdmin, false);
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            throw problem(Response.Status.BAD_REQUEST, "Import thất bại: " + e.getMessage());
        }
    }

    private Map<String, Object> importMultiPackage(ZipInputStream outerZip, String restoreUsers) throws Exception {
        int companyCount = 0;
        int totalTables = 0;
        long totalRows = 0L;
        int totalUsersRestored = 0;
        String latestVersion = provisioner.latestVersion();
        List<String> codes = new ArrayList<>();

        ZipEntry outerEntry;
        while ((outerEntry = outerZip.getNextEntry()) != null) {
            if (outerEntry.isDirectory() || !outerEntry.getName().endsWith(".zip")) {
                outerZip.closeEntry();
                continue;
            }
            InputStream nonClosingIn = new FilterInputStream(outerZip) {
                @Override
                public void close() {
                    // Không đóng outerZip khi kết thúc đọc một gói công ty con.
                }
            };
            ZipInputStream nestedZip = new ZipInputStream(nonClosingIn, StandardCharsets.UTF_8);
            ZipEntry first = nestedZip.getNextEntry();
            if (first == null || !"manifest.json".equals(first.getName())) {
                throw problem(Response.Status.BAD_REQUEST, "Tệp công ty con không hợp lệ: " + outerEntry.getName());
            }
            Map<String, Object> coManifest = mapper.readValue(readEntry(nestedZip, MAX_MANIFEST_BYTES),
                    new TypeReference<Map<String, Object>>() { });
            nestedZip.closeEntry();

            if (!FORMAT.equals(string(coManifest, "format")) || number(coManifest.get("formatVersion")) != FORMAT_VERSION) {
                throw problem(Response.Status.BAD_REQUEST, "Định dạng gói công ty con không được hỗ trợ: " + outerEntry.getName());
            }
            Map<String, Object> singleRes = importSingleCompanyFromStream(nestedZip, coManifest, null, restoreUsers, true, true);
            while (nestedZip.getNextEntry() != null) {
                nestedZip.closeEntry();
            }
            outerZip.closeEntry();

            companyCount++;
            totalTables += ((Number) singleRes.getOrDefault("tables", 0)).intValue();
            totalRows += ((Number) singleRes.getOrDefault("rows", 0L)).longValue();
            totalUsersRestored += ((Number) singleRes.getOrDefault("usersRestored", 0)).intValue();
            Object codeObj = singleRes.get("code");
            if (codeObj != null) codes.add(String.valueOf(codeObj));
        }

        if (companyCount == 0) {
            throw problem(Response.Status.BAD_REQUEST, "Gói sao lưu không chứa dữ liệu công ty nào");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("multi", true);
        result.put("companyCount", companyCount);
        result.put("codes", codes);
        result.put("schemaVersion", latestVersion);
        result.put("targetVersion", latestVersion);
        result.put("tables", totalTables);
        result.put("rows", totalRows);
        result.put("usersRestored", totalUsersRestored);
        return result;
    }

    private Map<String, Object> importSingleCompanyFromStream(ZipInputStream zip,
                                                              Map<String, Object> manifest,
                                                              String companyId,
                                                              String restoreUsers,
                                                              boolean sysAdmin,
                                                              boolean upsertByCode) throws Exception {
        String packageVersion = string(manifest, "schemaVersion");
        if (packageVersion == null || packageVersion.isBlank()) {
            throw problem(Response.Status.BAD_REQUEST, "Gói dữ liệu thiếu schema version");
        }

        Object value = manifest.get("company");
        Map<?, ?> meta = value instanceof Map<?, ?> map ? map : Map.of();
        String manifestCode = objectString(meta.get("code"));
        boolean isCreatingNew = (companyId == null || companyId.isBlank())
                && (manifestCode == null || DmCongTy.findByCode(manifestCode) == null);

        DmCongTy company = target(companyId, manifest, upsertByCode);
        String schema = company.schemaName;
        String latest = provisioner.latestVersion();
        String current = provisioner.currentVersion(schema);
        boolean upgraded = false;

        if (TenantProvisioner.versionNumber(current) < TenantProvisioner.versionNumber(latest)) {
            try {
                provisioner.migrate(schema);
            } catch (RuntimeException e) {
                throw problem(Response.Status.BAD_REQUEST, "Không thể nâng cấp schema công ty: " + e.getMessage());
            }
            upgraded = true;
            current = provisioner.currentVersion(schema);
        }
        if (TenantProvisioner.versionNumber(packageVersion) > TenantProvisioner.versionNumber(current)) {
            throw problem(Response.Status.CONFLICT,
                    "Gói dữ liệu có schema version " + packageVersion + " mới hơn CSDL (" + current + ")");
        }

        Stats stats = copyEntries(zip, schema, manifest);

        int usersRestored = 0;
        if (!"false".equalsIgnoreCase(restoreUsers)) {
            usersRestored = restoreCompanyUsers(company, manifest, isCreatingNew, sysAdmin);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("companyId", company.id);
        result.put("code", company.code);
        result.put("schemaName", schema);
        result.put("schemaVersion", packageVersion);
        result.put("targetVersion", current);
        result.put("upgraded", upgraded);
        result.put("tables", stats.tables());
        result.put("rows", stats.rows());
        result.put("usersRestored", usersRestored);
        return result;
    }


    private Stats copyEntries(ZipInputStream zip, String schema, Map<String, Object> manifest) throws Exception {
        Map<String, List<String>> packageTables = manifestTables(manifest);
        if (packageTables.isEmpty()) throw problem(Response.Status.BAD_REQUEST, "Gói dữ liệu không có bảng dữ liệu");

        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                List<Table> targetTables = tables(connection, schema);
                if (targetTables.isEmpty()) throw problem(Response.Status.BAD_REQUEST, "Schema công ty chưa có dữ liệu");
                Map<String, Table> byName = new LinkedHashMap<>();
                for (Table table : targetTables) byName.put(table.name(), table);

                for (Map.Entry<String, List<String>> entry : packageTables.entrySet()) {
                    Table table = byName.get(entry.getKey());
                    if (table == null) {
                        throw problem(Response.Status.BAD_REQUEST,
                                "Bảng " + entry.getKey() + " không tồn tại trong schema đích");
                    }
                    Set<String> targetColumns = table.columns().stream()
                            .filter(column -> !column.generated())
                            .map(Column::name)
                            .collect(Collectors.toSet());
                    for (String column : entry.getValue()) {
                        if (!targetColumns.contains(column)) {
                            throw problem(Response.Status.BAD_REQUEST,
                                    "Cột " + entry.getKey() + "." + column + " không tồn tại trong schema đích");
                        }
                    }
                }

                String truncate = targetTables.stream()
                        .map(table -> table(schema, table.name()))
                        .collect(Collectors.joining(", "));
                try (Statement statement = connection.createStatement()) {
                    statement.execute("TRUNCATE TABLE " + truncate + " RESTART IDENTITY CASCADE");
                    for (Table table : targetTables) {
                        statement.execute("ALTER TABLE " + table(schema, table.name()) + " DISABLE TRIGGER ALL");
                    }
                }

                CopyManager copy = connection.unwrap(PGConnection.class).getCopyAPI();
                int tableCount = 0;
                long rowCount = 0;
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (entry.isDirectory()) continue;
                    String name = entry.getName();
                    if (!name.endsWith(".csv")) continue;
                    String tableName = name.substring(0, name.length() - 4);
                    List<String> columns = packageTables.get(tableName);
                    if (columns == null) {
                        throw problem(Response.Status.BAD_REQUEST, "Bảng " + tableName + " không có trong manifest");
                    }
                    if (columns.isEmpty()) {
                        zip.closeEntry();
                        continue;
                    }
                    InputStream rows = new FilterInputStream(zip) {
                        @Override
                        public void close() {
                            // Không đóng ZipInputStream khi CopyManager kết thúc một entry.
                        }
                    };
                    rowCount += copy.copyIn(copyInSql(schema, tableName, columns), rows);
                    tableCount++;
                    zip.closeEntry();
                }

                try (Statement statement = connection.createStatement()) {
                    for (Table table : targetTables) {
                        statement.execute("ALTER TABLE " + table(schema, table.name()) + " ENABLE TRIGGER ALL");
                    }
                }
                for (Table table : targetTables) resetSequence(connection, schema, table);
                connection.commit();
                return new Stats(tableCount, rowCount);
            } catch (Exception e) {
                try { connection.rollback(); } catch (SQLException ignored) { }
                throw e;
            }
        }
    }

    private Stats cloneData(String sourceSchema, String targetSchema) throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                List<Table> sourceTables = tables(connection, sourceSchema, CLONE_EXCLUDED);
                List<Table> targetTables = tables(connection, targetSchema, CLONE_EXCLUDED);
                Map<String, Table> targetByName = new LinkedHashMap<>();
                for (Table table : targetTables) targetByName.put(table.name(), table);

                for (Table source : sourceTables) {
                    if (!targetByName.containsKey(source.name())) {
                        throw problem(Response.Status.BAD_REQUEST,
                                "Bảng " + source.name() + " không tồn tại trong schema đích");
                    }
                }

                String truncate = targetTables.stream()
                        .map(table -> table(targetSchema, table.name()))
                        .collect(Collectors.joining(", "));
                try (Statement statement = connection.createStatement()) {
                    statement.execute("TRUNCATE TABLE " + truncate + " RESTART IDENTITY CASCADE");
                    for (Table table : targetTables) {
                        statement.execute("ALTER TABLE " + table(targetSchema, table.name()) + " DISABLE TRIGGER ALL");
                    }
                }

                int tableCount = 0;
                long rowCount = 0;
                for (Table source : sourceTables) {
                    Table target = targetByName.get(source.name());
                    Set<String> sourceColumns = source.columns().stream()
                            .filter(column -> !column.generated())
                            .map(Column::name)
                            .collect(Collectors.toSet());
                    List<Column> columns = target.columns().stream()
                            .filter(column -> !column.generated())
                            .filter(column -> sourceColumns.contains(column.name()))
                            .toList();
                    if (columns.isEmpty()) continue;

                    String columnList = columns.stream().map(column -> q(column.name()))
                            .collect(Collectors.joining(", "));
                    String sql = "INSERT INTO " + table(targetSchema, source.name()) + " (" + columnList + ") "
                            + (columns.stream().anyMatch(Column::identityAlways) ? "OVERRIDING SYSTEM VALUE " : "")
                            + "SELECT " + columnList + " FROM " + table(sourceSchema, source.name());
                    try (Statement statement = connection.createStatement()) {
                        rowCount += statement.executeUpdate(sql);
                    }
                    tableCount++;
                }

                try (Statement statement = connection.createStatement()) {
                    for (Table table : targetTables) {
                        statement.execute("ALTER TABLE " + table(targetSchema, table.name()) + " ENABLE TRIGGER ALL");
                    }
                }
                for (Table table : targetTables) resetSequence(connection, targetSchema, table);
                connection.commit();
                return new Stats(tableCount, rowCount);
            } catch (Exception e) {
                try { connection.rollback(); } catch (SQLException ignored) { }
                if (e instanceof SQLException sql) throw sql;
                if (e instanceof RuntimeException runtime) throw runtime;
                throw new SQLException(e);
            }
        }
    }

    private DmCongTy target(String companyId, Map<String, Object> manifest, boolean upsertByCode) {
        if (companyId != null && !companyId.isBlank()) {
            try {
                return find(Long.valueOf(companyId.trim()));
            } catch (NumberFormatException e) {
                throw problem(Response.Status.BAD_REQUEST, "Công ty đích không hợp lệ");
            }
        }
        Object value = manifest.get("company");
        Map<?, ?> meta = value instanceof Map<?, ?> map ? map : Map.of();
        String code = objectString(meta.get("code"));
        if (code == null || code.isBlank()) throw problem(Response.Status.BAD_REQUEST, "Gói dữ liệu thiếu mã công ty");
        DmCongTy existing = DmCongTy.findByCode(code);
        if (existing != null) {
            if (!upsertByCode) {
                throw problem(Response.Status.CONFLICT, "Mã công ty đã tồn tại — chọn công ty đích để ghi đè");
            }
            DmCongTy updateReq = new DmCongTy();
            updateReq.name = objectString(meta.get("name"));
            if (updateReq.name == null || updateReq.name.isBlank()) updateReq.name = existing.name;
            updateReq.address = objectString(meta.get("address"));
            updateReq.taxCode = objectString(meta.get("taxCode"));
            updateReq.phone = objectString(meta.get("phone"));
            return companyService.update(existing.id, updateReq);
        }
        DmCongTy request = new DmCongTy();
        request.code = code;
        request.name = objectString(meta.get("name"));
        if (request.name == null || request.name.isBlank()) request.name = code;
        request.address = objectString(meta.get("address"));
        request.taxCode = objectString(meta.get("taxCode"));
        request.phone = objectString(meta.get("phone"));
        return companyService.create(request);
    }

    private static DmCongTy find(Long id) {
        DmCongTy company = DmCongTy.findById(id);
        if (company == null) throw problem(Response.Status.NOT_FOUND, "Không tìm thấy công ty");
        return company;
    }

    private static Map<String, Object> companyInfo(DmCongTy company) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("id", company.id);
        info.put("code", company.code);
        info.put("name", company.name);
        info.put("address", company.address);
        info.put("taxCode", company.taxCode);
        info.put("phone", company.phone);
        return info;
    }

    private List<Map<String, Object>> exportCompanyUsers(Long companyId) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (companyId == null) return list;
        List<UserCompany> links = UserCompany.list("companyId = ?1 order by isOwner desc, userId asc", companyId);
        Map<Long, Permission> permById = new LinkedHashMap<>();
        for (Permission p : Permission.<Permission>listAll()) {
            permById.put(p.id, p);
        }
        for (UserCompany uc : links) {
            User u = User.findById(uc.userId);
            if (u == null || "admin".equalsIgnoreCase(u.role)) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("username", u.username);
            item.put("passwordHash", u.password);
            item.put("fullName", u.fullName);
            item.put("imageUrl", u.imageUrl);
            item.put("role", u.role);
            item.put("active", !Boolean.FALSE.equals(u.active));
            item.put("isOwner", Boolean.TRUE.equals(uc.isOwner));
            item.put("customPermissions", Boolean.TRUE.equals(u.customPermissions));
            List<String> granted = new ArrayList<>();
            if (Boolean.TRUE.equals(u.customPermissions)) {
                for (UserPermission up : UserPermission.<UserPermission>list("userId = ?1", u.id)) {
                    Permission p = permById.get(up.permissionId);
                    if (p != null) {
                        granted.add(p.module + ":" + p.action);
                    }
                }
            }
            item.put("permissions", granted);
            list.add(item);
        }
        return list;
    }

    private int restoreCompanyUsers(DmCongTy company, Map<String, Object> manifest,
                                    boolean isCreatingNew, boolean sysAdmin) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Role ownerRole = adminService.ensureCompanyAdminRole();
            Role userRole = Role.findByCode("user");
            Object rawUsers = manifest.get("companyUsers");
            if (!(rawUsers instanceof List<?> userList) || userList.isEmpty()) {
                if (isCreatingNew) {
                    CompanyRequest req = new CompanyRequest();
                    req.autoCreateOwner = true;
                    companyService.syncCompanyUsers(company, req, true);
                    return 1;
                }
                return 0;
            }

            int restored = 0;
            Long ownerId = null;
            for (Object entry : userList) {
                if (!(entry instanceof Map<?, ?> uMap)) continue;
                String rawUsername = objectString(uMap.get("username"));
                if (rawUsername == null || rawUsername.isBlank()) continue;
                boolean isOwner = Boolean.TRUE.equals(uMap.get("isOwner"));
                String username = isOwner
                        ? rawUsername.trim()
                        : AdminService.ensureCompanyPrefix(rawUsername, company.code);
                String passwordHash = objectString(uMap.get("passwordHash"));
                String fullName = objectString(uMap.get("fullName"));
                String imageUrl = objectString(uMap.get("imageUrl"));
                boolean active = !Boolean.FALSE.equals(uMap.get("active"));
                boolean customPerms = Boolean.TRUE.equals(uMap.get("customPermissions"));

                User user = User.findByUsername(username);
                if (user == null && !sysAdmin && isOwner && jwt != null && jwt.getName() != null) {
                    user = User.findByUsername(jwt.getName());
                }
                if (user == null) {
                    if (!sysAdmin && isOwner) {
                        continue;
                    }
                    user = new User();
                    user.username = username;
                    user.password = (passwordHash != null && passwordHash.startsWith("$2"))
                            ? passwordHash
                            : BcryptUtil.bcryptHash("123456");
                    user.fullName = fullName;
                    user.imageUrl = imageUrl;
                    user.role = isOwner ? ownerRole.code : "user";
                    user.active = active;
                    user.allowPublic = false;
                    user.defaultCompanyId = company.id;
                    user.customPermissions = !isOwner && customPerms;
                    user.persist();
                    User.flush();

                    Role targetRole = isOwner ? ownerRole : (userRole != null ? userRole : ownerRole);
                    UserRole ur = new UserRole();
                    ur.userId = user.id;
                    ur.roleId = targetRole.id;
                    ur.persist();
                } else if (!"admin".equalsIgnoreCase(user.role)) {
                    if (fullName != null && !fullName.isBlank()) user.fullName = fullName;
                    if (imageUrl != null && !imageUrl.isBlank()) user.imageUrl = imageUrl;
                    if (user.defaultCompanyId == null) user.defaultCompanyId = company.id;
                    if (!isOwner) user.customPermissions = customPerms;
                } else {
                    continue;
                }

                if (isOwner && ownerId == null) {
                    ownerId = user.id;
                }

                UserCompany existingLink = UserCompany.find("userId = ?1 and companyId = ?2", user.id, company.id).firstResult();
                if (existingLink == null) {
                    UserCompany uc = new UserCompany();
                    uc.userId = user.id;
                    uc.companyId = company.id;
                    uc.isOwner = isOwner;
                    uc.persist();
                } else if (isOwner) {
                    existingLink.isOwner = true;
                }

                if (!isOwner && customPerms && uMap.get("permissions") instanceof List<?> permList) {
                    UserPermission.delete("userId", user.id);
                    UserPermission.flush();
                    for (Object pObj : permList) {
                        String spec = objectString(pObj);
                        if (spec == null || !spec.contains(":")) continue;
                        String[] parts = spec.split(":", 2);
                        Permission perm = Permission.findOne(parts[0], parts[1]);
                        if (perm != null) {
                            UserPermission up = new UserPermission();
                            up.userId = user.id;
                            up.permissionId = perm.id;
                            up.persist();
                        }
                    }
                }
                restored++;
            }

            if (ownerId != null) {
                for (User u : User.<User>list("defaultCompanyId = ?1 and id <> ?2", company.id, ownerId)) {
                    if (u.createdByUserId == null) {
                        u.createdByUserId = ownerId;
                    }
                }
            }
            return restored;
        });
    }

    private static Map<String, List<String>> manifestTables(Map<String, Object> manifest) {
        Object value = manifest.get("tables");
        if (!(value instanceof List<?> list)) {
            throw problem(Response.Status.BAD_REQUEST, "Gói dữ liệu thiếu danh sách bảng");
        }
        Map<String, List<String>> tables = new LinkedHashMap<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) continue;
            String name = objectString(map.get("name"));
            Object columnsValue = map.get("columns");
            if (name == null || !(columnsValue instanceof List<?> columnsList)) continue;
            List<String> columns = new ArrayList<>();
            for (Object column : columnsList) {
                String columnName = objectString(column);
                if (columnName != null) columns.add(columnName);
            }
            tables.put(name, columns);
        }
        return tables;
    }


    private static List<Table> tables(Connection connection, String schema) throws SQLException {
        return tables(connection, schema, EXCLUDED);
    }

    private static List<Table> tables(Connection connection, String schema, Set<String> excluded) throws SQLException {
        LinkedHashMap<String, List<Column>> map = new LinkedHashMap<>();
        String tableSql = "select tablename from pg_catalog.pg_tables where schemaname = ? order by tablename";
        try (PreparedStatement statement = connection.prepareStatement(tableSql)) {
            statement.setString(1, schema);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    String name = result.getString(1);
                    if (!excluded.contains(name)) map.put(name, new ArrayList<>());
                }
            }
        }

        String columnSql = """
                select c.table_name, c.column_name,
                       (c.is_generated = 'ALWAYS') as generated,
                       (c.is_identity = 'YES' and c.identity_generation = 'ALWAYS') as identity_always,
                       (c.column_default like 'nextval%' or c.is_identity = 'YES') as sequence_column
                from information_schema.columns c
                join pg_catalog.pg_namespace n on n.nspname = c.table_schema
                join pg_catalog.pg_class cl on cl.relnamespace = n.oid and cl.relname = c.table_name
                join pg_catalog.pg_attribute a on a.attrelid = cl.oid and a.attname = c.column_name and a.attnum > 0
                where c.table_schema = ?
                order by c.table_name, c.ordinal_position
                """;
        try (PreparedStatement statement = connection.prepareStatement(columnSql)) {
            statement.setString(1, schema);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    List<Column> columns = map.get(result.getString("table_name"));
                    if (columns == null) continue;
                    columns.add(new Column(
                            result.getString("column_name"),
                            result.getBoolean("generated"),
                            result.getBoolean("identity_always"),
                            result.getBoolean("sequence_column")));
                }
            }
        }
        map.values().removeIf(columns -> columns.isEmpty() || columns.stream().allMatch(Column::generated));
        List<Table> tables = new ArrayList<>();
        map.forEach((name, columns) -> tables.add(new Table(name, columns)));
        return tables;
    }

    private static String copyOutSql(String schema, Table table) {
        String columns = table.columns().stream()
                .filter(column -> !column.generated())
                .map(column -> q(column.name()))
                .collect(Collectors.joining(", "));
        return "COPY (SELECT " + columns + " FROM " + table(schema, table.name())
                + ") TO STDOUT WITH (FORMAT csv, HEADER true)";
    }

    private static String copyInSql(String schema, String table, List<String> columns) {
        String names = columns.stream().map(CompanyDataResource::q).collect(Collectors.joining(", "));
        return "COPY " + table(schema, table) + " (" + names + ") FROM STDIN WITH (FORMAT csv, HEADER true)";
    }

    private static void resetSequence(Connection connection, String schema, Table table) throws SQLException {
        for (Column column : table.columns()) {
            if (!column.sequenceColumn()) continue;
            String sequence = null;
            try (PreparedStatement statement = connection.prepareStatement("select pg_get_serial_sequence(?, ?)")) {
                statement.setString(1, schema + "." + table.name());
                statement.setString(2, column.name());
                try (ResultSet result = statement.executeQuery()) {
                    if (result.next()) sequence = result.getString(1);
                }
            }
            if (sequence == null) continue;
            String tableRef = table(schema, table.name());
            String columnRef = q(column.name());
            String max = "(select max(" + columnRef + ") from " + tableRef + ")";
            String sql = "select setval('" + literal(sequence) + "', coalesce(" + max + ", 1), " + max + " is not null)";
            try (Statement statement = connection.createStatement()) {
                statement.execute(sql);
            }
        }
    }

    private static byte[] readEntry(ZipInputStream zip, int max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = zip.read(buffer)) > 0) {
            if (out.size() + read > max) throw new IOException("Manifest quá lớn");
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }


    private static String string(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static String objectString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static int number(Object value) {
        if (value == null) return -1;
        String digits = String.valueOf(value).replaceAll("\\D", "");
        try {
            return digits.isEmpty() ? -1 : Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private static String q(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private static String table(String schema, String table) {
        return q(schema) + "." + q(table);
    }

    private static String literal(String value) {
        return value.replace("'", "''");
    }

    private static String safe(String value) {
        return value == null ? "company" : value.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private static WebApplicationException problem(Response.Status status, String message) {
        return new WebApplicationException(Response.status(status)
                .entity(Map.of("message", message))
                .type(MediaType.APPLICATION_JSON)
                .build());
    }

    private record Column(String name, boolean generated, boolean identityAlways, boolean sequenceColumn) { }

    private record Table(String name, List<Column> columns) { }

    private record Stats(int tables, long rows) { }

    private record CompanyExportPlan(DmCongTy company, String schema, List<Table> tables, byte[] manifestBytes) { }

    private record VoucherSpec(String key, String module, String prefix, String table, String codeCol, String filterType) { }

    private static final List<VoucherSpec> VOUCHER_SPECS = List.of(
            new VoucherSpec("inv_import",       "inventory", "PN", "inv_doc",          "no",   "import"),
            new VoucherSpec("inv_export",       "inventory", "PX", "inv_doc",          "no",   "export"),
            new VoucherSpec("inv_return",       "inventory", "PT", "inv_doc",          "no",   "return"),
            new VoucherSpec("inv_transfer",     "inventory", "PC", "inv_doc",          "no",   "transfer"),
            new VoucherSpec("cash_receipt",     "cash",      "PT", "cash_vouchers",    "code", "receipt"),
            new VoucherSpec("cash_payment",     "cash",      "PC", "cash_vouchers",    "code", "payment"),
            new VoucherSpec("cash_exchange",    "cash",      "PD", "cash_vouchers",    "code", "exchange"),
            new VoucherSpec("bank_credit",      "bank",      "BC", "bank_vouchers",    "code", "credit"),
            new VoucherSpec("bank_debit",       "bank",      "BN", "bank_vouchers",    "code", "debit"),
            new VoucherSpec("bank_transfer",    "bank",      "LC", "bank_vouchers",    "code", "transfer"),
            new VoucherSpec("general_journal",  "general",   "PK", "general_vouchers", "code", "journal"),
            new VoucherSpec("general_offset",   "general",   "BT", "general_vouchers", "code", "offset"),
            new VoucherSpec("opening_balances", "opening",   "DK", "opening_balances", "code", null)
    );

    @GET
    @Path("/vouchers")
    @RolesAllowed("admin")
    public Map<String, Object> listVouchers(@QueryParam("companyId") String companyId) {
        String schema = resolveCompanySchema(companyId);
        try (Connection connection = dataSource.getConnection()) {
            List<Map<String, Object>> items = loadVoucherStats(connection, schema);
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("schemaName", schema);
            res.put("items", items);
            return res;
        } catch (SQLException e) {
            throw problem(Response.Status.BAD_REQUEST, "Không tải được danh sách phiếu: " + e.getMessage());
        }
    }

    @POST
    @Path("/vouchers/truncate")
    @RolesAllowed("admin")
    public Map<String, Object> truncateVouchers(Map<String, Object> body) {
        String companyId = body == null ? null : objectString(body.get("companyId"));
        Object rawTypes = body == null ? null : body.get("types");
        if (!(rawTypes instanceof List<?> typeList) || typeList.isEmpty()) {
            throw problem(Response.Status.BAD_REQUEST, "Chưa chọn loại phiếu cần xóa");
        }
        Set<String> selected = typeList.stream()
                .map(CompanyDataResource::objectString)
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.toCollection( java.util.LinkedHashSet::new));
        if (selected.isEmpty()) {
            throw problem(Response.Status.BAD_REQUEST, "Chưa chọn loại phiếu cần xóa");
        }
        Map<String, VoucherSpec> byKey = VOUCHER_SPECS.stream()
                .collect(Collectors.toMap(VoucherSpec::key, s -> s));
        for (String key : selected) {
            if (!byKey.containsKey(key)) {
                throw problem(Response.Status.BAD_REQUEST, "Loại phiếu không hợp lệ: " + key);
            }
        }

        String schema = resolveCompanySchema(companyId);
        long deleted = 0;
        boolean touchedInv = false;
        boolean touchedGeneral = false;

        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                for (String key : selected) {
                    VoucherSpec spec = byKey.get(key);
                    String tbl = table(schema, spec.table());
                    if (spec.filterType() != null) {
                        try (PreparedStatement ps = connection.prepareStatement(
                                "DELETE FROM " + tbl + " WHERE type = ?")) {
                            ps.setString(1, spec.filterType());
                            deleted += ps.executeUpdate();
                        }
                        if ("inv_doc".equals(spec.table())) {
                            touchedInv = true;
                            try (PreparedStatement ps = connection.prepareStatement(
                                    "UPDATE " + table(schema, "inv_doc_counter") + " SET last_no = 0 WHERE type = ?")) {
                                ps.setString(1, spec.filterType());
                                ps.executeUpdate();
                            }
                        } else if ("general_vouchers".equals(spec.table())) {
                            touchedGeneral = true;
                        }
                    } else {
                        try (Statement st = connection.createStatement()) {
                            deleted += st.executeUpdate("DELETE FROM " + tbl);
                        }
                    }
                }

                if (touchedInv && countRows(connection, table(schema, "inv_doc"), null) == 0) {
                    try (Statement st = connection.createStatement()) {
                        st.executeUpdate("DELETE FROM " + table(schema, "stock_balances"));
                    }
                    resetTableSequences(connection, schema, "inv_doc");
                    resetTableSequences(connection, schema, "inv_doc_line");
                }
                if (touchedGeneral && countRows(connection, table(schema, "general_vouchers"), null) == 0) {
                    resetTableSequences(connection, schema, "general_voucher_lines");
                }

                List<Map<String, Object>> items = loadVoucherStats(connection, schema);
                connection.commit();

                Map<String, Object> res = new LinkedHashMap<>();
                res.put("schemaName", schema);
                res.put("deleted", deleted);
                res.put("types", selected.size());
                res.put("items", items);
                return res;
            } catch (Exception e) {
                try { connection.rollback(); } catch (SQLException ignored) { }
                throw e;
            }
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            throw problem(Response.Status.BAD_REQUEST, "Không thể xóa dữ liệu phiếu: " + e.getMessage());
        }
    }

    private String resolveCompanySchema(String companyId) {
        if (companyId == null || companyId.isBlank() || "public".equalsIgnoreCase(companyId.trim())) {
            return "public";
        }
        try {
            DmCongTy company = find(Long.valueOf(companyId.trim()));
            provisioner.ensureMigrated(company.schemaName);
            return company.schemaName;
        } catch (NumberFormatException e) {
            throw problem(Response.Status.BAD_REQUEST, "Công ty không hợp lệ");
        }
    }

    private List<Map<String, Object>> loadVoucherStats(Connection connection, String schema) throws SQLException {
        List<Map<String, Object>> list = new ArrayList<>();
        for (VoucherSpec spec : VOUCHER_SPECS) {
            String tbl = table(schema, spec.table());
            long count = countRows(connection, tbl, spec.filterType());
            List<String> samples = sampleCodes(connection, tbl, spec.codeCol(), spec.filterType());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("key", spec.key());
            row.put("module", spec.module());
            row.put("prefix", spec.prefix());
            row.put("table", spec.table());
            row.put("count", count);
            row.put("samples", samples);
            list.add(row);
        }
        return list;
    }

    private static long countRows(Connection connection, String tableRef, String filterType) throws SQLException {
        String sql = "SELECT COUNT(*) FROM " + tableRef + (filterType != null ? " WHERE type = ?" : "");
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            if (filterType != null) ps.setString(1, filterType);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong(1) : 0L;
            }
        }
    }

    private static List<String> sampleCodes(Connection connection, String tableRef, String codeCol, String filterType) throws SQLException {
        String col = q(codeCol);
        String sql = "SELECT " + col + " FROM " + tableRef
                + (filterType != null ? " WHERE type = ?" : "")
                + " ORDER BY " + col + " DESC LIMIT 5";
        List<String> codes = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            if (filterType != null) ps.setString(1, filterType);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String c = rs.getString(1);
                    if (c != null && !c.isBlank()) codes.add(c);
                }
            }
        }
        return codes;
    }

    private static void resetTableSequences(Connection connection, String schema, String tableName) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("SELECT pg_get_serial_sequence(?, 'id')")) {
            ps.setString(1, schema + "." + tableName);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next() && rs.getString(1) != null) {
                    String seq = rs.getString(1);
                    try (Statement st = connection.createStatement()) {
                        st.execute("SELECT setval('" + literal(seq) + "', 1, false)");
                    }
                }
            }
        }
    }
}
