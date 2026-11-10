package com.vinhcancode.sales.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity @Table(name = "closing_entries")
public class ClosingEntry extends MasterEntity {
    @Column(name = "from_account")
    public String fromAccount;
    @Column(name = "to_account")
    public String toAccount;
    public String description;
}
