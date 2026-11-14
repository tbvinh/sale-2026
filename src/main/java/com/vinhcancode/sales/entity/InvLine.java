/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/**
 *
 * @author tbvinh
 */
@Entity @Table(name = "inv_doc_line")
public class InvLine extends PanacheEntityBase {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "line_total", insertable = false, updatable = false) public BigDecimal lineTotal;

    @Embedded @AttributeOverrides({
        @AttributeOverride(name="id",   column=@Column(name="product_id")),
        @AttributeOverride(name="name", column=@Column(name="product_name"))})
    public Ref product;

    public String productName() { return product != null ? product.name : null; }
    public String productId() { return product != null ? product.id : null; }

    @Column(precision = 18, scale = 3)
    public BigDecimal qty;

    @Column(precision = 18, scale = 2)
    public BigDecimal price;

    // Quan hệ 2 chiều tới phiếu: InvLine là BÊN SỞ HỮU khoá ngoại (doc_id NOT NULL).
    // Nhờ vậy Hibernate ghi doc_id ngay trong câu INSERT của dòng hàng (trước đây để collection
    // sở hữu nên phải INSERT thiếu cột rồi UPDATE bù ⇒ vi phạm NOT NULL).
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doc_id", nullable = false)
    @JsonIgnore                       // tránh vòng lặp JSON: InvDoc.lines → InvLine.doc → …
    public InvDoc doc;

    // Thứ tự dòng trong phiếu (cột pos NOT NULL, UNIQUE(doc_id,pos)); app gán = index trong mảng.
    public int pos;
}