package com.vinhcancode.sales.model;

public class User {
    public Long id;
    public String username;
    public String passwordHash; // để plain text tạm cho dễ test, sau thay bcrypt
    public String role;
    public boolean active;

    public User(Long id, String username, String passwordHash, String role, boolean active) {
        this.id = id;
        this.username = username;
        this.passwordHash = passwordHash;
        this.role = role;
        this.active = active;
    }
}