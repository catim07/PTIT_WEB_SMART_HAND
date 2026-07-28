package com.signlink.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import java.util.UUID;

@Document(collection = "gesture_samples")
public class GestureSample {

    @Id
    private UUID id;

    @Field("user_id")
    private UUID userId;

    private String label;

    @Field("feature_vectors")
    private String featureVectors; // Double[][] serialized as JSON

    @Field("landmarks_sequence")
    private String landmarksSequence; // Landmark[][] serialized as JSON

    private Double weight = 1.0;

    @Field("created_at")
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
