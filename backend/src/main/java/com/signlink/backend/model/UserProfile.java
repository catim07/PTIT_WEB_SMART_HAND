package com.signlink.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import java.util.UUID;

@Document(collection = "user_profiles")
public class UserProfile {

    @Id
    private UUID id;

    private String name;

    @Field("hand_size")
    private Double handSize = 1.0;

    @Field("gesture_speed_multiplier")
    private Double gestureSpeedMultiplier = 1.0;

    private String habits; // stored as JSON string

    @Field("created_at")
    private Long createdAt;

    public UserProfile() {
    }

    public UserProfile(UUID id, String name) {
        this.id = id;
        this.name = name;
        this.createdAt = System.currentTimeMillis();
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Double getHandSize() {
        return handSize;
    }

    public void setHandSize(Double handSize) {
        this.handSize = handSize;
    }

    public Double getGestureSpeedMultiplier() {
        return gestureSpeedMultiplier;
    }

    public void setGestureSpeedMultiplier(Double gestureSpeedMultiplier) {
        this.gestureSpeedMultiplier = gestureSpeedMultiplier;
    }

    public String getHabits() {
        return habits;
    }

    public void setHabits(String habits) {
        this.habits = habits;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }
}
