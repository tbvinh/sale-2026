package com.vinhcancode.sales.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "table_order_items")
public class TableOrderItem extends PanacheEntityBase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @JsonIgnore
    public TableOrder order;

    @Column(name = "product_id", nullable = false)
    public String productId;

    @Column(name = "product_code")
    public String productCode;

    @Column(name = "product_name", nullable = false)
    public String productName;

    public String unit;

    @Column(nullable = false)
    public BigDecimal qty = BigDecimal.ONE;

    @Column(nullable = false)
    public BigDecimal price = BigDecimal.ZERO;

    @Column(insertable = false, updatable = false)
    public BigDecimal amount;

    public String note;

    public String status = "pending"; // pending | sent | served | cancelled

    public Integer round = 1;

    @Column(name = "cancel_reason")
    public String cancelReason;

    @Column(name = "created_by")
    public String createdBy;

    @Column(name = "created_at")
    public OffsetDateTime createdAt;

    @Column(name = "sent_at")
    public OffsetDateTime sentAt;

    @PrePersist
    void onPrePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}

