package com.vinhcancode.sales.tenant;

import io.quarkus.hibernate.orm.PersistenceUnitExtension;
import io.quarkus.hibernate.orm.runtime.tenant.TenantResolver;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.jwt.JsonWebToken;

/** Resolver schema tenant tu header hoac JWT claim; mac dinh la public. */
@PersistenceUnitExtension
@RequestScoped
public class CompanyTenantResolver implements TenantResolver {

    @Inject
    TenantContext context;

    @Inject
    TenantRegistry registry;

    @Inject
    JsonWebToken jwt;

    @Override
    public String getDefaultTenantId() {
        return "public";
    }

    @Override
    public String resolveTenantId() {
        if (context.getSchema() != null) return context.getSchema();

        String company = context.getCompanyId();
        if (company == null) company = claim("company_id");
        if (company == null) company = claim("tenant_id");
        if (company == null) company = claim("company");

        String schema = company == null ? "public" : registry.resolveSchema(company);
        context.setSchema(schema);
        return schema;
    }

    private String claim(String name) {
        try {
            Object value = jwt.getClaim(name);
            return value == null ? null : value.toString();
        } catch (RuntimeException ignored) {
            return null;
        }
    }
}
