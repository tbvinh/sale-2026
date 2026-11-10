/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Bank;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Map;

/**
 *
 * @author tbvin
 */
@Path("/banks")
public class BankResource extends MasterResource<Bank> {
    protected Class<Bank> type() { return Bank.class; }
    protected List<String> searchFields() { return List.of("code", "name", "branch"); }
    protected boolean codeRequired() { return true; }
    protected void applyFilters(MultivaluedMap<String, String> f, Where w) {
        String b = first(f, "branch");
        if (b != null) w.and("lower(e.branch) like :branch", "branch", "%" + b.toLowerCase() + "%");
    }
    @Override protected Map<String, String> sortable() { return Map.of("code", "e.code", "name", "e.name", "branch", "e.branch"); }
}
