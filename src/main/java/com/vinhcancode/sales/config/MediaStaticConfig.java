package com.vinhcancode.sales.config;

import io.vertx.core.http.HttpMethod;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Phục vụ trực tiếp thư mục uploads qua đường dẫn /uploads/* khi chạy mvn quarkus:dev
 * (khi chỉ chạy container postgres mà không chạy container nginx).
 */
@ApplicationScoped
public class MediaStaticConfig {

    private static final String PREFIX = "/uploads/";
    private static final Map<String, String> MIME_TYPES = Map.of(
            "svg", "image/svg+xml",
            "png", "image/png",
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg",
            "gif", "image/gif",
            "webp", "image/webp",
            "bmp", "image/bmp"
    );

    @ConfigProperty(name = "media.upload-dir", defaultValue = "./uploads")
    String uploadDir;

    void init(@Observes Router router) {
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException ignored) {
        }
        router.route(HttpMethod.GET, "/uploads/*").handler(ctx -> serveUpload(ctx, root));
        router.route(HttpMethod.HEAD, "/uploads/*").handler(ctx -> serveUpload(ctx, root));
    }

    private void serveUpload(RoutingContext ctx, Path root) {
        String rawPath = ctx.normalizedPath();
        if (rawPath == null || !rawPath.startsWith(PREFIX)) {
            ctx.response().setStatusCode(404).end();
            return;
        }
        String relative = URLDecoder.decode(rawPath.substring(PREFIX.length()), StandardCharsets.UTF_8);
        if (relative.isBlank()) {
            ctx.response().setStatusCode(404).end();
            return;
        }
        Path target = root.resolve(relative).normalize();
        if (!target.startsWith(root) || !Files.isRegularFile(target)) {
            ctx.response().setStatusCode(404).end();
            return;
        }

        String contentType = contentType(target);
        if (contentType != null) {
            ctx.response().putHeader("Content-Type", contentType);
        }
        ctx.response()
                .putHeader("Cache-Control", "public, max-age=2592000")
                .putHeader("X-Content-Type-Options", "nosniff")
                .sendFile(target.toString());
    }

    private static String contentType(Path file) {
        String name = file.getFileName().toString();
        int dot = name.lastIndexOf('.');
        if (dot >= 0 && dot < name.length() - 1) {
            String ext = name.substring(dot + 1).toLowerCase(Locale.ROOT);
            String mapped = MIME_TYPES.get(ext);
            if (mapped != null) {
                return mapped;
            }
        }
        try {
            return Files.probeContentType(file);
        } catch (IOException ignored) {
            return "application/octet-stream";
        }
    }
}
