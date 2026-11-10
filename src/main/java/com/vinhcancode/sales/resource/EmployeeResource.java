package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Employee;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Map;

@Path("/employees")
public class EmployeeResource extends MasterResource<Employee> {
    protected Class<Employee> type() { return Employee.class; }
    protected List<String> searchFields() { return List.of("code", "name", "phone", "email", "position"); }
    protected String codePrefix() { return "NV"; }

    @Override protected void applyFilters(MultivaluedMap<String, String> f, Where w) {
        String dep = first(f, "departmentId");
        if (dep != null) w.and("e.departmentId = :dep", "dep", dep);
    }
    @Override protected Map<String, String> sortable() {
        return Map.of("code", "e.code", "name", "e.name", "phone", "e.phone",
                "email", "e.email", "position", "e.position");
    }
    @Override protected void normalize(Employee e) {
        if (e.departmentId != null && e.departmentId.isBlank()) e.departmentId = null;
    }
}
