package com.signlink.backend.model;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "gesture_samples")
public class GestureSample {
    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String label;

    @Lob
    @Column(name = "feature_vectors", nullable = false, columnDefinition = "CLOB")
    private String featureVectors; // Double[][] serialized as JSON: [ [f1, f2, ...], [f1, f2, ...], ... ]

    @Lob
    @Column(name = "landmarks_sequence", nullable = false, columnDefinition = "CLOB")
    private String landmarksSequence; // Landmark[][] serialized as JSON: [ [ {x, y, z, v}, ... ], ... ]

    @Column(nullable = false)
    private Double weight = 1.0;

    @Column(name = "created_at", nullable = false)
    private Long createdAt;

    public GestureSample() {
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getFeatureVectors() {
        return featureVectors;
    }

    public void setFeatureVectors(String featureVectors) {
        this.featureVectors = featureVectors;
    }

    public String getLandmarksSequence() {
        return landmarksSequence;
    }

    public void setLandmarksSequence(String landmarksSequence) {
        this.landmarksSequence = landmarksSequence;
    }

    public Double getWeight() {
        return weight;
    }

    public void setWeight(Double weight) {
        this.weight = weight;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }
}
