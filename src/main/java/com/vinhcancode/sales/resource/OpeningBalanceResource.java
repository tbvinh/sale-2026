package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.OpeningBalance;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Path("/opening-balances")
public class OpeningBalanceResource extends MasterResource<OpeningBalance> {
    protected Class<OpeningBalance> type() { return OpeningBalance.class; }
    protected List<String> searchFields() { return List.of("code", "name"); }
    protected String codePrefix() { return "DK"; }
    @Override protected String module() { return "opening"; }

    @Override protected Map<String, String> sortable() {
        return Map.of("code", "e.code", "name", "e.name", "kind", "e.kind", "amount", "e.amount",
                "quantity", "e.quantity", "unitPrice", "e.unitPrice", "dueDate", "e.dueDate");
    }

    @Override protected void applyFilters(MultivaluedMap<String, String> f, Where w) {
        String kind = first(f, "kind");
        if (kind != null) w.and("e.kind = :kind", "kind", kind);
        String direction = first(f, "direction");
        if (direction != null) w.and("e.direction = :direction", "direction", direction);
    }

    @Override protected void validate(OpeningBalance e) {
        super.validate(e);
        if (blank(e.kind)) e.kind = "material";
    }

    @Override protected void normalize(OpeningBalance e) {
        if (blank(e.kind)) e.kind = "material";
        e.partnerId = blank(e.partnerId) ? null : e.partnerId;
        e.bankId = blank(e.bankId) ? null : e.bankId;
        e.accountId = blank(e.accountId) ? null : e.accountId;
        e.materialId = blank(e.materialId) ? null : e.materialId;
        e.employeeId = blank(e.employeeId) ? null : e.employeeId;
        if (blank(e.direction)) e.direction = defaultDirection(e.kind);
        if (e.quantity < 0) e.quantity = 0;
        if (e.unitPrice < 0) e.unitPrice = 0;
        if (e.amount < 0) e.amount = 0;
        if (e.amount == 0 && e.quantity > 0 && e.unitPrice > 0) e.amount = e.quantity * e.unitPrice;
        if (e.interestRate == null || e.interestRate.signum() < 0) e.interestRate = BigDecimal.ZERO;
    }

    private static String defaultDirection(String kind) {
        if (kind == null) return null;
        return switch (kind) {
            case "debt" -> "receivable";
            case "loan" -> "credit";
            default -> "debit";
        };
    }
}
