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
        
        // 1. DTW distance to match score (exponential decay)
        double matchScore = Math.exp(-2.0 * dtwDistance);

        // 2. Prototype Quality based on training sample count (max contribution reached at 20 samples)
        double protoQuality = Math.min(1.0, (prototype.getSampleCount() != null ? prototype.getSampleCount() : 1.0) / 20.0);

        // 3. Gesture Stability based on the prototype's learning weight
        double stability = Math.min(1.0, prototype.getWeight() / 2.0);

        // 4. Context boost (clamped)
        double contextScore = Math.min(1.0, contextBoost);

        // Calibrated Formula
        double rawConfidence = (0.50 * matchScore) 
                             + (0.15 * contextScore) 
                             + (0.10 * userReliability) 
                             + (0.10 * protoQuality) 
                             + (0.15 * stability);

        return Math.max(0.0, Math.min(1.0, rawConfidence));
    }

    /**
     * Compute a gesture-specific dynamic acceptance threshold based on historical logs of correct executions.
     */
    public double getDynamicThreshold(String label) {
        if (label == null) return 0.60;
        List<RecognitionLog> logs = recognitionLogRepository.findByActualLabel(label.toUpperCase().trim());
        
        List<Double> correctConfidences = new ArrayList<>();
        for (RecognitionLog log : logs) {
            if (log.getCorrect() != null && log.getCorrect()) {
                correctConfidences.add(log.getConfidence());
            }
        }

        if (correctConfidences.size() < 5) {
            return 0.60; // Default baseline threshold for new/unrefined gestures
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
        
        // Clamp threshold to a safe operating range [0.45, 0.85]
        return Math.max(0.45, Math.min(0.85, threshold));
    }
}
