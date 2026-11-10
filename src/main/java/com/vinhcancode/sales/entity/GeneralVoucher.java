package com.vinhcancode.sales.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Chung tu tong hop: phieu ke toan (journal) va phieu bu tru cong no (offset).
 * code = so chung tu (PK/BT), name = dien giai.
 */
@Entity @Table(name = "general_vouchers")
public class GeneralVoucher extends MasterEntity {
    public String type;                 // journal | offset
    @Column(name = "doc_date")
    public LocalDate date;
    @Column(name = "partner_id")
    public String partnerId;
    @Column(name = "partner_name")
    public String partnerName;
    public long amount;
    public String status;               // posted | cancelled
    @Column(name = "printed_at")
    public OffsetDateTime printedAt;
    @Column(name = "printed_by")
    public String printedBy;
    @Column(name = "created_by")
    public String createdBy;
    @Column(name = "updated_by")
    public String updatedBy;

    @OneToMany(mappedBy = "voucher", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("pos asc")
    public List<GeneralVoucherLine> lines = new ArrayList<>();
}
