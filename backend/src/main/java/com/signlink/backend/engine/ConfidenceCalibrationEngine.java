package com.signlink.backend.engine;

import com.signlink.backend.model.GesturePrototype;
import org.springframework.stereotype.Component;

@Component
public class ConfidenceCalibrationEngine {

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
}
