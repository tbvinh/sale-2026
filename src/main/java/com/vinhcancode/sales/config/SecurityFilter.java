/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.config;

import com.vinhcancode.sales.entity.User;
import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Cookie;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;

@Provider
@Priority(Priorities.AUTHENTICATION)
public class SecurityFilter implements ContainerRequestFilter {

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        String path = requestContext.getUriInfo().getPath();
        
        // Log chuỗi path ra console để debug
        System.out.println("===> Request Path nhận được: " + path);

        // Chuẩn hóa path: xóa dấu / ở đầu nếu có
        String cleanPath = path.startsWith("/") ? path.substring(1) : path;
        // Bỏ qua kiểm tra Cookie nếu đường dẫn chứa "auth"
        if (cleanPath.contains("auth") || cleanPath.contains("public")) {
            return; // Cho phép đi tiếp
        }
        

        // Lấy cookie có tên là "token"
        Cookie tokenCookie = requestContext.getCookies().get("token");

        if (tokenCookie == null || tokenCookie.getValue().isEmpty()) {
            requestContext.abortWith(Response.status(Response.Status.UNAUTHORIZED)
                    .entity("{\"error\": \"Chưa đăng nhập hoặc thiếu Cookie Token\"}")
                    .build());
            return;
        }

        String token = tokenCookie.getValue();

        // Kiểm tra token trong DB
//        User user = User.findByToken(token);
//        if (user == null) {
//            requestContext.abortWith(Response.status(Response.Status.UNAUTHORIZED)
//                    .entity("{\"error\": \"Token không hợp lệ\"}")
//                    .build());
//        }
    }
}