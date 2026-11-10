/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.entity;

/**
 *
 * @author tbvinh
 */
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

// 1. Class chính trùng với tên file phải để public

@Entity @Table(name = "inv_doc")
public class InvDoc extends PanacheEntityBase {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(name = "doc_date") public LocalDate date;
    
    public String no;
    public String type;                       // import | export | return | transfer
    
    @Embedded @AttributeOverrides({
        @AttributeOverride(name="id",   column=@Column(name="partner_id")),
        @AttributeOverride(name="name", column=@Column(name="partner_name"))})
    public Ref partner;
    
    @Embedded @AttributeOverrides({
        @AttributeOverride(name="id",   column=@Column(name="bank_id")),
        @AttributeOverride(name="name", column=@Column(name="bank_name"))})
    public Ref bank;

    // Kho nhập: import/return/transfer. import/return là kho của mình, phía đối tác (kho khách hàng) không có dữ liệu ⇒ null.
    @Embedded @AttributeOverrides({
        @AttributeOverride(name="id",   column=@Column(name="warehouse_in_id")),
        @AttributeOverride(name="name", column=@Column(name="warehouse_in_name"))})
    public Ref warehouseIn;

    // Kho xuất: export/transfer. export là kho của mình, phía đối tác (kho khách hàng) không có dữ liệu ⇒ null.
    @Embedded @AttributeOverrides({
        @AttributeOverride(name="id",   column=@Column(name="warehouse_out_id")),
        @AttributeOverride(name="name", column=@Column(name="warehouse_out_name"))})
    public Ref warehouseOut;

    // Ref là package-private: expose kiểm tra kho đã chọn cho tầng Resource
    public boolean hasWarehouseIn() { return warehouseIn != null && warehouseIn.id != null && !warehouseIn.id.isBlank(); }
    public boolean hasWarehouseOut() { return warehouseOut != null && warehouseOut.id != null && !warehouseOut.id.isBlank(); }
    
    public String note;
    
    @OneToMany(mappedBy = "doc", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("pos asc")   // thứ tự kéo thả: cột pos do InvLine.pos quản lý (InvLine sở hữu doc_id + pos)
    public List<InvLine> lines = new ArrayList<>();
}

// 2. Bỏ từ khóa "public" ở các class phụ này


@Embeddable
class Ref { 
    public String id; 
    public String name; 
}