package com.signlink.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import java.util.UUID;

@Document(collection = "recognition_logs")
public class RecognitionLog {

    @Id
    private UUID id;

    @Field("user_id")
    private UUID userId;

    @Field("predicted_label")
    private String predictedLabel;

    @Field("actual_label")
    private String actualLabel;

    private Double confidence;

    private Boolean correct;

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
