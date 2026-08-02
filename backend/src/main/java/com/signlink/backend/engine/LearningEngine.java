package com.signlink.backend.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.signlink.backend.model.GesturePrototype;
import com.signlink.backend.model.RecognitionLog;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class LearningEngine {

    private final ObjectMapper mapper = new ObjectMapper();
    private static final int STANDARDIZED_LENGTH = 30;

    /**
     * Compute User Reliability Score using Laplace-smoothed accuracy of user feedback logs.
     * Ru = (TruePositives + 1) / (TruePositives + FalsePositives + 2)
     */
    public double computeUserReliability(List<RecognitionLog> userLogs) {
        if (userLogs == null || userLogs.isEmpty()) {
            return 0.75; // Baseline for new users
        }
        int truePositives = 0;
        int falsePositives = 0;
        for (RecognitionLog log : userLogs) {
            if (log.getCorrect() != null) {
                if (log.getCorrect()) {
                    truePositives++;
                } else {
                    falsePositives++;
                }
            }
        }
        return (double) (truePositives + 1) / (truePositives + falsePositives + 2);
    }

    /**
     * Incremental update to local or global prototype vectors.
     * Formula: Proto[t][d] = (1 - alpha * Reliability) * Proto[t][d] + alpha * Reliability * Sample[t][d]
     */
    public double[][] performIncrementalAdaptation(double[][] protoFeatures, double[][] sampleFeatures, double learningRate, double userReliability) {
        double effectiveRate = learningRate * userReliability;
        double[][] updated = new double[STANDARDIZED_LENGTH][44];
        for (int t = 0; t < STANDARDIZED_LENGTH; t++) {
            for (int d = 0; d < 44; d++) {
                updated[t][d] = (1.0 - effectiveRate) * protoFeatures[t][d] + effectiveRate * sampleFeatures[t][d];
            }
        }
        return updated;
    }

    /**
     * Adaptive Feature Weight updates:
     * Calculates the frame-wise deviation of each feature k between sample and prototype.
     * Shrinks weight for high deviation, expands weight for low deviation, then normalizes sum(w) = 44.0.
     */
    public double[] updateFeatureWeights(double[] currentWeights, double[][] protoFeatures, double[][] sampleFeatures, double beta) {
        double[] updatedWeights = new double[44];
        double sumRaw = 0.0;

        // Calculate average deviation for each feature across the 30 frames
        for (int k = 0; k < 44; k++) {
            double deviation = 0.0;
            for (int t = 0; t < STANDARDIZED_LENGTH; t++) {
                deviation += Math.abs(protoFeatures[t][k] - sampleFeatures[t][k]);
            }
            deviation /= STANDARDIZED_LENGTH;

            // Exponential penalty update: new_w = old_w * exp(-beta * deviation)
            double currentW = (currentWeights != null && currentWeights.length == 44) ? currentWeights[k] : 1.0;
            double rawW = currentW * Math.exp(-beta * deviation);
            updatedWeights[k] = Math.max(0.1, rawW); // keep a minimum weight of 0.1 to avoid zeroing out
            sumRaw += updatedWeights[k];
        }

        // Normalize sum to 44.0 (average weight of 1.0 per feature)
        if (sumRaw > 0.0) {
            for (int k = 0; k < 44; k++) {
                updatedWeights[k] = 44.0 * (updatedWeights[k] / sumRaw);
            }
        } else {
            Arrays.fill(updatedWeights, 1.0);
        }

        return updatedWeights;
    }

    /**
     * Evolve a prototype V(N) into a new V(N+1) database prototype record, preserving lineage.
     */
    public GesturePrototype evolvePrototype(
            GesturePrototype parent, 
            double[][] newFeatures, 
            double[][] newLandmarks, 
            double learningRate, 
            double userReliability) {
        
        try {
            double[][] oldFeatures = mapper.readValue(parent.getFeatureVectors(), double[][].class);

            // 1. Interpolate features
            double[][] evolvedFeatures = performIncrementalAdaptation(oldFeatures, newFeatures, learningRate, userReliability);
            
            // 2. Safely retain landmarks sequence string
            String evolvedLandmarksStr = parent.getLandmarksSequence();

            // 3. Evolve weights
            double[] parentWeights = null;
            if (parent.getFeatureWeights() != null) {
                try {
                    parentWeights = mapper.readValue(parent.getFeatureWeights(), double[].class);
                } catch (Exception ignored) {}
            }
            double[] evolvedWeights = updateFeatureWeights(parentWeights, oldFeatures, newFeatures, 1.2);

            // 4. Create evolved prototype entity
            GesturePrototype child = new GesturePrototype();
            child.setId(UUID.randomUUID());
            child.setLabel(parent.getLabel());
            child.setUserId(parent.getUserId());
            child.setFeatureVectors(mapper.writeValueAsString(evolvedFeatures));
            child.setLandmarksSequence(evolvedLandmarksStr);
            child.setSampleCount(parent.getSampleCount() + 1);
            child.setWeight(Math.min(2.5, parent.getWeight() + 0.05 * userReliability));
            child.setUpdatedAt(System.currentTimeMillis());
            
            // Evolution Version Control
            child.setVersion(parent.getVersion() + 1);
            child.setParentId(parent.getId());
            child.setVariantName(parent.getVariantName());
            child.setFeatureWeights(mapper.writeValueAsString(evolvedWeights));

            return child;
        } catch (Exception e) {
            throw new RuntimeException("Lỗi tiến hóa prototype cử chỉ", e);
        }
    }

    /**
     * Novelty Detection: Returns true if the similarity is too low (DTW distance too high).
     * Meaning it represents a new variant of the same gesture rather than a standard modification.
     */
    public boolean detectNovelty(double[][] inputFeatures, double[][] protoFeatures, double threshold) {
        SimilarityEngine similarityEngine = new SimilarityEngine();
        double dtwDist = similarityEngine.computeAdaptiveDtw(inputFeatures, protoFeatures, null, 1.0);
        return dtwDist > threshold; // High distance implies novelty (e.g. threshold = 0.50)
    }

    /**
     * Community Federated Learning update.
     */
    public double[][] mergeToGlobalPrototype(double[][] globalFeatures, double[][] localFeatures, double userReliability, double baseGamma) {
        double effectiveGamma = baseGamma * userReliability;
        double[][] merged = new double[STANDARDIZED_LENGTH][44];
        for (int t = 0; t < STANDARDIZED_LENGTH; t++) {
            for (int d = 0; d < 44; d++) {
                merged[t][d] = (1.0 - effectiveGamma) * globalFeatures[t][d] + effectiveGamma * localFeatures[t][d];
            }
        }
        return merged;
    }

    /**
     * Checks if a new sample is too similar to existing templates (duplicate detection).
     * Returns true if a match is found under the threshold.
     */
    public boolean detectDuplicate(double[][] newFeatures, List<double[][]> existingTemplates, double minDtwThreshold) {
        SimilarityEngine similarityEngine = new SimilarityEngine();
        for (double[][] temp : existingTemplates) {
            double dist = similarityEngine.computeAdaptiveDtw(newFeatures, temp, null, 1.0);
            if (dist < minDtwThreshold) {
                return true; // Duplicate detected
            }
        }
        return false;
    }

    /**
     * Calculates the diversity contribution score of a sample.
     */
    public double calculateDiversityScore(double[][] newFeatures, List<double[][]> existingTemplates) {
        if (existingTemplates.isEmpty()) return 1.0;
        SimilarityEngine similarityEngine = new SimilarityEngine();
        double minDistance = Double.MAX_VALUE;
        for (double[][] temp : existingTemplates) {
            double dist = similarityEngine.computeAdaptiveDtw(newFeatures, temp, null, 1.0);
            if (dist < minDistance) {
                minDistance = dist;
            }
        }
        return minDistance;
    }

    /**
     * Applies exponential time-decay to prototype weights.
     */
    public double calculateTimeDecay(double initialWeight, long lastUpdatedTime, long currentTime, double decayConstant) {
        double daysDiff = (double) (currentTime - lastUpdatedTime) / (1000.0 * 60.0 * 60.0 * 24.0);
        return initialWeight * Math.exp(-decayConstant * daysDiff);
    }
}
