/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Account;
import com.vinhcancode.sales.entity.Material;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Map;

/**
 *
 * @author tbvin
 */
@Path("/materials")
public class MaterialResource extends MasterResource<Material> {
    protected Class<Material> type() { return Material.class; }
    protected List<String> searchFields() { return List.of("code", "name"); }
    protected String codePrefix() { return "VT"; }

    // Join loại vật tư để sắp xếp theo tên loại (sort=typeName)
    @Override protected String from() { return "from Material e left join MaterialType t on t.id = e.typeId"; }
    @Override protected Map<String, String> sortable() {
        return Map.of("code", "e.code", "name", "e.name", "unit", "e.unit", "price", "e.price", "typeName", "t.name");
    }
    @Override protected void applyFilters(MultivaluedMap<String, String> f, Where w) {
        String type = first(f, "typeId");
        if (type != null) w.and("e.typeId = :typeId", "typeId", type);
        String min = first(f, "priceMin");
        if (min != null) w.and("e.price >= :pmin", "pmin", Long.parseLong(min));
        String max = first(f, "priceMax");
        if (max != null) w.and("e.price <= :pmax", "pmax", Long.parseLong(max));
    }
    @Override protected void normalize(Material m) {
        if (m.typeId != null && m.typeId.isBlank()) m.typeId = null;    // <select> "--" gửi chuỗi rỗng
        if (m.unit != null && m.unit.isBlank()) m.unit = null;
    }
}
