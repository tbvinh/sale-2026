package com.vinhcancode.sales.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Table(name = "opening_balances")
public class OpeningBalance extends MasterEntity {
    public String kind;             // debt | loan | bank | account | material | tool | advance
    public String direction;        // receivable | payable | debit | credit
    @Column(name = "partner_id")
    public String partnerId;
    @Column(name = "bank_id")
    public String bankId;
    @Column(name = "account_id")
    public String accountId;
    @Column(name = "material_id")
    public String materialId;
    @Column(name = "employee_id")
    public String employeeId;
    public long quantity;
    @Column(name = "unit_price")
    public long unitPrice;
    public long amount;
    @Column(name = "interest_rate")
    public BigDecimal interestRate;
    @Column(name = "due_date")
    public LocalDate dueDate;
}
