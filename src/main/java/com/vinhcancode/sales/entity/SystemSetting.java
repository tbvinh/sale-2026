package com.vinhcancode.sales.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "system_settings")
public class SystemSetting extends PanacheEntityBase {
    @Id
    @Column(name = "setting_key", length = 100)
    public String key;

    @Column(name = "setting_value", nullable = false)
    public String value;

    public String description;

    @Column(name = "updated_at")
    public LocalDateTime updatedAt;

    @Column(name = "updated_by")
    public String updatedBy;
}

