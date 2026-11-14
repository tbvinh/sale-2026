package com.vinhcancode.sales.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "dining_tables")
public class DiningTable extends MasterEntity {
    public String area;
    public Integer capacity = 4;
    public String status = "empty"; // empty | occupied | reserved
    public Boolean active = true;

    @Column(name = "current_doc_id")
    public String currentDocId;

    @Column(name = "reserved_customer_name")
    public String reservedCustomerName;

    @Column(name = "reserved_customer_phone")
    public String reservedCustomerPhone;

    @Column(name = "reserved_time")
    public String reservedTime;

    public String note;
}

