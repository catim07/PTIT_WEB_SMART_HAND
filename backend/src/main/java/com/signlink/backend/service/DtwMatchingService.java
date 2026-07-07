package com.signlink.backend.service;

import org.springframework.stereotype.Service;

@Service
public class DtwMatchingService {

    // Feature dimension weights (44 elements corresponding to our schema)
    private static final double[] FEATURE_WEIGHTS = new double[44];

    static {
        // Hand shape (angles): indices 0-14
        for (int i = 0; i <= 14; i++) FEATURE_WEIGHTS[i] = 1.0;
        // Fingertip-to-wrist normalized distances: indices 15-19 (critical for open/closed hand shapes)
        for (int i = 15; i <= 19; i++) FEATURE_WEIGHTS[i] = 1.8;
        // Palm orientation normals: indices 20-22
        for (int i = 20; i <= 22; i++) FEATURE_WEIGHTS[i] = 1.2;
        // Wrist velocities: indices 23-25
        for (int i = 23; i <= 25; i++) FEATURE_WEIGHTS[i] = 0.8;
        // Wrist accelerations: indices 26-28
        for (int i = 26; i <= 28; i++) FEATURE_WEIGHTS[i] = 0.4;
        // Relative body/face coordinates (nose, shoulders): indices 29-37 (vital for spatial gestures)
        for (int i = 29; i <= 37; i++) FEATURE_WEIGHTS[i] = 2.0;
        // Left-to-Right displacement: indices 38-40
        for (int i = 38; i <= 40; i++) FEATURE_WEIGHTS[i] = 1.2;
        // Trajectory direction: indices 41-43
        for (int i = 41; i <= 43; i++) FEATURE_WEIGHTS[i] = 1.5;
    }

    /**
     * Computes the normalized DTW distance between an input sequence X and a template sequence Y.
     */
    public double computeDtwDistance(double[][] seqX, double[][] seqY) {
        int n = seqX.length;
        int m = seqY.length;

        if (n == 0 || m == 0) return Double.MAX_VALUE;

        // DP table
        double[][] dp = new double[n + 1][m + 1];

        // Initialize table
        dp[0][0] = 0.0;
        for (int i = 1; i <= n; i++) dp[i][0] = Double.MAX_VALUE;
        for (int j = 1; j <= m; j++) dp[0][j] = Double.MAX_VALUE;

        // Fill table
        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= m; j++) {
                double cost = calculateWeightedDistance(seqX[i - 1], seqY[j - 1]);
                double minPrev = Math.min(
                        dp[i - 1][j], // Insertion
                        Math.min(
                                dp[i][j - 1],   // Deletion
                                dp[i - 1][j - 1] // Match
                        )
                );
                
                if (minPrev == Double.MAX_VALUE) {
                    dp[i][j] = Double.MAX_VALUE;
                } else {
                    dp[i][j] = cost + minPrev;
                }
            }
        }

        // Return normalized distance by total path length
        return dp[n][m] / (n + m);
    }

    /**
     * Calculates the weighted Euclidean distance between two feature frames.
     */
    private double calculateWeightedDistance(double[] frameA, double[] frameB) {
        double sum = 0.0;
        double weightSum = 0.0;
        int len = Math.min(frameA.length, Math.min(frameB.length, FEATURE_WEIGHTS.length));

        for (int i = 0; i < len; i++) {
            double diff = frameA[i] - frameB[i];
            double w = FEATURE_WEIGHTS[i];
            sum += w * diff * diff;
            weightSum += w;
        }

        return Math.sqrt(sum / weightSum);
    }
}
