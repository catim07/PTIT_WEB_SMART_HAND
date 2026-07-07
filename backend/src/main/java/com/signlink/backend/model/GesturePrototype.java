package com.signlink.backend.model;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "gesture_prototypes")
public class GesturePrototype {
    @Id
    private UUID id;

    @Column(nullable = false)
    private String label;

    @Column(name = "user_id")
    private UUID userId; // NULL for global templates, or specific UUID if personalized adapted template

    @Lob
    @Column(name = "feature_vectors", nullable = false, columnDefinition = "CLOB")
    private String featureVectors; // Double[][] serialized as JSON: [ [f1, f2, ...], [f1, f2, ...], ... ] (resampled to 30 frames)

    @Lob
    @Column(name = "landmarks_sequence", nullable = false, columnDefinition = "CLOB")
    private String landmarksSequence; // Landmark[][] serialized as JSON (closest actual sample for natural skeleton render)

    @Column(name = "sample_count")
    private Integer sampleCount = 1;

    @Column(nullable = false)
    private Double weight = 1.0;

    @Column(name = "updated_at", nullable = false)
    private Long updatedAt;

    @Column(name = "version", nullable = false)
    private Integer version = 1;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(name = "variant_name")
    private String variantName;

    @Lob
    @Column(name = "feature_weights", columnDefinition = "CLOB")
    private String featureWeights; // double[] weights for 44 features in JSON format

    public GesturePrototype() {
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
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

    public Integer getSampleCount() {
        return sampleCount;
    }

    public void setSampleCount(Integer sampleCount) {
        this.sampleCount = sampleCount;
    }

    public Double getWeight() {
        return weight;
    }

    public void setWeight(Double weight) {
        this.weight = weight;
    }

    public Long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Long updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public UUID getParentId() {
        return parentId;
    }

    public void setParentId(UUID parentId) {
        this.parentId = parentId;
    }

    public String getVariantName() {
        return variantName;
    }

    public void setVariantName(String variantName) {
        this.variantName = variantName;
    }

    public String getFeatureWeights() {
        return featureWeights;
    }

    public void setFeatureWeights(String featureWeights) {
        this.featureWeights = featureWeights;
    }
}
