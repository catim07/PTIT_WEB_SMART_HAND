package com.signlink.backend.engine;

import com.signlink.backend.model.GesturePrototype;
import com.signlink.backend.model.RecognitionLog;
import com.signlink.backend.repository.RecognitionLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;

@Component
public class ConfidenceCalibrationEngine {

    @Autowired
    private RecognitionLogRepository recognitionLogRepository;

    /**
     * Calibrates gesture recognition confidence using dynamic characteristics.
     * Confidence = 50% DTW Match + 15% Context + 10% User Reliability + 10% Prototype Quality + 15% Gesture Stability
     */
    public double calibrate(
            double dtwDistance,
            double contextBoost, // from ContextEngine (eta * P(W_t | W_t-1))
            double userReliability,
            GesturePrototype prototype) {
        
        // 1. DTW distance to match score (Linear range mapping)
        double matchScore = Math.max(0.0, 1.0 - (dtwDistance / 1.2));

        // 2. Prototype Quality based on training sample count
        double protoQuality = Math.min(1.0, (prototype.getSampleCount() != null ? prototype.getSampleCount() : 1.0) / 10.0);

        // 3. Gesture Stability based on the prototype's learning weight
        double stability = Math.min(1.0, prototype.getWeight() / 2.0);

        // 4. Context boost (clamped)
        double contextScore = Math.min(1.0, contextBoost);

        // Calibrated Formula (80% weight on matchScore for real-time accuracy)
        double rawConfidence = (0.80 * matchScore) 
                             + (0.08 * contextScore) 
                             + (0.04 * userReliability) 
                             + (0.04 * protoQuality) 
                             + (0.04 * stability);

        return Math.max(0.0, Math.min(1.0, rawConfidence));
    }

    /**
     * Compute a gesture-specific dynamic acceptance threshold based on historical logs of correct executions.
     */
    public double getDynamicThreshold(String label) {
        if (label == null) return 0.30;
        List<RecognitionLog> logs = recognitionLogRepository.findByActualLabel(label.toUpperCase().trim());
        
        List<Double> correctConfidences = new ArrayList<>();
        for (RecognitionLog log : logs) {
            if (log.getCorrect() != null && log.getCorrect()) {
                correctConfidences.add(log.getConfidence());
            }
        }

        if (correctConfidences.size() < 5) {
            return 0.30; // Fast responsive baseline threshold for real-time recognition
        }

        double sum = 0.0;
        for (double c : correctConfidences) {
            sum += c;
        }
        double mean = sum / correctConfidences.size();

        double varSum = 0.0;
        for (double c : correctConfidences) {
            varSum += Math.pow(c - mean, 2);
        }
        double stdDev = Math.sqrt(varSum / correctConfidences.size());

        // Dynamic threshold = mean - 1.8 * stdDev
        double threshold = mean - 1.8 * stdDev;
        
        // Clamp threshold to a fast operating range [0.25, 0.70]
        return Math.max(0.25, Math.min(0.70, threshold));
    }
}
