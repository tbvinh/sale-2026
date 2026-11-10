/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.entity;

/**
 *
 * @author tbvin
 */

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.persistence.*;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import io.quarkus.security.Authenticated;
import java.util.*;
import java.util.stream.Collectors;
 
// ---------- Entity ----------
@MappedSuperclass
public abstract class MasterEntity {
    @Id public String id;
    public String code;
    public String name;
 
    @PrePersist
    void generateId() { if (id == null) id = UUID.randomUUID().toString(); }
}
 
 