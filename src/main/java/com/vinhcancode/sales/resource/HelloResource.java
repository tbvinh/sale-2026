/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.resource;

/**
 *
 * @author tbvinh
 */

import com.vinhcancode.sales.dto.AuthRequest;
import com.vinhcancode.sales.dto.AuthResponse;
import com.vinhcancode.sales.entity.User;
import com.vinhcancode.sales.service.AuthService;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;

@Path("/public")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class HelloResource {
    
    @GET
    @Path("/hello")
    public Response hello(AuthRequest request) {
        
        return Response.ok("Hello there").build();
    }
}
