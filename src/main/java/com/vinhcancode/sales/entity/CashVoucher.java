package com.vinhcancode.sales.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Phieu thu / chi / doi tien te. Dung chung bang cash_vouchers:
 * code = so phieu (PT/PC/PD), name = dien giai.
 */
@Entity @Table(name = "cash_vouchers")
public class CashVoucher extends MasterEntity {
    public String type;                 // receipt | payment | exchange
    @Column(name = "doc_date")
    public LocalDate date;
    @Column(name = "partner_id")
    public String partnerId;            // doi tuong co the la KH hoac NCC => khong rang buoc FK
    @Column(name = "partner_name")
    public String partnerName;          // snapshot; server luon tra lai ten theo id khi luu
    @Column(name = "account_id")
    public String accountId;            // TK tien mat (1111...)
    public long amount;                 // gia tri VND
    public String currency;             // VND | USD | EUR...
    @Column(name = "amount_currency")
    public long amountCurrency;         // so ngoai te (phieu doi tien te)
    @Column(name = "fx_rate")
    public BigDecimal fxRate;           // ty gia
    @Column(name = "source_doc_id")
    public Long sourceDocId;            // phieu nhap/xuat nguon (tao tu phieu kho)
    @Column(name = "source_doc_no")
    public String sourceDocNo;
    @Column(name = "warehouse_id")
    public String warehouseId;          // kho lien quan (Kho Bar / Nha hang...)
    @Column(name = "warehouse_name")
    public String warehouseName;
    @Column(name = "shift_id")
    public String shiftId;              // ca lam viec (shifts)
    public String status;               // posted | cancelled
    @Column(name = "created_at")
    public java.time.OffsetDateTime createdAt;
    @Column(name = "created_by")
    public String createdBy;
    @Column(name = "updated_at")
    public java.time.OffsetDateTime updatedAt;
    @Column(name = "updated_by")
    public String updatedBy;
}
