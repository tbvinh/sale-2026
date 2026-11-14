package com.vinhcancode.sales.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "shifts")
public class Shift extends MasterEntity {
    @Column(name = "warehouse_id")
    public String warehouseId;

    @Column(name = "warehouse_name")
    public String warehouseName;

    @Column(name = "opened_at", nullable = false)
    public OffsetDateTime openedAt = OffsetDateTime.now();

    @Column(name = "closed_at")
    public OffsetDateTime closedAt;

    @Column(name = "opened_by", nullable = false)
    public String openedBy;

    @Column(name = "closed_by")
    public String closedBy;

    @Column(name = "handover_to")
    public String handoverTo;

    @Column(name = "opening_cash")
    public long openingCash;

    @Column(name = "total_sales")
    public long totalSales;

    @Column(name = "total_receipts")
    public long totalReceipts;

    @Column(name = "total_payments")
    public long totalPayments;

    @Column(name = "expected_cash")
    public long expectedCash;

    @Column(name = "actual_cash")
    public Long actualCash;

    @Column(name = "difference")
    public Long difference;

    public String status = "open"; // 'open' | 'closed'

    public String note;

    @Column(name = "created_at")
    public OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    public OffsetDateTime updatedAt = OffsetDateTime.now();
}

