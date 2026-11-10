/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.MaterialType;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MultivaluedMap;
import java.util.List;
import java.util.Map;

/**
 *
 * @author tbvin
 */
@Path("/material-types")
public class MaterialTypeResource extends MasterResource<MaterialType> {
    protected Class<MaterialType> type() { return MaterialType.class; }
    protected List<String> searchFields() { return List.of("name"); }
}

