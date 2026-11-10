package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.entity.Role;
import com.vinhcancode.sales.service.AdminService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/roles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RoleResource {

    @Inject
    AdminService adminService;

    @Inject
    JsonWebToken jwt;

    @GET
    @RolesAllowed({"admin", "company_admin"})
    public List<Map<String, Object>> list() {
        Set<String> groups = jwt.getGroups();
        boolean isSystemAdmin = groups != null && groups.contains("admin");
        return adminService.listRoles(isSystemAdmin);
    }

    @POST
    @RolesAllowed("admin")
    public Response create(Role role) {
        return Response.status(Response.Status.CREATED).entity(adminService.createRole(role)).build();
    }

    @PUT
    @Path("/{id}")
    @RolesAllowed("admin")
    public Role update(@PathParam("id") Long id, Role role) {
        return adminService.updateRole(id, role);
    }

    @DELETE
    @Path("/{id}")
    @RolesAllowed("admin")
    public Response delete(@PathParam("id") Long id) {
        adminService.deleteRole(id);
        return Response.noContent().build();
    }

    @GET
    @Path("/{id}/permissions")
    @RolesAllowed({"admin", "company_admin"})
    public Map<String, Map<String, Boolean>> permissions(@PathParam("id") Long id) {
        return adminService.rolePermissions(id);
    }

    @PUT
    @Path("/{id}/permissions")
    @RolesAllowed("admin")
    public Response savePermissions(@PathParam("id") Long id, Map<String, Map<String, Boolean>> permissions) {
        adminService.saveRolePermissions(id, permissions);
        return Response.noContent().build();
    }
}
