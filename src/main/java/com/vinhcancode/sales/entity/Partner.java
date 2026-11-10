package com.vinhcancode.sales.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity @Table(name = "partners")
public class Partner extends MasterEntity {
    public String phone;
    public String address;
    public String kind;          // customer | supplier | both | other
}
