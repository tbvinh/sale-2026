package com.vinhcancode.sales.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "audit_logs")
public class AuditLog extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public String username;

    @Column(nullable = false)
    public String module;

    @Column(nullable = false)
    public String action;

    @Column(name = "target_id")
    public String targetId;

    @Column(nullable = false, columnDefinition = "TEXT")
    public String description;

    @Column(name = "ip_address")
    public String ipAddress;

    @Column(name = "created_at", nullable = false)
    public OffsetDateTime createdAt = OffsetDateTime.now();
}

