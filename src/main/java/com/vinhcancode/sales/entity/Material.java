/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 *
 * @author tbvin
 */
@Entity @Table(name = "materials") public class Material extends MasterEntity {
    public String unit;
    public long price;
    @Column(name = "type_id")    // đặt tên cột tường minh để khớp migration, không phụ thuộc naming strategy
    public String typeId;          // id của MaterialType (chuỗi)

    @Column(name = "image_url")
    public String imageUrl;        // /uploads/{company}/{type}/{file} hoặc /uploads/samples/...

    @Column(name = "kind")
    public String kind = "material"; // 'material' (Vật tư, hàng hóa), 'service' (Dịch vụ theo chuẩn kế toán)
}