package com.signlink.backend.dto;

import com.signlink.backend.model.RecognitionLog;
import java.util.List;
import java.util.Map;

public class SystemStatsResponse {
    private Long totalRecognitions;
    private Long correctRecognitions;
    private Double accuracy;
    private Map<String, Integer> gestureCounts;
    private List<RecognitionLog> recentLogs;

    public SystemStatsResponse() {
    }

    public SystemStatsResponse(Long totalRecognitions, Long correctRecognitions, Double accuracy, Map<String, Integer> gestureCounts, List<RecognitionLog> recentLogs) {
        this.totalRecognitions = totalRecognitions;
        this.correctRecognitions = correctRecognitions;
        this.accuracy = accuracy;
        this.gestureCounts = gestureCounts;
        this.recentLogs = recentLogs;
    }

    public Long getTotalRecognitions() {
        return totalRecognitions;
    }

    public void setTotalRecognitions(Long totalRecognitions) {
        this.totalRecognitions = totalRecognitions;
    }

    public Long getCorrectRecognitions() {
        return correctRecognitions;
    }

    public void setCorrectRecognitions(Long correctRecognitions) {
        this.correctRecognitions = correctRecognitions;
    }

    public Double getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(Double accuracy) {
        this.accuracy = accuracy;
    }

    public Map<String, Integer> getGestureCounts() {
        return gestureCounts;
    }

    public void setGestureCounts(Map<String, Integer> gestureCounts) {
        this.gestureCounts = gestureCounts;
    }

    public List<RecognitionLog> getRecentLogs() {
        return recentLogs;
    }

    public void setRecentLogs(List<RecognitionLog> recentLogs) {
        this.recentLogs = recentLogs;
    }
}
