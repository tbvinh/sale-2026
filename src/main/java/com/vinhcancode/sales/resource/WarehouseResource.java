/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Warehouse;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Map;

/**
 *
 * @author tbvin
 */
@Path("/warehouses")
public class WarehouseResource extends MasterResource<Warehouse> {
    protected Class<Warehouse> type() { return Warehouse.class; }
    protected List<String> searchFields() { return List.of("code", "name", "address"); }
    protected String codePrefix() { return "KHO"; }
    @Override protected void applyFilters(MultivaluedMap<String, String> f, Where w) {
        String a = first(f, "address");
        if (a != null) w.and("lower(e.address) like :addr", "addr", "%" + a.toLowerCase() + "%");
    }
    @Override protected Map<String, String> sortable() { return Map.of("code", "e.code", "name", "e.name", "address", "e.address"); }
}
