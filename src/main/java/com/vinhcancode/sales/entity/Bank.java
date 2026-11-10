/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.vinhcancode.sales.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 *
 * @author tbvin
 */


@Entity @Table(name = "banks")     public class Bank extends MasterEntity { public String branch; }
