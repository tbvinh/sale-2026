package com.vinhcancode.sales.resource;

import com.vinhcancode.sales.dto.CompanyRequest;
import com.vinhcancode.sales.entity.DmCongTy;
import com.vinhcancode.sales.service.AdminService;
import com.vinhcancode.sales.service.CompanyService;
import io.quarkus.security.Authenticated;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/companies")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CompanyResource {

    @Inject
    CompanyService companyService;

    @Inject
    JsonWebToken jwt;

    @GET
    @Authenticated
    public List<Map<String, Object>> list() {
        Set<String> groups = jwt.getGroups();
        boolean isSystemAdmin = groups != null && groups.contains("admin");
        return companyService.listForUser(jwt.getName(), isSystemAdmin).stream()
                .map(c -> view(c, false, Collections.emptyList()))
                .collect(Collectors.toList());
    }

    @GET
    @Path("/all")
    @RolesAllowed("admin")
    public List<Map<String, Object>> all() {
        Map<Long, List<Map<String, Object>>> usersByCompany = companyService.mapUsersByCompany();
        return companyService.listAll().stream()
                .map(c -> view(c, true, usersByCompany.getOrDefault(c.id, Collections.emptyList())))
                .collect(Collectors.toList());
    }

    @POST
    @RolesAllowed("admin")
    public Response create(CompanyRequest req) {
        DmCongTy created = companyService.createWithUsers(req);
        Map<Long, List<Map<String, Object>>> usersByCompany = companyService.mapUsersByCompany();
        return Response.status(Response.Status.CREATED)
                .entity(view(created, true, usersByCompany.getOrDefault(created.id, Collections.emptyList())))
                .build();
    }

    @PUT
    @Path("/{id}")
    @RolesAllowed("admin")
    public Map<String, Object> update(@PathParam("id") Long id, CompanyRequest req) {
        DmCongTy updated = companyService.updateWithUsers(id, req);
        Map<Long, List<Map<String, Object>>> usersByCompany = companyService.mapUsersByCompany();
        return view(updated, true, usersByCompany.getOrDefault(updated.id, Collections.emptyList()));
    }

    @DELETE
    @Path("/{id}")
    @RolesAllowed("admin")
    public Response delete(@PathParam("id") Long id) {
        companyService.delete(id);
        return Response.noContent().build();
    }

    private static Map<String, Object> view(DmCongTy company, boolean admin, List<Map<String, Object>> users) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", company.id);
        row.put("code", company.code);
        row.put("name", company.name);
        row.put("address", company.address);
        row.put("taxCode", company.taxCode);
        row.put("phone", company.phone);
        row.put("status", company.status);
        if (admin) {
            row.put("schemaName", company.schemaName);
            row.put("createdAt", company.createdAt);
            row.put("suggestedOwnerUsername", AdminService.defaultOwnerUsername(company.code));
            row.put("users", users);
            List<Long> userIds = new ArrayList<>();
            Long ownerUserId = null;
            String ownerUsername = null;
            String ownerFullName = null;
            for (Map<String, Object> u : users) {
                Long uid = (Long) u.get("id");
                if (uid != null) userIds.add(uid);
                if (Boolean.TRUE.equals(u.get("isOwner")) && ownerUserId == null) {
                    ownerUserId = uid;
                    ownerUsername = (String) u.get("username");
                    ownerFullName = (String) u.get("fullName");
                }
            }
            row.put("userIds", userIds);
            row.put("ownerUserId", ownerUserId);
            row.put("ownerUsername", ownerUsername);
            row.put("ownerFullName", ownerFullName);
        }
        return row;
    }
}
