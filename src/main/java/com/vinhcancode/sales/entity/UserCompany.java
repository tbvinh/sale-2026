package com.vinhcancode.sales.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_companies", schema = "public")
public class UserCompany extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "company_id", nullable = false)
    public Long companyId;

    @Column(name = "is_owner", nullable = false)
    public Boolean isOwner = false;

    @Column(name = "created_at")
    public LocalDateTime createdAt = LocalDateTime.now();
}

