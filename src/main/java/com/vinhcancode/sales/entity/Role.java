package com.vinhcancode.sales.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "roles", schema = "public")
public class Role extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public String code;
    public String name;
    public String description;

    public static Role findByCode(String code) {
        if (code == null) return null;
        return find("lower(code) = ?1", code.trim().toLowerCase()).firstResult();
    }
}
