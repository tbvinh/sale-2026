package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Unit;
import jakarta.ws.rs.Path;
import java.util.List;
import java.util.Map;

@Path("/units")
public class UnitResource extends MasterResource<Unit> {
    protected Class<Unit> type() { return Unit.class; }
    protected List<String> searchFields() { return List.of("code", "name"); }
    protected String codePrefix() { return "DVT"; }
    @Override protected Map<String, String> sortable() {
        return Map.of("code", "e.code", "name", "e.name");
    }
}
