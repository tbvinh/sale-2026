package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Department;
import jakarta.ws.rs.Path;
import java.util.List;
import java.util.Map;

@Path("/departments")
public class DepartmentResource extends MasterResource<Department> {
    protected Class<Department> type() { return Department.class; }
    protected List<String> searchFields() { return List.of("code", "name", "manager", "phone"); }
    protected String codePrefix() { return "PB"; }
    @Override protected Map<String, String> sortable() {
        return Map.of("code", "e.code", "name", "e.name", "manager", "e.manager", "phone", "e.phone");
    }
}
