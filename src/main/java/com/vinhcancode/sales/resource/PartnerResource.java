package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Partner;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Path("/partners")
public class PartnerResource extends MasterResource<Partner> {
    protected Class<Partner> type() { return Partner.class; }
    protected List<String> searchFields() { return List.of("code", "name", "phone", "address"); }
    protected String codePrefix() { return "DT"; }

    @Override protected void applyFilters(MultivaluedMap<String, String> f, Where w) {
        String k = first(f, "kind");
        if (k != null) w.and("e.kind = :kind", "kind", k);
    }
    @Override protected Map<String, String> sortable() {
        return Map.of("code", "e.code", "name", "e.name", "phone", "e.phone",
                "address", "e.address", "kind", "e.kind");
    }
    @Override protected void validate(Partner p) {
        super.validate(p);
        if (p.kind != null && !Set.of("customer", "supplier", "both", "other").contains(p.kind))
            throw bad("Loại đối tượng không hợp lệ");
    }
    @Override protected void normalize(Partner p) {
        if (p.kind == null || p.kind.isBlank()) p.kind = "other";
    }
}
