package com.signlink.backend.engine;

import com.signlink.backend.model.RecognitionLog;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class TrendEngine {

    public static class PerformanceMetrics {
        public double overallAccuracy;
        public double averageConfidence;
        public int totalInteractions;
        public Map<String, Integer> commonErrors = new HashMap<>(); // predicted -> actual mismatches
        public String learningTrajectory; // "IMPROVING", "STABLE", or "DECLINING"
        public double userProficiencyScore; // 0.0 to 100.0 based on speed + correctness
        
        // Advanced Analytics Metrics
        public String hardestGesture = "N/A";
        public String mostImprovedGesture = "N/A";
        public String mostUsedGesture = "N/A";
        public Map<String, Double> gestureDrift = new HashMap<>(); // label -> drift rate
        public Map<String, Double> prototypeHealth = new HashMap<>(); // label -> stability health index
        public Map<String, Map<String, Integer>> confusionMatrix = new HashMap<>(); // actual -> (predicted -> count)
        public int trainingStreak = 0;
    }

    /**
     * Aggregates historical logs to compute adaptive learning trends.
     */
    public PerformanceMetrics calculateTrends(List<RecognitionLog> logs) {
        PerformanceMetrics metrics = new PerformanceMetrics();
        metrics.totalInteractions = logs.size();
        if (logs.isEmpty()) {
            metrics.overallAccuracy = 0.0;
            metrics.averageConfidence = 0.0;
            metrics.learningTrajectory = "STABLE";
            metrics.userProficiencyScore = 0.0;
            return metrics;
        }

        int correctCount = 0;
        double confidenceSum = 0.0;
        
        // 1. Grouping maps for calculations
        Map<String, List<Boolean>> correctnessByGesture = new HashMap<>();
        Map<String, Integer> countsByGesture = new HashMap<>();
        Map<String, List<Double>> confidenceByGesture = new HashMap<>();

        // Group logs for streak calculation
        Set<String> trainingDates = new HashSet<>();

        for (RecognitionLog log : logs) {
            String actual = log.getActualLabel() != null ? log.getActualLabel().toUpperCase().trim() : "UNKNOWN";
            String predicted = log.getPredictedLabel() != null ? log.getPredictedLabel().toUpperCase().trim() : "UNKNOWN";
            boolean isCorrect = log.getCorrect() != null && log.getCorrect();

            confidenceSum += log.getConfidence();
            if (isCorrect) {
                correctCount++;
            } else {
                String errorKey = predicted + " -> " + actual;
                metrics.commonErrors.put(errorKey, metrics.commonErrors.getOrDefault(errorKey, 0) + 1);
            }

            // Confusion Matrix
            metrics.confusionMatrix
                .computeIfAbsent(actual, k -> new HashMap<>())
                .put(predicted, metrics.confusionMatrix.get(actual).getOrDefault(predicted, 0) + 1);

            // Grouping for gesture specific analysis
            correctnessByGesture.computeIfAbsent(actual, k -> new ArrayList<>()).add(isCorrect);
            countsByGesture.put(actual, countsByGesture.getOrDefault(actual, 0) + 1);
            confidenceByGesture.computeIfAbsent(actual, k -> new ArrayList<>()).add(log.getConfidence());

            // Track date (mock using timestamp grouping by day)
            if (log.getTimestamp() != null) {
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd");
                trainingDates.add(sdf.format(new Date(log.getTimestamp())));
            }
        }

        metrics.overallAccuracy = (double) correctCount / logs.size();
        metrics.averageConfidence = confidenceSum / logs.size();
        metrics.trainingStreak = trainingDates.size();

        // 2. Identify Hardest and Most Used Gestures
        String maxUsed = "N/A";
        int maxCount = -1;
        String worstGesture = "N/A";
        double worstAcc = 1.1;

        for (Map.Entry<String, Integer> entry : countsByGesture.entrySet()) {
            if (entry.getValue() > maxCount) {
                maxCount = entry.getValue();
                maxUsed = entry.getKey();
            }

            List<Boolean> correctness = correctnessByGesture.get(entry.getKey());
            int correct = 0;
            for (boolean b : correctness) {
                if (b) correct++;
            }
            double acc = (double) correct / correctness.size();
            if (acc < worstAcc) {
                worstAcc = acc;
                worstGesture = entry.getKey();
            }
        }
        metrics.mostUsedGesture = maxUsed;
        metrics.hardestGesture = worstGesture;

        // 3. Calculate Gesture Drift and Prototype Health
        for (String label : countsByGesture.keySet()) {
            List<Double> confidences = confidenceByGesture.get(label);
            
            // Drift calculation: standard deviation of confidence values
            double avg = confidences.stream().mapToDouble(val -> val).average().orElse(1.0);
            double varSum = 0.0;
            for (double c : confidences) {
                varSum += Math.pow(c - avg, 2);
            }
            double drift = Math.sqrt(varSum / confidences.size());
            metrics.gestureDrift.put(label, Math.round(drift * 100.0) / 100.0);

            // Prototype Health: average confidence weighted by accuracy
            List<Boolean> correctness = correctnessByGesture.get(label);
            long correct = correctness.stream().filter(b -> b).count();
            double acc = (double) correct / correctness.size();
            metrics.prototypeHealth.put(label, (double) Math.round((0.4 * acc + 0.6 * avg) * 100.0));
        }

        // 4. Calculate Most Improved Gesture (comparing first 50% vs second 50% of history for each gesture)
        String improvedGesture = "N/A";
        double maxImprovement = -1.0;
        for (Map.Entry<String, List<Boolean>> entry : correctnessByGesture.entrySet()) {
            List<Boolean> list = entry.getValue();
            if (list.size() >= 4) {
                int mid = list.size() / 2;
                long firstHalfCorrect = list.subList(0, mid).stream().filter(b -> b).count();
                long secondHalfCorrect = list.subList(mid, list.size()).stream().filter(b -> b).count();
                
                double firstAcc = (double) firstHalfCorrect / mid;
                double secondAcc = (double) secondHalfCorrect / (list.size() - mid);
                double improvement = secondAcc - firstAcc;
                if (improvement > maxImprovement) {
                    maxImprovement = improvement;
                    improvedGesture = entry.getKey();
                }
            }
        }
        metrics.mostImprovedGesture = improvedGesture;

        // 5. Global trajectory trend
        if (logs.size() >= 6) {
            int mid = logs.size() / 2;
            long firstHalfCorrect = logs.subList(0, mid).stream().filter(l -> l.getCorrect() != null && l.getCorrect()).count();
            long secondHalfCorrect = logs.subList(mid, logs.size()).stream().filter(l -> l.getCorrect() != null && l.getCorrect()).count();
            double firstAcc = (double) firstHalfCorrect / mid;
            double secondAcc = (double) secondHalfCorrect / (logs.size() - mid);

            if (secondAcc - firstAcc > 0.05) {
                metrics.learningTrajectory = "IMPROVING";
            } else if (firstAcc - secondAcc > 0.05) {
                metrics.learningTrajectory = "DECLINING";
            } else {
                metrics.learningTrajectory = "STABLE";
            }
        } else {
            metrics.learningTrajectory = "STABLE";
        }

        // 6. User Proficiency Score calculation
        double accuracyWeight = metrics.overallAccuracy * 70.0;
        double volumeWeight = Math.min(30.0, (logs.size() / 50.0) * 30.0);
        metrics.userProficiencyScore = Math.max(0.0, Math.min(100.0, accuracyWeight + volumeWeight));

        return metrics;
    }
}
