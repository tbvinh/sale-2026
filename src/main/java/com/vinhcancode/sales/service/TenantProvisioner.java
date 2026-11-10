package com.vinhcancode.sales.service;

import io.agroal.api.AgroalDataSource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import org.flywaydb.core.Flyway;

/** Tao/xoa schema tenant va chay migration cho schema do. */
@ApplicationScoped
public class TenantProvisioner {

    @Inject
    AgroalDataSource dataSource;

    public void createSchema(String schema) {
        execute("CREATE SCHEMA IF NOT EXISTS " + quote(schema));
    }

    public void dropSchema(String schema) {
        execute("DROP SCHEMA IF EXISTS " + quote(schema) + " CASCADE");
    }

    public void migrate(String schema) {
        flyway(schema).migrate();
    }

    /** Dam bao schema da duoc tao va chay du cac migration moi nhat. */
    public void ensureMigrated(String schema) {
        if (schema == null || schema.isBlank() || "public".equalsIgnoreCase(schema)) return;
        createSchema(schema);
        if (versionNumber(currentVersion(schema)) < versionNumber(latestVersion())) {
            migrate(schema);
        }
    }

    /** Phien ban migration da ap dung trong schema (vd. "00017"). */
    public String currentVersion(String schema) {
        org.flywaydb.core.api.MigrationInfo current = flyway(schema).info().current();
        return current == null || current.getVersion() == null ? "0" : current.getVersion().getVersion();
    }

    /** Phien ban migration moi nhat co trong classpath. */
    public String latestVersion() {
        org.flywaydb.core.api.MigrationInfo[] all = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .initSql("SET search_path = public")
                .cleanDisabled(true)
                .load()
                .info()
                .all();
        String latest = "0";
        for (org.flywaydb.core.api.MigrationInfo info : all) {
            if (info.getVersion() != null && versionNumber(info.getVersion().getVersion()) > versionNumber(latest)) {
                latest = info.getVersion().getVersion();
            }
        }
        return latest;
    }

    public static int versionNumber(String version) {
        if (version == null || version.isBlank()) return 0;
        String digits = version.replaceAll("\\D", "");
        try {
            return digits.isEmpty() ? 0 : Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private Flyway flyway(String schema) {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .schemas(schema)
                .defaultSchema(schema)
                .initSql("SET search_path = public")
                .cleanDisabled(true)
                .load();
    }

    private void execute(String sql) {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String quote(String schema) {
        return '"' + schema.replace("\"", "\"\"") + '"';
    }
}
