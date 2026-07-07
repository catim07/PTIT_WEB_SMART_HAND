package com.signlink.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.signlink.backend.dto.Landmark;
import com.signlink.backend.model.GesturePrototype;
import com.signlink.backend.model.UserProfile;
import com.signlink.backend.repository.GesturePrototypeRepository;
import com.signlink.backend.repository.UserProfileRepository;
import com.signlink.backend.engine.FeatureEngine;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private GesturePrototypeRepository gesturePrototypeRepository;

    @Autowired
    private FeatureEngine featureEngine;

    private final ObjectMapper mapper = new ObjectMapper();
    public static final UUID DEFAULT_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000000");

    @Override
    public void run(String... args) throws Exception {
        // 1. Seed Default User Profile
        if (userProfileRepository.findById(DEFAULT_USER_ID).isEmpty()) {
            UserProfile defaultUser = new UserProfile(DEFAULT_USER_ID, "Hệ Thống");
            defaultUser.setHandSize(1.0);
            defaultUser.setGestureSpeedMultiplier(1.0);
            defaultUser.setHabits("{\"preferredHand\":\"RIGHT\",\"alertSound\":true}");
            userProfileRepository.save(defaultUser);
            System.out.println(">>> Seeded default user profile.");
        }

        // 2. Seed Initial Gesture Prototypes if database is empty
        if (gesturePrototypeRepository.count() == 0) {
            seedPrototype("HELLO", createHelloCoordinates());
            seedPrototype("UONG_NUOC", createUongNuocCoordinates());
            seedPrototype("SOS", createSosCoordinates());
            System.out.println(">>> Seeded default gesture prototypes.");
        }
    }

    private void seedPrototype(String label, Landmark[][] sequence) throws Exception {
        List<Landmark[]> leftHandSeq = new ArrayList<>();
        List<Landmark[]> rightHandSeq = new ArrayList<>();
        List<Landmark[]> poseSeq = new ArrayList<>();
        List<Landmark[]> faceSeq = new ArrayList<>();

        for (Landmark[] frame : sequence) {
            Landmark[] left = new Landmark[21];
            Landmark[] right = new Landmark[21];
            Landmark[] pose = new Landmark[33];
            Landmark[] face = new Landmark[1];

            System.arraycopy(frame, 0, left, 0, 21);
            System.arraycopy(frame, 21, right, 0, 21);
            System.arraycopy(frame, 42, pose, 0, 33);
            face[0] = frame[75]; // Nose

            leftHandSeq.add(left);
            rightHandSeq.add(right);
            poseSeq.add(pose);
            faceSeq.add(face);
        }

        // Extract feature vectors using custom FeatureEngine
        FeatureEngine.GestureSignature signature = featureEngine.computeSignature(
                leftHandSeq, rightHandSeq, poseSeq, faceSeq
        );

        double[] defaultWeights = new double[44];
        for (int i = 0; i < 44; i++) {
            defaultWeights[i] = 1.0;
        }

        GesturePrototype proto = new GesturePrototype();
        proto.setId(UUID.randomUUID());
        proto.setLabel(label);
        proto.setUserId(null); // Global prototype
        proto.setFeatureVectors(mapper.writeValueAsString(signature.featureVectors));
        proto.setLandmarksSequence(mapper.writeValueAsString(sequence));
        proto.setSampleCount(1);
        proto.setWeight(1.0);
        proto.setUpdatedAt(System.currentTimeMillis());
        proto.setVersion(1);
        proto.setParentId(null);
        proto.setVariantName(null);
        proto.setFeatureWeights(mapper.writeValueAsString(defaultWeights));

        gesturePrototypeRepository.save(proto);
    }

    // --- Helper math to synthesize mock hand skeletal sequences ---

    private Landmark[][] createHelloCoordinates() {
        Landmark[][] sequence = new Landmark[30][76];
        for (int t = 0; t < 30; t++) {
            // Right hand waving horizontally
            double wristX = 0.2 + 0.1 * Math.sin(t * 2 * Math.PI / 15.0);
            double wristY = 0.2; // Chest level
            
            sequence[t] = buildSyntheticFrame(wristX, wristY, true); // Fingers fully open
        }
        return sequence;
    }

    private Landmark[][] createUongNuocCoordinates() {
        Landmark[][] sequence = new Landmark[30][76];
        for (int t = 0; t < 30; t++) {
            // Hand moving vertically upwards from chest to mouth
            double progress = (double) t / 29.0;
            double wristX = 0.1;
            double wristY = 0.4 - 0.5 * progress; // Moves up from y=0.4 to y=-0.1 (mouth level)
            
            sequence[t] = buildSyntheticFrame(wristX, wristY, false); // Fingers closed (like holding a cup)
        }
        return sequence;
    }

    private Landmark[][] createSosCoordinates() {
        Landmark[][] sequence = new Landmark[30][76];
        for (int t = 0; t < 30; t++) {
            // Waving hands high above the shoulders
            double progress = (double) t / 29.0;
            double wristX = 0.3 * Math.sin(t * 2 * Math.PI / 10.0);
            double wristY = -0.5; // High above shoulders
            
            sequence[t] = buildSyntheticFrame(wristX, wristY, true); // Fingers fully open
        }
        return sequence;
    }

    private Landmark[] buildSyntheticFrame(double wristX, double wristY, boolean fingersOpen) {
        Landmark[] frame = new Landmark[76];
        
        // 1. Left Hand (flat zeros)
        for (int i = 0; i < 21; i++) {
            frame[i] = new Landmark(0.0, 0.0, 0.0, 0.0);
        }

        // 2. Right Hand
        frame[21] = new Landmark(wristX, wristY, 0.0, 1.0); // wrist
        double fingerExtend = fingersOpen ? 0.15 : 0.04;
        
        // Set standard finger node offsets relative to wrist
        int idx = 22;
        for (int f = 0; f < 5; f++) {
            double angle = f * Math.PI / 6.0;
            double fx = Math.cos(angle);
            double fy = Math.sin(angle);
            
            frame[idx++] = new Landmark(wristX + fx * 0.04, wristY + fy * 0.04, 0.0, 1.0);
            frame[idx++] = new Landmark(wristX + fx * 0.07, wristY + fy * 0.07, 0.0, 1.0);
            frame[idx++] = new Landmark(wristX + fx * 0.10, wristY + fy * 0.10, 0.0, 1.0);
            frame[idx++] = new Landmark(wristX + fx * (0.10 + fingerExtend), wristY + fy * (0.10 + fingerExtend), 0.0, 1.0); // Tip
        }

        // 3. Pose
        // Nose at (0.0, -0.2)
        frame[42] = new Landmark(0.0, -0.2, 0.0, 1.0); // Nose (index 42 in frame, 0 in pose)
        
        // Left Shoulder (index 53 in frame, 11 in pose)
        frame[53] = new Landmark(-0.35, 0.0, 0.0, 1.0);
        // Right Shoulder (index 54 in frame, 12 in pose)
        frame[54] = new Landmark(0.35, 0.0, 0.0, 1.0);
        
        // Fill other pose nodes
        for (int i = 43; i < 75; i++) {
            if (i != 53 && i != 54) {
                frame[i] = new Landmark(0.0, 0.0, 0.0, 0.0);
            }
        }

        // 4. Nose in Face (index 75)
        frame[75] = new Landmark(0.0, -0.2, 0.0, 1.0);

        return frame;
    }
}
