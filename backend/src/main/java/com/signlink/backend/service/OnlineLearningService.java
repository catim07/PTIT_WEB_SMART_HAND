package com.signlink.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.signlink.backend.dto.Landmark;
import com.signlink.backend.model.GesturePrototype;
import com.signlink.backend.model.GestureSample;
import com.signlink.backend.model.RecognitionLog;
import com.signlink.backend.repository.GesturePrototypeRepository;
import com.signlink.backend.repository.GestureSampleRepository;
import com.signlink.backend.repository.RecognitionLogRepository;
import com.signlink.backend.engine.LearningEngine;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class OnlineLearningService {

    @Autowired
    private GestureSampleRepository gestureSampleRepository;

    @Autowired
    private GesturePrototypeRepository gesturePrototypeRepository;

    @Autowired
    private RecognitionLogRepository recognitionLogRepository;

    @Autowired
    private LearningEngine learningEngine;

    private final ObjectMapper mapper = new ObjectMapper();
    private static final int STANDARDIZED_LENGTH = 30; // Resample all templates to 30 frames
    private static final double ALPHA = 0.15; // Moving average adaptation learning rate

    /**
     * Incrementally adapts the gesture prototype with a new sample.
     * Incorporates Novelty Detection (variant creation) and Version Evolution.
     */
    @Transactional
    public void adaptPrototypeOnline(String label, UUID userId, double[][] newFeatures, Landmark[][] newLandmarks) {
        String cleanLabel = label.toUpperCase().trim();
        List<GesturePrototype> candidates = gesturePrototypeRepository.findByLabelAndUserIdOrderByVersionDesc(cleanLabel, userId);
        if (candidates.isEmpty()) {
            candidates = gesturePrototypeRepository.findByLabelOrderByVersionDesc(cleanLabel);
        }

        if (candidates.isEmpty()) return; // No prototype to adapt

        // Find the active template
        GesturePrototype activeProto = candidates.get(0);

        try {
            double[][] protoFeatures = mapper.readValue(activeProto.getFeatureVectors(), double[][].class);
            double[][] resampledNewFeatures = resampleFeatures(newFeatures, STANDARDIZED_LENGTH);

            // 1. Duplicate check
            List<double[][]> existing = new ArrayList<>();
            existing.add(protoFeatures);
            if (learningEngine.detectDuplicate(resampledNewFeatures, existing, 0.04)) {
                return; // Duplicate; ignore to prevent over-tuning
            }

            // 2. Compute User Reliability Weight
            List<RecognitionLog> logs = recognitionLogRepository.findAll();
            double reliability = learningEngine.computeUserReliability(logs);

            // 3. Novelty Detection check (DTW distance > 0.48 indicates a variant shape rather than standard execution deviation)
            if (learningEngine.detectNovelty(resampledNewFeatures, protoFeatures, 0.48)) {
                // Spawn a new variant prototype
                int variantNumber = 1;
                for (GesturePrototype gp : candidates) {
                    if (gp.getVariantName() != null) {
                        variantNumber++;
                    }
                }

                String variantName = "Variant " + (variantNumber + 1);

                double[] defaultWeights = new double[44];
                Arrays.fill(defaultWeights, 1.0);

                GesturePrototype variantProto = new GesturePrototype();
                variantProto.setId(UUID.randomUUID());
                variantProto.setLabel(cleanLabel);
                variantProto.setUserId(userId);
                variantProto.setFeatureVectors(mapper.writeValueAsString(resampledNewFeatures));
                variantProto.setLandmarksSequence(mapper.writeValueAsString(newLandmarks));
                variantProto.setSampleCount(1);
                variantProto.setWeight(1.0);
                variantProto.setUpdatedAt(System.currentTimeMillis());
                variantProto.setVersion(1);
                variantProto.setParentId(null);
                variantProto.setVariantName(variantName);
                variantProto.setFeatureWeights(mapper.writeValueAsString(defaultWeights));

                gesturePrototypeRepository.save(variantProto);
                System.out.println(">>> Spawned new variant for " + cleanLabel + ": " + variantName);
                return;
            }

            // 4. Standard Evolution path (Create V_N+1)
            // Perform 2D linear resampling on the target landmarks
            double[][] resampledNewLandmarks = new double[STANDARDIZED_LENGTH][76 * 4]; // resampled landmarks
            try {
                double[][] flatNewLandmarks = convertToFlatDouble(newLandmarks);
                resampledNewLandmarks = resampleDoubleFeatures(flatNewLandmarks, STANDARDIZED_LENGTH, 76 * 4);
            } catch (Exception ex) {
                // fallback if landmarks converting fails
            }

            GesturePrototype evolved = learningEngine.evolvePrototype(activeProto, resampledNewFeatures, resampledNewLandmarks, ALPHA, reliability);
            gesturePrototypeRepository.save(evolved);
            System.out.println(">>> Evolved prototype " + cleanLabel + " to version: V" + evolved.getVersion());

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Rolls back the last evolution child prototype, recovers parent, and applies a penalty.
     */
    @Transactional
    public void rollbackLastEvolution(String label, UUID userId) {
        String cleanLabel = label.toUpperCase().trim();
        List<GesturePrototype> candidates = gesturePrototypeRepository.findByLabelAndUserIdOrderByVersionDesc(cleanLabel, userId);
        if (candidates.isEmpty()) {
            candidates = gesturePrototypeRepository.findByLabelOrderByVersionDesc(cleanLabel);
        }

        if (candidates.isEmpty()) return;

        GesturePrototype latest = candidates.get(0);
        if (latest.getParentId() != null) {
            Optional<GesturePrototype> parentOpt = gesturePrototypeRepository.findById(latest.getParentId());
            
            // Delete the faulty evolved version
            gesturePrototypeRepository.delete(latest);
            System.out.println(">>> Deleted evolved prototype " + cleanLabel + " V" + latest.getVersion() + " (Rollback triggered)");

            // Apply penalty to the parent template weight
            if (parentOpt.isPresent()) {
                GesturePrototype parent = parentOpt.get();
                parent.setWeight(Math.max(0.5, parent.getWeight() - 0.20)); // Penalty subtraction
                gesturePrototypeRepository.save(parent);
                System.out.println(">>> Restored parent prototype V" + parent.getVersion() + " with weight penalty: " + parent.getWeight());
            }
        } else {
            // Apply weight penalty directly if it is a root prototype
            latest.setWeight(Math.max(0.5, latest.getWeight() - 0.20));
            gesturePrototypeRepository.save(latest);
            System.out.println(">>> Applied penalty to root prototype " + cleanLabel + ", new weight: " + latest.getWeight());
        }
    }

    private double[][] convertToFlatDouble(Landmark[][] landmarks) {
        int n = landmarks.length;
        double[][] flat = new double[n][76 * 4];
        for (int i = 0; i < n; i++) {
            int idx = 0;
            for (Landmark l : landmarks[i]) {
                if (l != null) {
                    flat[i][idx++] = l.getX();
                    flat[i][idx++] = l.getY();
                    flat[i][idx++] = l.getZ();
                    flat[i][idx++] = l.getVisibility();
                } else {
                    idx += 4;
                }
            }
        }
        return flat;
    }

    private double[][] resampleDoubleFeatures(double[][] original, int targetLength, int dim) {
        int n = original.length;
        if (n == targetLength) return original;

        double[][] resampled = new double[targetLength][dim];
        for (int i = 0; i < targetLength; i++) {
            double relativePos = (double) i * (n - 1) / (targetLength - 1);
            int low = (int) Math.floor(relativePos);
            int high = (int) Math.ceil(relativePos);
            double weight = relativePos - low;

            for (int d = 0; d < dim; d++) {
                if (low == high) {
                    resampled[i][d] = original[low][d];
                } else {
                    resampled[i][d] = (1.0 - weight) * original[low][d] + weight * original[high][d];
                }
            }
        }
        return resampled;
    }

    /**
     * Resamples a sequence of features (Nx44) to exactly targetLength frames.
     */
    public double[][] resampleFeatures(double[][] original, int targetLength) {
        return resampleDoubleFeatures(original, targetLength, 44);
    }

    /**
     * Custom Sequence K-Means clustering to optimize the dataset and update gesture prototypes.
     */
    @Transactional
    public void optimizePrototypes(String label, int K) {
        List<GestureSample> samples = gestureSampleRepository.findByLabel(label);
        if (samples.isEmpty()) return;

        try {
            List<double[][]> sampleFeaturesList = new ArrayList<>();
            for (GestureSample s : samples) {
                double[][] f = mapper.readValue(s.getFeatureVectors(), double[][].class);
                sampleFeaturesList.add(resampleFeatures(f, STANDARDIZED_LENGTH));
            }

            int numSamples = sampleFeaturesList.size();
            int finalK = Math.min(K, numSamples);

            List<double[][]> centroids = new ArrayList<>();
            for (int k = 0; k < finalK; k++) {
                centroids.add(copyArray(sampleFeaturesList.get(k)));
            }

            int[] assignments = new int[numSamples];
            boolean changed = true;
            int maxIterations = 20;

            while (changed && maxIterations-- > 0) {
                changed = false;

                for (int i = 0; i < numSamples; i++) {
                    int bestCluster = 0;
                    double bestDist = Double.MAX_VALUE;

                    for (int k = 0; k < finalK; k++) {
                        double dist = euclideanDistance(sampleFeaturesList.get(i), centroids.get(k));
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestCluster = k;
                        }
                    }

                    if (assignments[i] != bestCluster) {
                        assignments[i] = bestCluster;
                        changed = true;
                    }
                }

                for (int k = 0; k < finalK; k++) {
                    double[][] sum = new double[STANDARDIZED_LENGTH][44];
                    int count = 0;

                    for (int i = 0; i < numSamples; i++) {
                        if (assignments[i] == k) {
                            count++;
                            double[][] f = sampleFeaturesList.get(i);
                            for (int t = 0; t < STANDARDIZED_LENGTH; t++) {
                                for (int d = 0; d < 44; d++) {
                                    sum[t][d] += f[t][d];
                                }
                            }
                        }
                    }

                    if (count > 0) {
                        double[][] centroid = centroids.get(k);
                        for (int t = 0; t < STANDARDIZED_LENGTH; t++) {
                            for (int d = 0; d < 44; d++) {
                                centroid[t][d] = sum[t][d] / count;
                            }
                        }
                    }
                }
            }

            // Remove old prototypes for this label
            gesturePrototypeRepository.deleteByLabel(label);

            // Save optimized centroids back to Database
            for (int k = 0; k < finalK; k++) {
                double[][] centroid = centroids.get(k);

                int closestSampleIdx = 0;
                double minDistance = Double.MAX_VALUE;
                for (int i = 0; i < numSamples; i++) {
                    if (assignments[i] == k) {
                        double dist = euclideanDistance(sampleFeaturesList.get(i), centroid);
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestSampleIdx = i;
                        }
                    }
                }

                GestureSample closestSample = samples.get(closestSampleIdx);
                double[] defaultWeights = new double[44];
                Arrays.fill(defaultWeights, 1.0);

                GesturePrototype proto = new GesturePrototype();
                proto.setId(UUID.randomUUID());
                proto.setLabel(label);
                proto.setUserId(null); // Global prototype
                proto.setFeatureVectors(mapper.writeValueAsString(centroid));
                proto.setLandmarksSequence(closestSample.getLandmarksSequence()); // Real skeleton for replay
                proto.setSampleCount(numSamples);
                proto.setWeight(1.0);
                proto.setUpdatedAt(System.currentTimeMillis());
                proto.setVersion(1);
                proto.setParentId(null);
                proto.setVariantName(k > 0 ? "Variant " + (k + 1) : null);
                proto.setFeatureWeights(mapper.writeValueAsString(defaultWeights));

                gesturePrototypeRepository.save(proto);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private double[][] copyArray(double[][] source) {
        double[][] dest = new double[source.length][];
        for (int i = 0; i < source.length; i++) {
            dest[i] = source[i].clone();
        }
        return dest;
    }

    private double euclideanDistance(double[][] a, double[][] b) {
        double sum = 0.0;
        for (int t = 0; t < STANDARDIZED_LENGTH; t++) {
            for (int d = 0; d < 44; d++) {
                double diff = a[t][d] - b[t][d];
                sum += diff * diff;
            }
        }
        return Math.sqrt(sum);
    }
}
