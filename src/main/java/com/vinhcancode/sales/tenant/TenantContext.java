package com.vinhcancode.sales.tenant;

import jakarta.enterprise.context.RequestScoped;

/** Giu cong ty/schema cua request hien tai. */
@RequestScoped
public class TenantContext {

    private String companyId;
    private String schema;

    public String getCompanyId() {
        return companyId;
    }

    public void setCompanyId(String companyId) {
        this.companyId = companyId == null || companyId.isBlank() ? null : companyId.trim();
    }

    public String getSchema() {
        return schema;
    }

    public void setSchema(String schema) {
        this.schema = schema == null || schema.isBlank() ? null : schema.trim();
    }
}
