package com.signlink.backend.engine;

import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class ExplainabilityEngine {

    public static class GestureExplanation {
        public String label;
        public double confidence;
        public String generalFeedback;
        public List<String> detailedDeviations = new ArrayList<>();
        
        // Match percentages for different feature categories (0% - 100%)
        public double fingerMatchPercentage;
        public double palmMatchPercentage;
        public double motionMatchPercentage;
        public double bodyMatchPercentage;
        public double trajectoryMatchPercentage;
    }

    /**
     * Examines geometric differences between input vector and prototype centroid to explain predictions.
     */
    public GestureExplanation explainPrediction(double[] lastInputFrame, double[] lastProtoFrame, String label, double confidence) {
        GestureExplanation explanation = new GestureExplanation();
        explanation.label = label;
        explanation.confidence = confidence;

        // 1. Calculate category-level match percentages
        explanation.fingerMatchPercentage = calculateCategoryScore(lastInputFrame, lastProtoFrame, 0, 19, 2.0);
        explanation.palmMatchPercentage = calculateCategoryScore(lastInputFrame, lastProtoFrame, 20, 22, 2.5);
        explanation.motionMatchPercentage = calculateCategoryScore(lastInputFrame, lastProtoFrame, 23, 28, 1.5);
        explanation.bodyMatchPercentage = calculateCategoryScore(lastInputFrame, lastProtoFrame, 29, 37, 2.0);
        explanation.trajectoryMatchPercentage = calculateCategoryScore(lastInputFrame, lastProtoFrame, 41, 43, 2.0);

        // 2. Identify the single largest deviation to generate feedback
        String[] featureNames = getFeatureNames();
        double maxDiff = -1.0;
        int maxDiffIdx = -1;

        for (int d = 0; d < 44; d++) {
            double diff = Math.abs(lastInputFrame[d] - lastProtoFrame[d]);
            if ((d < 23 || (d >= 29 && d <= 37)) && diff > maxDiff) {
                maxDiff = diff;
                maxDiffIdx = d;
            }
        }

        // 3. Generate precise human-readable Vietnamese feedback
        if (maxDiffIdx != -1 && maxDiff > 0.12) {
            String featureName = featureNames[maxDiffIdx];
            double inputValue = lastInputFrame[maxDiffIdx];
            double protoValue = lastProtoFrame[maxDiffIdx];

            if (maxDiffIdx < 15) {
                // Knuckle angle error (flexion)
                double deg = Math.toDegrees(maxDiff);
                String action = (inputValue < protoValue) ? "cong thêm" : "duỗi thẳng thêm";
                explanation.generalFeedback = String.format("Sai ở: %s. Nên %s %.0f°.", 
                        featureName, action, deg);
                explanation.detailedDeviations.add(String.format("%s lệch %.1f độ (%s).", featureName, deg, action));
            } else if (maxDiffIdx >= 15 && maxDiffIdx < 20) {
                // Fingertip-wrist extension
                String action = (inputValue < protoValue) ? "duỗi dài ngón tay ra" : "thu ngắn/gập ngón tay lại";
                explanation.generalFeedback = String.format("Sai ở: %s. Cần %s.", featureName, action);
            } else if (maxDiffIdx >= 29 && maxDiffIdx <= 31) {
                // Hand to Nose/Mouth distance (scale: shoulder width ~35cm)
                double cm = Math.round(maxDiff * 35.0);
                String action = (inputValue > protoValue) ? "kéo gần miệng hơn" : "đặt xa miệng ra";
                explanation.generalFeedback = String.format("Bàn tay cách miệng quá %s khoảng %.0f cm.", 
                        (inputValue > protoValue ? "xa" : "gần"), cm);
                explanation.detailedDeviations.add(String.format("Khoảng cách tay-miệng lệch %.0f cm (hãy %s).", cm, action));
            } else if (maxDiffIdx >= 32 && maxDiffIdx <= 37) {
                // Hand to shoulders
                double cm = Math.round(maxDiff * 35.0);
                String action = (inputValue > protoValue) ? "nâng cao lên" : "hạ thấp xuống";
                explanation.generalFeedback = String.format("Vị trí tay cách vai lệch khoảng %.0f cm (hãy %s).", cm, action);
            } else {
                explanation.generalFeedback = String.format("Cử chỉ '%s' khớp %.0f%%. Vui lòng giữ tư thế vững vàng.", label, confidence * 100);
            }
        } else {
            explanation.generalFeedback = String.format("Cử chỉ '%s' chính xác %.0f%%. Hoạt động khớp hoàn hảo.", label, confidence * 100);
        }

        return explanation;
    }

    private double calculateCategoryScore(double[] input, double[] proto, int startIdx, int endIdx, double scalingFactor) {
        double diffSum = 0.0;
        int count = 0;
        for (int d = startIdx; d <= endIdx; d++) {
            diffSum += Math.abs(input[d] - proto[d]);
            count++;
        }
        double avgDiff = diffSum / Math.max(1, count);
        double score = (1.0 - scalingFactor * avgDiff) * 100.0;
        return Math.max(0.0, Math.min(100.0, score));
    }

    private String[] getFeatureNames() {
        String[] featureNames = new String[44];
        for (int i = 0; i < 15; i++) {
            int fingerIdx = i / 3;
            int jointIdx = i % 3;
            featureNames[i] = "Ngón " + getFingerName(fingerIdx) + " (" + getJointName(jointIdx) + ")";
        }
        for (int i = 15; i < 20; i++) {
            featureNames[i] = "Độ xòe ngón " + getFingerName(i - 15);
        }
        featureNames[20] = "Góc nghiêng bàn tay X";
        featureNames[21] = "Góc nghiêng bàn tay Y";
        featureNames[22] = "Góc nghiêng bàn tay Z";
        featureNames[23] = "Tốc độ tay X";
        featureNames[24] = "Tốc độ tay Y";
        featureNames[25] = "Tốc độ tay Z";
        featureNames[26] = "Gia tốc tay X";
        featureNames[27] = "Gia tốc tay Y";
        featureNames[28] = "Gia tốc tay Z";
        featureNames[29] = "Khoảng cách tay - miệng X";
        featureNames[30] = "Khoảng cách tay - miệng Y";
        featureNames[31] = "Khoảng cách tay - miệng Z";
        featureNames[32] = "Vị trí vai trái X";
        featureNames[33] = "Vị trí vai trái Y";
        featureNames[34] = "Vị trí vai trái Z";
        featureNames[35] = "Vị trí vai phải X";
        featureNames[36] = "Vị trí vai phải Y";
        featureNames[37] = "Vị trí vai phải Z";
        featureNames[38] = "Khoảng cách hai tay X";
        featureNames[39] = "Khoảng cách hai tay Y";
        featureNames[40] = "Khoảng cách hai tay Z";
        featureNames[41] = "Quỹ đạo tay X";
        featureNames[42] = "Quỹ đạo tay Y";
        featureNames[43] = "Quỹ đạo tay Z";
        return featureNames;
    }

    private String getFingerName(int idx) {
        switch (idx) {
            case 0: return "cái";
            case 1: return "trỏ";
            case 2: return "giữa";
            case 3: return "áp út";
            case 4: return "út";
            default: return "tay";
        }
    }

    private String getJointName(int idx) {
        switch (idx) {
            case 0: return "khớp gốc";
            case 1: return "khớp giữa";
            case 2: return "khớp đầu ngón";
            default: return "khớp";
        }
    }
}
