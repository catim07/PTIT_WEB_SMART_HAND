package com.signlink.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import java.util.UUID;

@Document(collection = "gesture_prototypes")
public class GesturePrototype {

    @Id
    private UUID id;

    private String label;

    @Field("user_id")
    private UUID userId; // NULL for global templates, or specific UUID if personalized adapted template

    @Field("feature_vectors")
    private String featureVectors; // Double[][] serialized as JSON

    @Field("landmarks_sequence")
    private String landmarksSequence; // Landmark[][] serialized as JSON

    @Field("sample_count")
    private Integer sampleCount = 1;

    private Double weight = 1.0;

    @Field("updated_at")
    private Long updatedAt;

    private Integer version = 1;

    @Field("parent_id")
    private UUID parentId;

    @Field("variant_name")
    private String variantName;

    @Field("feature_weights")
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
