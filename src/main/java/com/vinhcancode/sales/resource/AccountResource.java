/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Account;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Map;

/**
 *
 * @author tbvin
 */
@Path("/accounts")
public class AccountResource extends MasterResource<Account> {
    protected Class<Account> type() { return Account.class; }
    protected List<String> searchFields() { return List.of("code", "name"); }
    protected boolean codeRequired() { return true; }
    protected void applyFilters(MultivaluedMap<String, String> f, Where w) {
        String g = first(f, "group");                                   // nhóm theo chữ số đầu: 1xx … 9xx
        if (g != null) w.and("e.code like :grp", "grp", g + "%");
    }
}

