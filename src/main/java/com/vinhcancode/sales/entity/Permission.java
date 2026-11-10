package com.vinhcancode.sales.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "permissions", schema = "public")
public class Permission extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public String module;
    public String action;
    public String label;

    public static Permission findOne(String module, String action) {
        return find("lower(module) = ?1 and upper(action) = ?2", module.toLowerCase(), action.toUpperCase())
                .firstResult();
    }
}
