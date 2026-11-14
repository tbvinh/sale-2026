package com.vinhcancode.sales.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "table_orders")
public class TableOrder extends PanacheEntityBase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "table_id", nullable = false)
    public String tableId;

    @Column(name = "shift_id")
    public String shiftId;

    public String status = "active"; // active | completed | cancelled

    @Column(name = "customer_name")
    public String customerName = "Khách vãng lai";

    @Column(name = "customer_phone")
    public String customerPhone;

    @Column(name = "guest_count")
    public Integer guestCount = 1;

    public String note;

    @Column(name = "total_amount")
    public BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "created_by")
    public String createdBy;

    @Column(name = "created_at")
    public OffsetDateTime createdAt;

    @Column(name = "updated_at")
    public OffsetDateTime updatedAt;

    @Column(name = "completed_at")
    public OffsetDateTime completedAt;

    @Column(name = "inv_doc_id")
    public Long invDocId;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id asc")
    public List<TableOrderItem> items = new ArrayList<>();

    @PrePersist
    void onPrePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (updatedAt == null) updatedAt = createdAt;
    }

    @PreUpdate
    void onPreUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}

