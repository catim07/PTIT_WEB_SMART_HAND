package com.signlink.backend.service;

import com.signlink.backend.dto.Landmark;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class FeatureExtractorService {

    /**
     * Converts a raw sequence of coordinate frames into a sequence of 44-dimensional feature vectors.
     * 
     * Feature Vector Schema (44 dimensions):
     * - 0-14: 15 Finger joint angles (3 joints per finger * 5 fingers)
     * - 15-19: 5 Normalized fingertip-to-wrist distances
     * - 20-22: 3 Palm orientation normal vector coordinates (x, y, z)
     * - 23-25: 3 Hand velocity coordinates (x, y, z)
     * - 26-28: 3 Hand acceleration coordinates (x, y, z)
     * - 29-31: 3 Relative wrist-to-nose coordinates (x, y, z)
     * - 32-34: 3 Relative wrist-to-left-shoulder coordinates (x, y, z)
     * - 35-37: 3 Relative wrist-to-right-shoulder coordinates (x, y, z)
     * - 38-40: 3 Left-to-Right hand displacement vector (x, y, z)
     * - 41-43: 3 Dynamic trajectory direction vector (x, y, z)
     */
    public List<double[]> extractFeatureSequence(
            List<Landmark[]> leftHandSeq,
            List<Landmark[]> rightHandSeq,
            List<Landmark[]> poseSeq,
            List<Landmark[]> faceSeq) {

        int length = leftHandSeq.size();
        List<double[]> featureSeq = new ArrayList<>();

        for (int t = 0; t < length; t++) {
            Landmark[] leftHand = leftHandSeq.get(t);
            Landmark[] rightHand = rightHandSeq.get(t);
            Landmark[] pose = poseSeq.get(t);
            Landmark[] face = faceSeq.get(t);

            // Use primary active hand (prefer right hand, default to left hand if right is missing)
            Landmark[] activeHand = (rightHand != null && rightHand.length == 21) ? rightHand : leftHand;
            boolean handPresent = (activeHand != null && activeHand.length == 21);

            double[] f = new double[44];

            // 1. Hand Shape Features
            if (handPresent) {
                // A. Knuckle Angles (15 features)
                int[][] fingers = {
                    {0, 1, 2, 3, 4},    // Thumb
                    {0, 5, 6, 7, 8},    // Index
                    {0, 9, 10, 11, 12}, // Middle
                    {0, 13, 14, 15, 16},// Ring
                    {0, 17, 18, 19, 20} // Pinky
                };

                int idx = 0;
                for (int i = 0; i < 5; i++) {
                    // MCP angle (joints 0-1-2 or 0-5-6)
                    f[idx++] = calculateAngle(activeHand[fingers[i][0]], activeHand[fingers[i][1]], activeHand[fingers[i][2]]);
                    // PIP angle (joints 1-2-3 or 5-6-7)
                    f[idx++] = calculateAngle(activeHand[fingers[i][1]], activeHand[fingers[i][2]], activeHand[fingers[i][3]]);
                    // DIP angle (joints 2-3-4 or 6-7-8)
                    f[idx++] = calculateAngle(activeHand[fingers[i][2]], activeHand[fingers[i][3]], activeHand[fingers[i][4]]);
                }

                // B. Fingertip-to-Wrist distances (5 features)
                double handScale = distance3d(activeHand[0], activeHand[9]);
                if (handScale < 0.001) handScale = 1.0;
                int[] tips = {4, 8, 12, 16, 20};
                for (int i = 0; i < 5; i++) {
                    f[idx++] = distance3d(activeHand[tips[i]], activeHand[0]) / handScale;
                }

                // C. Palm Normal Vector (3 features)
                double[] normal = calculatePalmNormal(activeHand);
                f[idx++] = normal[0];
                f[idx++] = normal[1];
                f[idx++] = normal[2];
            } else {
                // Default hand features to 0.0 if hand is missing
                for (int i = 0; i < 23; i++) {
                    f[i] = 0.0;
                }
            }

            // 2. Motion / Velocity Features
            double dt = 1.0 / 30.0; // Assume 30 FPS default
            Landmark wrist = (handPresent) ? activeHand[0] : null;

            if (t > 0 && wrist != null) {
                Landmark[] prevHand = (rightHandSeq.get(t - 1) != null && rightHandSeq.get(t - 1).length == 21) ? rightHandSeq.get(t - 1) : leftHandSeq.get(t - 1);
                if (prevHand != null && prevHand.length == 21) {
                    Landmark prevWrist = prevHand[0];
                    f[23] = (wrist.getX() - prevWrist.getX()) / dt;
                    f[24] = (wrist.getY() - prevWrist.getY()) / dt;
                    f[25] = (wrist.getZ() - prevWrist.getZ()) / dt;

                    // Acceleration
                    if (t > 1) {
                        Landmark[] prevPrevHand = (rightHandSeq.get(t - 2) != null && rightHandSeq.get(t - 2).length == 21) ? rightHandSeq.get(t - 2) : leftHandSeq.get(t - 2);
                        if (prevPrevHand != null && prevPrevHand.length == 21) {
                            Landmark prevPrevWrist = prevPrevHand[0];
                            double prevVx = (prevWrist.getX() - prevPrevWrist.getX()) / dt;
                            double prevVy = (prevWrist.getY() - prevPrevWrist.getY()) / dt;
                            double prevVz = (prevWrist.getZ() - prevPrevWrist.getZ()) / dt;

                            f[26] = (f[23] - prevVx) / dt;
                            f[27] = (f[24] - prevVy) / dt;
                            f[28] = (f[25] - prevVz) / dt;
                        }
                    }
                }
            }

            // 3. Body-Hand and Face-Hand Relationships
            double shoulderScale = 1.0;
            if (pose != null && pose.length > 12) {
                shoulderScale = distance3d(pose[11], pose[12]);
                if (shoulderScale < 0.001) shoulderScale = 1.0;
            }

            if (wrist != null) {
                // Relative to Nose (pose 0 or face center)
                Landmark nose = (pose != null && pose.length > 0) ? pose[0] : null;
                if (nose != null) {
                    f[29] = (wrist.getX() - nose.getX()) / shoulderScale;
                    f[30] = (wrist.getY() - nose.getY()) / shoulderScale;
                    f[31] = (wrist.getZ() - nose.getZ()) / shoulderScale;
                }

                // Relative to Left Shoulder (pose 11)
                Landmark lShoulder = (pose != null && pose.length > 11) ? pose[11] : null;
                if (lShoulder != null) {
                    f[32] = (wrist.getX() - lShoulder.getX()) / shoulderScale;
                    f[33] = (wrist.getY() - lShoulder.getY()) / shoulderScale;
                    f[34] = (wrist.getZ() - lShoulder.getZ()) / shoulderScale;
                }

                // Relative to Right Shoulder (pose 12)
                Landmark rShoulder = (pose != null && pose.length > 12) ? pose[12] : null;
                if (rShoulder != null) {
                    f[35] = (wrist.getX() - rShoulder.getX()) / shoulderScale;
                    f[36] = (wrist.getY() - rShoulder.getY()) / shoulderScale;
                    f[37] = (wrist.getZ() - rShoulder.getZ()) / shoulderScale;
                }
            }

            // Left-to-Right displacement
            if (leftHand != null && leftHand.length == 21 && rightHand != null && rightHand.length == 21) {
                f[38] = leftHand[0].getX() - rightHand[0].getX();
                f[39] = leftHand[0].getY() - rightHand[0].getY();
                f[40] = leftHand[0].getZ() - rightHand[0].getZ();
            }

            // Trajectory direction (wrist displacement over last 5 frames)
            if (t >= 5 && wrist != null) {
                Landmark[] oldHand = (rightHandSeq.get(t - 5) != null && rightHandSeq.get(t - 5).length == 21) ? rightHandSeq.get(t - 5) : leftHandSeq.get(t - 5);
                if (oldHand != null && oldHand.length == 21) {
                    double dx = wrist.getX() - oldHand[0].getX();
                    double dy = wrist.getY() - oldHand[0].getY();
                    double dz = wrist.getZ() - oldHand[0].getZ();
                    double mag = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (mag > 0.001) {
                        f[41] = dx / mag;
                        f[42] = dy / mag;
                        f[43] = dz / mag;
                    }
                }
            }

            featureSeq.add(f);
        }

        return featureSeq;
    }

    private double calculateAngle(Landmark a, Landmark b, Landmark c) {
        if (a == null || b == null || c == null) return 0.0;
        double[] v1 = { a.getX() - b.getX(), a.getY() - b.getY(), a.getZ() - b.getZ() };
        double[] v2 = { c.getX() - b.getX(), c.getY() - b.getY(), c.getZ() - b.getZ() };

        double dot = v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
        double mag1 = Math.sqrt(v1[0]*v1[0] + v1[1]*v1[1] + v1[2]*v1[2]);
        double mag2 = Math.sqrt(v2[0]*v2[0] + v2[1]*v2[1] + v2[2]*v2[2]);

        if (mag1 * mag2 < 0.0001) return 0.0;
        double cosTheta = dot / (mag1 * mag2);
        // Clamp to avoid NaN in acos
        cosTheta = Math.max(-1.0, Math.min(1.0, cosTheta));
        return Math.acos(cosTheta);
    }

    private double distance3d(Landmark a, Landmark b) {
        if (a == null || b == null) return 0.0;
        double dx = a.getX() - b.getX();
        double dy = a.getY() - b.getY();
        double dz = a.getZ() - b.getZ();
        return Math.sqrt(dx*dx + dy*dy + dz*dz);
    }

    private double[] calculatePalmNormal(Landmark[] hand) {
        // wrist is 0, index MCP is 5, pinky MCP is 17
        Landmark w = hand[0];
        Landmark idx = hand[5];
        Landmark pnk = hand[17];

        double[] v1 = { idx.getX() - w.getX(), idx.getY() - w.getY(), idx.getZ() - w.getZ() };
        double[] v2 = { pnk.getX() - w.getX(), pnk.getY() - w.getY(), pnk.getZ() - w.getZ() };

        // Cross product v1 x v2
        double[] normal = {
            v1[1]*v2[2] - v1[2]*v2[1],
            v1[2]*v2[0] - v1[0]*v2[2],
            v1[0]*v2[1] - v1[1]*v2[0]
        };

        double mag = Math.sqrt(normal[0]*normal[0] + normal[1]*normal[1] + normal[2]*normal[2]);
        if (mag > 0.0001) {
            normal[0] /= mag;
            normal[1] /= mag;
            normal[2] /= mag;
        }
        return normal;
    }
}
