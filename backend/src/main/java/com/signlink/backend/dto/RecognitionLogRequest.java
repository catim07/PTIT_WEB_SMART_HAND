package com.signlink.backend.dto;

import java.util.UUID;

public class RecognitionLogRequest {
    private UUID userId;
    private String predictedLabel;
    private String actualLabel;
    private Double confidence;
    private Boolean correct;
    private double[][] featureVectors; // Optional, sent when correct = true to adapt prototype
    private Landmark[][] landmarksSequence; // Optional, for skeletal reconstruction

    public RecognitionLogRequest() {
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

    public double[][] getFeatureVectors() {
        return featureVectors;
    }

    public void setFeatureVectors(double[][] featureVectors) {
        this.featureVectors = featureVectors;
    }

    public Landmark[][] getLandmarksSequence() {
        return landmarksSequence;
    }

    public void setLandmarksSequence(Landmark[][] landmarksSequence) {
        this.landmarksSequence = landmarksSequence;
    }
}
