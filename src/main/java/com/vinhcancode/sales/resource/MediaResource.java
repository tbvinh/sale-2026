package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.tenant.TenantContext;
import com.vinhcancode.sales.tenant.TenantRegistry;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

/** Upload media theo tenant: /app/uploads/{company_code}/{type}/{uuid_filename.ext}. */
@Path("/media")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class MediaResource {

    private static final Set<String> TYPES = Set.of("products", "users", "catalogs", "samples");
    private static final Set<String> EXTENSIONS = Set.of("svg", "png", "jpg", "jpeg", "gif", "webp", "bmp");
    private static final long MAX_SIZE = 10L * 1024 * 1024;

    @Inject
    TenantContext tenant;

    @Inject
    TenantRegistry registry;

    @Inject
    JsonWebToken jwt;

    @ConfigProperty(name = "media.upload-dir", defaultValue = "./uploads")
    String uploadDir;

    @POST
    @Path("/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Map<String, Object> upload(@RestForm("file") FileUpload file,
                                      @RestForm("type") String type) {
        if (file == null) throw bad("Chưa chọn tệp tin");
        if (file.size() <= 0) throw bad("Tệp tin rỗng");
        if (file.size() > MAX_SIZE) throw tooLarge();

        String kind = type == null || type.isBlank() ? "products" : type.trim().toLowerCase(Locale.ROOT);
        if (!TYPES.contains(kind)) throw bad("Loại media không hợp lệ");

        String original = file.fileName() == null ? "media" : file.fileName();
        String extension = extension(original);
        if (!EXTENSIONS.contains(extension)) throw bad("Chỉ hỗ trợ ảnh SVG, PNG, JPG, GIF, WEBP, BMP");

        String company = safeSegment(registry.resolveCompanyCode(companyRef()));
        java.nio.file.Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        java.nio.file.Path directory = root.resolve(company).resolve(kind).normalize();
        if (!directory.startsWith(root)) throw bad("Đường dẫn không hợp lệ");
        java.nio.file.Path target = directory.resolve(UUID.randomUUID() + "_" + baseName(original) + "." + extension).normalize();

        try {
            Files.createDirectories(directory);
            Files.copy(file.uploadedFile(), target, StandardCopyOption.REPLACE_EXISTING);
            Files.setPosixFilePermissions(target, PosixFilePermissions.fromString("rw-r--r--"));
        } catch (UnsupportedOperationException ignored) {
            // Windows/không hỗ trợ POSIX: bỏ qua
        } catch (IOException e) {
            throw new WebApplicationException(Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("message", "Không lưu được tệp tin"))
                    .type(MediaType.APPLICATION_JSON)
                    .build());
        }

        String url = "/uploads/" + company + "/" + kind + "/" + target.getFileName();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("url", url);
        body.put("company", company);
        body.put("type", kind);
        body.put("filename", target.getFileName().toString());
        body.put("size", file.size());
        body.put("contentType", file.contentType());
        return body;
    }

    private String companyRef() {
        String company = tenant.getCompanyId();
        if (company == null || company.isBlank()) company = claim("company_id");
        if (company == null || company.isBlank()) company = claim("tenant_id");
        if (company == null || company.isBlank()) company = claim("company");
        return company;
    }

    private String claim(String name) {
        try {
            Object value = jwt.getClaim(name);
            return value == null ? null : value.toString();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 || dot == filename.length() - 1
                ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String baseName(String filename) {
        int dot = filename.lastIndexOf('.');
        String base = dot <= 0 ? filename : filename.substring(0, dot);
        String safe = base.replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^[._-]+|[._-]+$", "");
        if (safe.isBlank()) safe = "media";
        return safe.length() > 80 ? safe.substring(0, 80) : safe;
    }

    private static String safeSegment(String value) {
        if (value == null || value.isBlank() || ".".equals(value) || "..".equals(value)) return "public";
        String safe = value.trim().replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^[._-]+|[._-]+$", "");
        if (safe.isBlank()) return "public";
        return safe.length() > 60 ? safe.substring(0, 60) : safe;
    }

    private static BadRequestException bad(String message) {
        return new BadRequestException(Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("message", message))
                .type(MediaType.APPLICATION_JSON)
                .build());
    }

    private static WebApplicationException tooLarge() {
        return new WebApplicationException(Response.status(Response.Status.REQUEST_ENTITY_TOO_LARGE)
                .entity(Map.of("message", "Ảnh tối đa 10 MB"))
                .type(MediaType.APPLICATION_JSON)
                .build());
    }
}
