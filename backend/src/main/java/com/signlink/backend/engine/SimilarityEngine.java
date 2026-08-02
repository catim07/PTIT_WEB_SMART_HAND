package com.signlink.backend.engine;

import org.springframework.stereotype.Component;

@Component
public class SimilarityEngine {

    /**
     * Calculates Adaptive DTW++ alignment distance between input sequence and template sequence.
     * Incorporates custom weights, temporal penalties, speed mismatches, and orientation/rotation checks.
     */
    public double computeAdaptiveDtw(double[][] input, double[][] template, double[] weights, double speedMultiplier) {
        int n = input.length;
        int m = template.length;
        if (n == 0 || m == 0) return Double.MAX_VALUE;

        // 1. Sakoe-Chiba constraint band width (optimizes search window dynamically)
        double baseW = Math.max(3.0, Math.max(n, m) * 0.12);
        double lengthRatio = (double) Math.abs(n - m) / Math.max(1, Math.max(n, m));
        double adaptiveFactor = 0.6 + 0.4 * lengthRatio; // Shrinks search space if sequences have similar lengths
        int w = (int) Math.round(baseW * Math.max(0.5, Math.min(2.5, speedMultiplier * adaptiveFactor)));
        w = Math.max(2, w); // Ensure a minimum band width of 2 to avoid path blocking

        double[][] dtw = new double[n + 1][m + 1];
        for (int i = 0; i <= n; i++) {
            for (int j = 0; j <= m; j++) {
                dtw[i][j] = Double.MAX_VALUE;
            }
        }
        dtw[0][0] = 0.0;

        // Optimized feature weighting: Prioritize finger geometry (0..22) by 3.5x, suppress pose noise (23..43) to 0.1x
        double[] featureWeights = new double[44];
        for (int k = 0; k < 44; k++) {
            double initW = (weights != null && weights.length == 44) ? weights[k] : 1.0;
            if (k <= 22) {
                featureWeights[k] = initW * 3.5;
            } else {
                featureWeights[k] = initW * 0.1;
            }
        }

        // 2. Perform Dynamic Programming DTW Alignment
        for (int i = 1; i <= n; i++) {
            int start = Math.max(1, i - w);
            int end = Math.min(m, i + w);

            for (int j = start; j <= end; j++) {
                double dist = weightedEuclideanDistance(input[i - 1], template[j - 1], featureWeights);
                double minPrev = Math.min(dtw[i - 1][j], Math.min(dtw[i][j - 1], dtw[i - 1][j - 1]));
                if (minPrev != Double.MAX_VALUE) {
                    dtw[i][j] = dist + minPrev;
                }
            }
        }

        double rawDtw = dtw[n][m] / (n + m);

        // 3. Compute Penalties
        double speedPenalty = calculateSpeedPenalty(input, template);
        double rotationPenalty = calculateRotationPenalty(input, template);
        double temporalPenalty = 0.1 * Math.abs(n - m) / Math.max(n, m);

        // Adaptive DTW++ = DTW + Speed Penalty + Rotation Penalty + Temporal Penalty
        return rawDtw + speedPenalty + rotationPenalty + temporalPenalty;
    }

    /**
     * Weighted Euclidean Distance between two feature frames.
     */
    private double weightedEuclideanDistance(double[] a, double[] b, double[] weights) {
        double weightedSum = 0.0;
        double sumWeights = 0.0;
        for (int d = 0; d < Math.min(a.length, weights.length); d++) {
            double diff = a[d] - b[d];
            double w = weights[d];
            weightedSum += w * diff * diff;
            sumWeights += w;
        }
        return sumWeights > 0.0 ? Math.sqrt(weightedSum / sumWeights) : 0.0;
    }

    /**
     * Speed Penalty: Evaluates velocity profile mismatch (feature indices 23, 24, 25).
     */
    private double calculateSpeedPenalty(double[][] input, double[][] template) {
        double inputSpeedSum = 0.0;
        for (double[] frame : input) {
            double vx = frame[23];
            double vy = frame[24];
            double vz = frame[25];
            inputSpeedSum += Math.sqrt(vx * vx + vy * vy + vz * vz);
        }
        double avgInputSpeed = inputSpeedSum / Math.max(1, input.length);

        double templateSpeedSum = 0.0;
        for (double[] frame : template) {
            double vx = frame[23];
            double vy = frame[24];
            double vz = frame[25];
            templateSpeedSum += Math.sqrt(vx * vx + vy * vy + vz * vz);
        }
        double avgTemplateSpeed = templateSpeedSum / Math.max(1, template.length);

        return 0.15 * Math.abs(avgInputSpeed - avgTemplateSpeed);
    }

    /**
     * Rotation Penalty: Evaluates normal plane orientation mismatch (feature indices 20, 21, 22).
     */
    private double calculateRotationPenalty(double[][] input, double[][] template) {
        double[] inputNormal = averageNormal(input);
        double[] templateNormal = averageNormal(template);

        double dot = inputNormal[0] * templateNormal[0] +
                     inputNormal[1] * templateNormal[1] +
                     inputNormal[2] * templateNormal[2];
        
        // Dot product of normalized vectors ranges from -1 to 1
        // Rotation penalty increases as palm normals face different directions
        return 0.2 * (1.0 - Math.max(-1.0, Math.min(1.0, dot)));
    }

    private double[] averageNormal(double[][] sequence) {
        double nx = 0.0, ny = 0.0, nz = 0.0;
        for (double[] frame : sequence) {
            nx += frame[20];
            ny += frame[21];
            nz += frame[22];
        }
        double len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 0.001) {
            return new double[]{0.0, 1.0, 0.0}; // Default upward facing normal
        }
        return new double[]{nx / len, ny / len, nz / len};
    }
}
