package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Permission;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

@Path("/permissions")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("admin")
public class PermissionResource {

    @GET
    public List<Permission> list() {
        return Permission.list("order by module, action");
    }
}
