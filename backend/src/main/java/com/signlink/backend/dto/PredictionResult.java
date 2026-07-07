package com.signlink.backend.dto;

import java.util.List;

public class PredictionResult {
    private String label;
    private Double confidence;
    private String feedbackMessage;
    private List<String> candidates; // Top 3 candidates for error correction

    public PredictionResult() {
    }

    public PredictionResult(String label, Double confidence, String feedbackMessage, List<String> candidates) {
        this.label = label;
        this.confidence = confidence;
        this.feedbackMessage = feedbackMessage;
        this.candidates = candidates;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public Double getConfidence() {
        return confidence;
    }

    public void setConfidence(Double confidence) {
        this.confidence = confidence;
    }

    public String getFeedbackMessage() {
        return feedbackMessage;
    }

    public void setFeedbackMessage(String feedbackMessage) {
        this.feedbackMessage = feedbackMessage;
    }

    public List<String> getCandidates() {
        return candidates;
    }

    public void setCandidates(List<String> candidates) {
        this.candidates = candidates;
    }
}
