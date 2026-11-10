package com.vinhcancode.sales.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Chung tu ngan hang: bao co (tien vao), bao no (tien ra), luan chuyen tien te.
 * code = so chung tu (BC/BN/LC), name = dien giai.
 */
@Entity @Table(name = "bank_vouchers")
public class BankVoucher extends MasterEntity {
    public String type;                 // credit | debit | transfer
    @Column(name = "doc_date")
    public LocalDate date;
    @Column(name = "bank_id")
    public String bankId;               // tai khoan ngan hang chinh / ngan hang nguon
    @Column(name = "to_bank_id")
    public String toBankId;             // ngan hang dich (transfer)
    @Column(name = "partner_id")
    public String partnerId;            // doi tuong co the la KH hoac NCC => khong rang buoc FK
    @Column(name = "partner_name")
    public String partnerName;          // snapshot; server luon tra lai ten theo id khi luu
    @Column(name = "account_id")
    public String accountId;            // tai khoan doi ung
    public long amount;
    public String currency;             // VND
    public String status;               // posted | cancelled
    @Column(name = "created_by")
    public String createdBy;
    @Column(name = "updated_by")
    public String updatedBy;
}
