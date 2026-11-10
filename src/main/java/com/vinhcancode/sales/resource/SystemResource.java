package com.vinhcancode.sales.resource;

import io.agroal.api.AgroalDataSource;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/system")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated                                   // CS-S1
public class SystemResource {

    @Inject
    AgroalDataSource dataSource;

    @ConfigProperty(name = "quarkus.application.name", defaultValue = "quarkus-app")
    String appName;

    @ConfigProperty(name = "quarkus.application.version", defaultValue = "dev")
    String appVersion;

    @GET
    @Path("/info")
    public Map<String, String> info() {
        String dbName = "n/a";
        String dbVersion = "n/a";
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData meta = connection.getMetaData();
            dbName = connection.getCatalog();
            dbVersion = meta.getDatabaseProductName() + " " + meta.getDatabaseProductVersion();
        } catch (SQLException ignored) {
            // DB chưa sẵn sàng: vẫn trả thông tin app để status bar không vỡ
        }
        Map<String, String> info = new LinkedHashMap<>();
        info.put("appName", appName);
        info.put("appVersion", appVersion);
        info.put("dbName", dbName != null ? dbName : "n/a");
        info.put("dbVersion", dbVersion);
        return info;
    }
}
