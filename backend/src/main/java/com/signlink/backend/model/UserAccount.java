package com.signlink.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import java.util.UUID;

@Document(collection = "users")
public class UserAccount {

    @Id
    private String id;

    private String email;
    private String password;

    @Field("full_name")
    private String fullName;

    private String role; // "ADMIN" or "USER"

    @Field("created_at")
    private Long createdAt;

    public UserAccount() {
    }

    public UserAccount(String email, String password, String fullName, String role) {
        this.id = UUID.randomUUID().toString();
        this.email = email;
        this.password = password;
        this.fullName = fullName;
        this.role = role != null ? role.toUpperCase() : "USER";
        this.createdAt = System.currentTimeMillis();
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }
}
