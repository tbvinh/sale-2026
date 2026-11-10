package com.vinhcancode.sales.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity @Table(name = "departments")
public class Department extends MasterEntity {
    public String manager;
    public String phone;
}
