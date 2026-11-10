/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.entity;

/**
 *
 * @author tbvin
 */



import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "users", schema = "public")
public class User extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public String username;

    @JsonIgnore
    public String password;

    public String role;

    @Column(name = "full_name")
    public String fullName;

    @Column(name = "image_url")
    public String imageUrl;

    public Boolean active = true;

    @Column(name = "default_company_id")
    public Long defaultCompanyId;

    @Column(name = "allow_public")
    public Boolean allowPublic = false;

    @Column(name = "created_by_user_id")
    public Long createdByUserId;

    @Column(name = "custom_permissions")
    public Boolean customPermissions = false;

    @Transient
    public List<Long> companyIds;

    @Transient
    public List<Long> ownerCompanyIds;

    @Transient
    public List<Map<String, Object>> companies;

    @Transient
    public Map<String, Map<String, Boolean>> permissions;
//    public String token;

    public static User findByUsername(String username) {
        if (username == null || username.isBlank()) return null;
        return find("lower(username) = ?1", username.trim().toLowerCase()).firstResult();
    }

//    public static User findByToken(String token) {
//        return find("token", token).firstResult();
//    }
}

