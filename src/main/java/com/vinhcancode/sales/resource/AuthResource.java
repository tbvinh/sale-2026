package com.vinhcancode.sales.resource; // Thay đúng package của bạn

import com.vinhcancode.sales.dto.AuthRequest;
import com.vinhcancode.sales.dto.AuthResponse;
import com.vinhcancode.sales.entity.Role;
import com.vinhcancode.sales.entity.User;
import com.vinhcancode.sales.service.AdminService;
import com.vinhcancode.sales.service.AuthService;
import com.vinhcancode.sales.service.PermissionService;
import jakarta.annotation.security.RolesAllowed;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    @Inject
    JsonWebToken jwt;

    @Inject
    AuthService authService;

    @Inject
    PermissionService permissionService;

    @Inject
    AdminService adminService;

    @POST
    @Path("/register")
    public Response register(AuthRequest request) {
        User user = authService.register(request);

        // Đính kèm .entity(user) để trả về thông tin sau khi lưu
        return Response.status(Response.Status.CREATED)
                .entity(user)
                .build();
    }

    // Endpoint Đăng nhập
    @POST
    @Path("/login")
    public Response login(AuthRequest request) {
        AuthResponse response = authService.login(request);
        return Response.ok(response).build();
    }

    @POST
    @Path("/loginv1")
    public Response loginv1(AuthRequest request) {
        // 1. Lấy token từ service
        String token = authService.generateToken(request);

        // 2. Tạo HttpOnly Cookie
        NewCookie authCookie = new NewCookie.Builder("token")
                .value(token)
                .path("/") // Có hiệu lực trên toàn bộ domain
                .httpOnly(true) // Ngăn JS đọc cookie (Chống XSS)
                .secure(false) // Đặt là true nếu chạy HTTPS (dev HTTP thì dùng false)
                .sameSite(NewCookie.SameSite.LAX) // Chống tấn công CSRF
                .maxAge(86400) // Thời gian sống: 1 ngày (tính bằng giây)
                .build();

        // 3. Trả về response kèm cookie và thông tin user cơ bản (không trả token trong body nữa)
        return Response.ok("{\"message\": \"Đăng nhập thành công\"}")
                .cookie(authCookie)
                .build();
    }

    @GET
    @Path("/me")
    @Produces(MediaType.APPLICATION_JSON)
    @RolesAllowed({"admin", "user"})
    public Response me() {
        String username = jwt.getName();                       // lấy từ upn
        Set<String> groups = jwt.getGroups();
        String role = groups != null && groups.contains("admin") ? "admin" : "user";
        User user = User.findByUsername(username);
        if (user != null) {
            adminService.populateUserCompanies(List.of(user));
        }
        String name = user != null && user.fullName != null && !user.fullName.isBlank()
                ? user.fullName
                : jwt.getClaim("name");
        String roleCode = user != null && user.role != null && !user.role.isBlank() ? user.role : role;
        Role roleEntity = Role.findByCode(roleCode);
        boolean isSystemAdmin = "admin".equalsIgnoreCase(role) || "admin".equalsIgnoreCase(roleCode);
        boolean allowPublic = isSystemAdmin || (user != null && Boolean.TRUE.equals(user.allowPublic));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("username", username);
        body.put("name", name != null && !name.isBlank() ? name : username);
        body.put("imageUrl", user != null ? user.imageUrl : null);
        body.put("role", role);
        body.put("roleCode", roleCode);
        body.put("roleName", roleEntity != null ? roleEntity.name : null);
        body.put("allowPublic", allowPublic);
        body.put("defaultCompanyId", user != null ? user.defaultCompanyId : null);
        body.put("allowedCompanyIds", user != null && user.companyIds != null ? user.companyIds : Collections.emptyList());
        body.put("ownerCompanyIds", user != null && user.ownerCompanyIds != null ? user.ownerCompanyIds : Collections.emptyList());
        body.put("companies", user != null && user.companies != null ? user.companies : Collections.emptyList());
        body.put("permissions", permissionService.effective(username, isSystemAdmin));
        return Response.ok(body).build();
    }

    @POST
    @Path("/logout")
    public Response logout() {
        // Xóa cookie bằng cách set maxAge = 0
        NewCookie expired = new NewCookie.Builder("token")
                .value("")
                .path("/")
                .httpOnly(true)
                .secure(false) // true khi chạy HTTPS
                .sameSite(NewCookie.SameSite.LAX)
                .maxAge(0)
                .build();

        return Response.ok("{\"message\": \"Đăng xuất thành công\"}").cookie(expired).build();
    }

    private Response unauthorized(String message) {
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity(Map.of("message", message))
                .type(MediaType.APPLICATION_JSON)
                .build();
    }


}
