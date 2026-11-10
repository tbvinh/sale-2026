/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Supplier;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Map;

/**
 *
 * @author tbvin
 */
@Path("/suppliers")
public class SupplierResource extends MasterResource<Supplier> {
    protected Class<Supplier> type() { return Supplier.class; }
    protected List<String> searchFields() { return List.of("code", "name", "address"); }
    protected String codePrefix() { return "NCC"; }
    protected void applyFilters(MultivaluedMap<String, String> f, Where w) { phoneFilter(f, w); }
    static void phoneFilter(MultivaluedMap<String, String> f, Where w) {
        String p = first(f, "phone");
        if ("has".equals(p)) w.and("(e.phone is not null and e.phone <> '')");
        else if ("none".equals(p)) w.and("(e.phone is null or e.phone = '')");
    }
    @Override protected Map<String, String> sortable() { return Map.of("code", "e.code", "name", "e.name", "phone", "e.phone", "address", "e.address"); }
}

