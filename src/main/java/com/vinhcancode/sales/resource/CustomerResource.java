/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Customer;
import com.vinhcancode.sales.entity.Supplier;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Map;

/**
 *
 * @author tbvin
 */
@Path("/customers")
public class CustomerResource extends MasterResource<Customer> {
    protected Class<Customer> type() { return Customer.class; }
    protected List<String> searchFields() { return List.of("code", "name", "address"); }
    protected String codePrefix() { return "KH"; }
    protected void applyFilters(MultivaluedMap<String, String> f, Where w) { SupplierResource.phoneFilter(f, w); }
    @Override protected Map<String, String> sortable() { return Map.of("code", "e.code", "name", "e.name", "phone", "e.phone", "address", "e.address"); }
}
