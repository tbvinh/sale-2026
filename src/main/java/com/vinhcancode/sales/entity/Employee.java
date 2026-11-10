package com.vinhcancode.sales.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity @Table(name = "employees")
public class Employee extends MasterEntity {
    public String phone;
    public String email;
    public String position;
    @Column(name = "department_id")
    public String departmentId;
}
