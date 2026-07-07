package com.signlink.backend.model;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "recognition_logs")
public class RecognitionLog {
    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "predicted_label", nullable = false)
    private String predictedLabel;

    @Column(name = "actual_label", nullable = false)
    private String actualLabel;

    @Column(nullable = false)
    private Double confidence;

    @Column(nullable = false)
    private Boolean correct;

    @Column(nullable = false)
    private Long timestamp;

    public RecognitionLog() {
    }

    public RecognitionLog(UUID id, UUID userId, String predictedLabel, String actualLabel, Double confidence, Boolean correct) {
        this.id = id;
        this.userId = userId;
        this.predictedLabel = predictedLabel;
        this.actualLabel = actualLabel;
        this.confidence = confidence;
        this.correct = correct;
        this.timestamp = System.currentTimeMillis();
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

    public String getPredictedLabel() {
        return predictedLabel;
    }

    public void setPredictedLabel(String predictedLabel) {
        this.predictedLabel = predictedLabel;
    }

    public String getActualLabel() {
        return actualLabel;
    }

    public void setActualLabel(String actualLabel) {
        this.actualLabel = actualLabel;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public Boolean getCorrect() {
        return correct;
    }

    public void setCorrect(Boolean correct) {
        this.correct = correct;
    }

    public Long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Long timestamp) {
        this.timestamp = timestamp;
    }
}
