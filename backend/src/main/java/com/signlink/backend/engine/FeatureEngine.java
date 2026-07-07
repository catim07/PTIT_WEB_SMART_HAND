package com.signlink.backend.engine;

import com.signlink.backend.dto.Landmark;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;

@Component
public class FeatureEngine {

    public static class GestureSignature {
        public double[][] featureVectors; // Standardized resampled (30x44) representation
        public double averageVelocity;    // Mean kinetic speed of the active hand
        public double peakAcceleration;   // Maximum kinetic impulse
        public double spatialExtension;   // Max bounding volume enclosing the movement path
        public boolean isJittery;         // Flag indicating high noise ratio
        public double completenessScore;  // Ratio of valid landmarks over sequence
    }

    /**
     * Extracts coordinates, performs quality checks, and computes structural signature.
     */
    public GestureSignature computeSignature(
            List<Landmark[]> leftHandSeq,
            List<Landmark[]> rightHandSeq,
            List<Landmark[]> poseSeq,
            List<Landmark[]> faceSeq) {

        GestureSignature signature = new GestureSignature();
        int length = leftHandSeq.size();
        
        // 1. Data Quality and Completeness check
        int totalFrames = Math.max(1, length);
        int validHandFrames = 0;
        double totalJitter = 0.0;
        double maxSpeed = 0.0;
        double maxAccel = 0.0;
        
        List<double[]> features = new ArrayList<>();
        
        for (int t = 0; t < length; t++) {
            Landmark[] leftHand = leftHandSeq.get(t);
            Landmark[] rightHand = rightHandSeq.get(t);
            Landmark[] pose = poseSeq.get(t);
            Landmark[] face = faceSeq.get(t);

            Landmark[] activeHand = (rightHand != null && rightHand.length == 21 && isHandActive(rightHand)) ? rightHand : leftHand;
            boolean handPresent = (activeHand != null && activeHand.length == 21 && isHandActive(activeHand));
            if (handPresent) {
                validHandFrames++;
            }

            double[] f = extractFrameFeatures(activeHand, handPresent, pose, leftHandSeq, rightHandSeq, t);
            features.add(f);

            // Jitter and kinetic computation
            if (t > 0 && handPresent) {
                double vx = f[23];
                double vy = f[24];
                double vz = f[25];
                double speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
                if (speed > maxSpeed) maxSpeed = speed;
                totalJitter += speed;

                if (t > 1) {
                    double ax = f[26];
                    double ay = f[27];
                    double az = f[28];
                    double accel = Math.sqrt(ax*ax + ay*ay + az*az);
                    if (accel > maxAccel) maxAccel = accel;
                }
            }
        }

        signature.completenessScore = (double) validHandFrames / totalFrames;
        signature.averageVelocity = totalJitter / totalFrames;
        signature.peakAcceleration = maxAccel;
        signature.isJittery = (maxSpeed > 8.0 || maxAccel > 45.0); // Outlier physical limits threshold

        // Resample features to standard size (30 frames)
        double[][] rawFeatures = features.toArray(new double[0][0]);
        signature.featureVectors = resampleFeatures(rawFeatures, 30);

        // Compute spatial bound extension (bounding box volume)
        signature.spatialExtension = computeBoundingVolume(leftHandSeq, rightHandSeq);

        return signature;
    }

    private boolean isHandActive(Landmark[] hand) {
        if (hand == null) return false;
        double sum = 0.0;
        for (Landmark l : hand) {
            if (l != null) {
                sum += Math.abs(l.getX()) + Math.abs(l.getY());
            }
        }
        return sum > 0.001; // Reject dead zero coordinates
    }

    private double[][] resampleFeatures(double[][] original, int targetLength) {
        int n = original.length;
        if (n == 0) return new double[targetLength][44];
        if (n == targetLength) return original;

        double[][] resampled = new double[targetLength][44];
        for (int i = 0; i < targetLength; i++) {
            double relativePos = (double) i * (n - 1) / (targetLength - 1);
            int low = (int) Math.floor(relativePos);
            int high = (int) Math.ceil(relativePos);
            double weight = relativePos - low;

            for (int d = 0; d < 44; d++) {
                if (low == high) {
                    resampled[i][d] = original[low][d];
                } else {
                    resampled[i][d] = (1.0 - weight) * original[low][d] + weight * original[high][d];
                }
            }
        }
        return resampled;
    }

    private double[] extractFrameFeatures(
            Landmark[] activeHand, boolean handPresent, Landmark[] pose,
            List<Landmark[]> leftHandSeq, List<Landmark[]> rightHandSeq, int t) {

        double[] f = new double[44];
        if (handPresent) {
            int[][] fingers = {
                {0, 1, 2, 3, 4}, {0, 5, 6, 7, 8}, {0, 9, 10, 11, 12}, {0, 13, 14, 15, 16}, {0, 17, 18, 19, 20}
            };
            int idx = 0;
            for (int i = 0; i < 5; i++) {
                f[idx++] = calculateAngle(activeHand[fingers[i][0]], activeHand[fingers[i][1]], activeHand[fingers[i][2]]);
                f[idx++] = calculateAngle(activeHand[fingers[i][1]], activeHand[fingers[i][2]], activeHand[fingers[i][3]]);
                f[idx++] = calculateAngle(activeHand[fingers[i][2]], activeHand[fingers[i][3]], activeHand[fingers[i][4]]);
            }

            double handScale = distance3d(activeHand[0], activeHand[9]);
            if (handScale < 0.001) handScale = 1.0;
            int[] tips = {4, 8, 12, 16, 20};
            for (int i = 0; i < 5; i++) {
                f[idx++] = distance3d(activeHand[tips[i]], activeHand[0]) / handScale;
            }

            double[] normal = calculatePalmNormal(activeHand);
            f[idx++] = normal[0];
            f[idx++] = normal[1];
            f[idx++] = normal[2];
        }

        double dt = 1.0 / 30.0;
        Landmark wrist = (handPresent) ? activeHand[0] : null;

        if (t > 0 && wrist != null) {
            Landmark[] prevHand = (rightHandSeq.get(t - 1) != null && rightHandSeq.get(t - 1).length == 21 && isHandActive(rightHandSeq.get(t - 1))) ? rightHandSeq.get(t - 1) : leftHandSeq.get(t - 1);
            if (prevHand != null && prevHand.length == 21 && isHandActive(prevHand)) {
                Landmark prevWrist = prevHand[0];
                f[23] = (wrist.getX() - prevWrist.getX()) / dt;
                f[24] = (wrist.getY() - prevWrist.getY()) / dt;
                f[25] = (wrist.getZ() - prevWrist.getZ()) / dt;

                if (t > 1) {
                    Landmark[] prevPrevHand = (rightHandSeq.get(t - 2) != null && rightHandSeq.get(t - 2).length == 21 && isHandActive(rightHandSeq.get(t - 2))) ? rightHandSeq.get(t - 2) : leftHandSeq.get(t - 2);
                    if (prevPrevHand != null && prevPrevHand.length == 21 && isHandActive(prevPrevHand)) {
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

        double shoulderScale = 1.0;
        if (pose != null && pose.length > 12) {
            shoulderScale = distance3d(pose[11], pose[12]);
            if (shoulderScale < 0.001) shoulderScale = 1.0;
        }

        if (wrist != null) {
            Landmark nose = (pose != null && pose.length > 0) ? pose[0] : null;
            if (nose != null) {
                f[29] = (wrist.getX() - nose.getX()) / shoulderScale;
                f[30] = (wrist.getY() - nose.getY()) / shoulderScale;
                f[31] = (wrist.getZ() - nose.getZ()) / shoulderScale;
            }

            Landmark lShoulder = (pose != null && pose.length > 11) ? pose[11] : null;
            if (lShoulder != null) {
                f[32] = (wrist.getX() - lShoulder.getX()) / shoulderScale;
                f[33] = (wrist.getY() - lShoulder.getY()) / shoulderScale;
                f[34] = (wrist.getZ() - lShoulder.getZ()) / shoulderScale;
            }

            Landmark rShoulder = (pose != null && pose.length > 12) ? pose[12] : null;
            if (rShoulder != null) {
                f[35] = (wrist.getX() - rShoulder.getX()) / shoulderScale;
                f[36] = (wrist.getY() - rShoulder.getY()) / shoulderScale;
                f[37] = (wrist.getZ() - rShoulder.getZ()) / shoulderScale;
            }
        }

        Landmark leftWrist = (leftHandSeq.get(t) != null && leftHandSeq.get(t).length == 21 && isHandActive(leftHandSeq.get(t))) ? leftHandSeq.get(t)[0] : null;
        Landmark rightWrist = (rightHandSeq.get(t) != null && rightHandSeq.get(t).length == 21 && isHandActive(rightHandSeq.get(t))) ? rightHandSeq.get(t)[0] : null;
        if (leftWrist != null && rightWrist != null) {
            f[38] = leftWrist.getX() - rightWrist.getX();
            f[39] = leftWrist.getY() - rightWrist.getY();
            f[40] = leftWrist.getZ() - rightWrist.getZ();
        }

        if (t >= 5 && wrist != null) {
            Landmark[] oldHand = (rightHandSeq.get(t - 5) != null && rightHandSeq.get(t - 5).length == 21 && isHandActive(rightHandSeq.get(t - 5))) ? rightHandSeq.get(t - 5) : leftHandSeq.get(t - 5);
            if (oldHand != null && oldHand.length == 21 && isHandActive(oldHand)) {
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
        return f;
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
        Landmark w = hand[0];
        Landmark idx = hand[5];
        Landmark pnk = hand[17];
        double[] v1 = { idx.getX() - w.getX(), idx.getY() - w.getY(), idx.getZ() - w.getZ() };
        double[] v2 = { pnk.getX() - w.getX(), pnk.getY() - w.getY(), pnk.getZ() - w.getZ() };
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

    private double computeBoundingVolume(List<Landmark[]> leftHandSeq, List<Landmark[]> rightHandSeq) {
        double minX = Double.MAX_VALUE, maxX = -Double.MAX_VALUE;
        double minY = Double.MAX_VALUE, maxY = -Double.MAX_VALUE;
        double minZ = Double.MAX_VALUE, maxZ = -Double.MAX_VALUE;

        for (Landmark[] frame : leftHandSeq) {
            if (frame != null && frame.length == 21 && isHandActive(frame)) {
                for (Landmark l : frame) {
                    if (l.getX() < minX) minX = l.getX();
                    if (l.getX() > maxX) maxX = l.getX();
                    if (l.getY() < minY) minY = l.getY();
                    if (l.getY() > maxY) maxY = l.getY();
                    if (l.getZ() < minZ) minZ = l.getZ();
                    if (l.getZ() > maxZ) maxZ = l.getZ();
                }
            }
        }
        for (Landmark[] frame : rightHandSeq) {
            if (frame != null && frame.length == 21 && isHandActive(frame)) {
                for (Landmark l : frame) {
                    if (l.getX() < minX) minX = l.getX();
                    if (l.getX() > maxX) maxX = l.getX();
                    if (l.getY() < minY) minY = l.getY();
                    if (l.getY() > maxY) maxY = l.getY();
                    if (l.getZ() < minZ) minZ = l.getZ();
                    if (l.getZ() > maxZ) maxZ = l.getZ();
                }
            }
        }

        if (minX == Double.MAX_VALUE) return 0.0;
        double dx = maxX - minX;
        double dy = maxY - minY;
        double dz = maxZ - minZ;
        return dx * dy * dz;
    }
}
