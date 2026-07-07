package com.signlink.backend.engine;

import com.signlink.backend.model.GesturePrototype;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class DataQualityEngine {

    @Autowired
    private LearningEngine learningEngine;

    public static class QualityReport {
        public boolean isValid;
        public String rejectionReason;

        public QualityReport(boolean isValid, String rejectionReason) {
            this.isValid = isValid;
            this.rejectionReason = rejectionReason;
        }
    }

    /**
     * Inspects a newly recorded gesture sample for physical quality, tracking completeness, and duplicate redundancy.
     */
    public QualityReport validateSample(
            double[][] featureVectors, 
            double completenessScore, 
            double peakAcceleration, 
            List<GesturePrototype> existingPrototypes) {

        // 1. Missing coordinates check (missing hand landmarks)
        if (completenessScore < 0.70) {
            return new QualityReport(false, "Thiếu dữ liệu landmarks tay (Hand tracking bị mất nét > 30% thời lượng).");
        }

        // 2. Camera blur or excessive hand shake check (Physically impossible velocity/acceleration)
        if (peakAcceleration > 55.0) {
            return new QualityReport(false, "Cử chỉ bị rung lắc quá mức hoặc camera bị nhòe hình (Acceleration: " + Math.round(peakAcceleration) + " m/s²).");
        }

        // 3. Duplicate check (To prevent database bloating with redundant features)
        if (existingPrototypes != null && !existingPrototypes.isEmpty()) {
            for (GesturePrototype proto : existingPrototypes) {
                try {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    double[][] protoFeatures = mapper.readValue(proto.getFeatureVectors(), double[][].class);
                    
                    SimilarityEngine simEngine = new SimilarityEngine();
                    double dtwDist = simEngine.computeAdaptiveDtw(featureVectors, protoFeatures, null, 1.0);
                    
                    if (dtwDist < 0.05) {
                        return new QualityReport(false, "Mẫu cử chỉ bị trùng lặp với Prototype có sẵn (DTW Distance: " + dtwDist + ").");
                    }
                } catch (Exception e) {
                    // skip parsing errors
                }
            }
        }

        return new QualityReport(true, null);
    }
}
