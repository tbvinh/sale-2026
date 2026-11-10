package com.vinhcancode.sales.entity;

import com.fasterxml.jackson.annotation.JsonAlias;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** Danh muc cong ty luu trong schema public (master data). */
@Entity
@Table(name = "dmcongty", schema = "public")
public class DmCongTy extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public String code;
    public String name;

    public String address;

    @JsonAlias("tax_code")
    @Column(name = "tax_code")
    public String taxCode;

    public String phone;

    @JsonAlias("schema_name")
    @Column(name = "schema_name")
    public String schemaName;

    public String status;

    @JsonAlias("created_at")
    @Column(name = "created_at")
    public LocalDateTime createdAt;

    public static DmCongTy findByCode(String code) {
        if (code == null) return null;
        return find("lower(code) = ?1", code.trim().toLowerCase()).firstResult();
    }

    public static DmCongTy findBySchema(String schemaName) {
        if (schemaName == null) return null;
        return find("lower(schemaName) = ?1", schemaName.trim().toLowerCase()).firstResult();
    }
}
