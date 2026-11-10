package com.vinhcancode.sales.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Dong but toan cua phieu ke toan / phieu bu tru cong no.
 * Moi dong chi ghi No hoac Co (khong ghi ca hai).
 */
@Entity @Table(name = "general_voucher_lines")
public class GeneralVoucherLine extends PanacheEntityBase {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "voucher_id", nullable = false)
    @JsonIgnore                       // tránh vòng lặp JSON: header.lines → line.voucher → …
    public GeneralVoucher voucher;

    public int pos;
    @Column(name = "account_id")
    public String accountId;
    public long debit;
    public long credit;
    public String note;
}
