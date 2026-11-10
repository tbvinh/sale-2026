package com.vinhcancode.sales.tenant;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import java.util.Set;
import org.eclipse.microprofile.jwt.JsonWebToken;

/** Doc X-Company-Id / X-Tenant-Id, kiem tra quyen cong ty cua user truoc khi Hibernate mo session. */
@Provider
@Priority(Priorities.AUTHENTICATION + 10)
public class TenantFilter implements ContainerRequestFilter {

    @Inject
    TenantContext context;

    @Inject
    TenantRegistry registry;

    @Inject
    JsonWebToken jwt;

    @Override
    public void filter(ContainerRequestContext request) {
        String path = request.getUriInfo().getPath();
        if (path.startsWith("/")) path = path.substring(1);
        if (path.startsWith("auth") || path.startsWith("companies") || path.startsWith("company/")) return;

        String company = request.getHeaderString("X-Company-Id");
        if (company == null || company.isBlank()) {
            company = request.getHeaderString("X-Tenant-Id");
        }

        String username = jwt != null ? jwt.getName() : null;
        Set<String> groups = jwt != null ? jwt.getGroups() : null;
        boolean isSystemAdmin = groups != null && groups.contains("admin");

        String effectiveCompany = registry.resolveAllowedCompany(username, isSystemAdmin, company);
        context.setCompanyId(effectiveCompany);
        if (effectiveCompany != null && !effectiveCompany.isBlank()) {
            context.setSchema(registry.resolveSchema(effectiveCompany));
        }
    }
}
