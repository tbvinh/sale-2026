package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.dto.UserRequest;
import com.vinhcancode.sales.entity.User;
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
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({"admin", "company_admin"})
public class UserResource {

    @Inject
    AdminService adminService;

    @Inject
    JsonWebToken jwt;

    private boolean isSystemAdmin() {
        Set<String> groups = jwt.getGroups();
        return groups != null && groups.contains("admin");
    }

    @GET
    public Map<String, Object> list(@QueryParam("q") String q,
                                    @QueryParam("role") String role,
                                    @QueryParam("page") Integer page,
                                    @QueryParam("pageSize") Integer pageSize) {
        return adminService.listUsers(q, role, page, pageSize, jwt.getName(), isSystemAdmin());
    }

    @GET
    @Path("/{id}")
    public User get(@PathParam("id") Long id) {
        return adminService.getUser(id, jwt.getName(), isSystemAdmin());
    }

    @POST
    public Response create(UserRequest req) {
        return Response.status(Response.Status.CREATED)
                .entity(adminService.createUser(req, jwt.getName(), isSystemAdmin()))
                .build();
    }

    @PUT
    @Path("/{id}")
    public User update(@PathParam("id") Long id, UserRequest req) {
        return adminService.updateUser(id, req, jwt.getName(), isSystemAdmin());
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        adminService.deleteUser(id, jwt.getName(), isSystemAdmin());
        return Response.noContent().build();
    }
}
