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
    private com.signlink.backend.repository.UserAccountRepository userAccountRepository;

    @Autowired
    private AuthService authService;

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

        // Seed Default Admin Account
        if (!userAccountRepository.existsByEmail("admin@signlink.vn")) {
            com.signlink.backend.model.UserAccount admin = new com.signlink.backend.model.UserAccount(
                "admin@signlink.vn",
                authService.hashPassword("admin123"),
                "Quản Trị Viên (Admin)",
                "ADMIN"
            );
            userAccountRepository.save(admin);
            System.out.println(">>> Seeded default Admin account: admin@signlink.vn");
        }

        // Seed Default User Account
        if (!userAccountRepository.existsByEmail("user@signlink.vn")) {
            com.signlink.backend.model.UserAccount user = new com.signlink.backend.model.UserAccount(
                "user@signlink.vn",
                authService.hashPassword("user123"),
                "Thành Phạm (Sinh Viên)",
                "USER"
            );
            userAccountRepository.save(user);
            System.out.println(">>> Seeded default User account: user@signlink.vn");
        }

        // 2. Seed Rich Dataset of Common Gestures if missing
        seedMissingPrototypes();
    }

    private void seedMissingPrototypes() throws Exception {
        String[] labels = {
            "HELLO", "XIN_CHAO", "CAM_ON", "OK", "LIKE", "DISLIKE",
            "BAN_TIM", "SOS", "TOI", "MUON", "UONG_NUOC", "AN_COM",
            "DI_HOC", "TAM_BIET", "SO_0", "SO_1", "SO_2", "SO_3", "SO_4", "SO_5"
        };

        int count = 0;
        for (String label : labels) {
            if (gesturePrototypeRepository.findByLabel(label).isEmpty()) {
                Landmark[][] sequence = generateSyntheticSequence(label);
                seedPrototype(label, sequence);
                count++;
            }
        }
        if (count > 0) {
            System.out.println(">>> Seeded " + count + " new gesture prototypes into MongoDB Atlas!");
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
        proto.setVariantName("Mẫu Chuẩn Hệ Thống");
        proto.setFeatureWeights(mapper.writeValueAsString(defaultWeights));

        gesturePrototypeRepository.save(proto);
    }

    private Landmark[][] generateSyntheticSequence(String label) {
        Landmark[][] sequence = new Landmark[30][76];
        boolean[] openFingers;

        switch (label) {
            case "SO_0":
                openFingers = new boolean[]{false, false, false, false, false}; // Fist
                break;
            case "SO_1":
                openFingers = new boolean[]{false, true, false, false, false}; // Index only
                break;
            case "SO_2":
                openFingers = new boolean[]{false, true, true, false, false}; // Victory / Peace
                break;
            case "SO_3":
                openFingers = new boolean[]{false, true, true, true, false}; // Index, Middle, Ring
                break;
            case "SO_4":
                openFingers = new boolean[]{false, true, true, true, true}; // 4 fingers
                break;
            case "SO_5":
            case "HELLO":
            case "XIN_CHAO":
            case "TAM_BIET":
                openFingers = new boolean[]{true, true, true, true, true}; // All 5 open
                break;
            case "LIKE":
                openFingers = new boolean[]{true, false, false, false, false}; // Thumb up
                break;
            case "OK":
                openFingers = new boolean[]{false, false, true, true, true}; // Thumb+Index circle, 3 up
                break;
            case "BAN_TIM":
                openFingers = new boolean[]{true, true, false, false, false}; // Finger heart pinch
                break;
            case "AN_COM":
            case "UONG_NUOC":
                openFingers = new boolean[]{false, false, false, false, false}; // Cup / Chopstick pinch
                break;
            default:
                openFingers = new boolean[]{true, true, true, true, true};
                break;
        }

        for (int t = 0; t < 30; t++) {
            double wristX = 0.2 + 0.05 * Math.sin(t * 2 * Math.PI / 15.0);
            double wristY = "UONG_NUOC".equals(label) || "AN_COM".equals(label) 
                    ? 0.4 - 0.5 * (t / 29.0) : 0.2;

            sequence[t] = buildSyntheticFrame(wristX, wristY, openFingers);
        }

        return sequence;
    }

    private Landmark[] buildSyntheticFrame(double wristX, double wristY, boolean[] openFingers) {
        Landmark[] frame = new Landmark[76];
        
        // 1. Left Hand (flat zeros)
        for (int i = 0; i < 21; i++) {
            frame[i] = new Landmark(0.0, 0.0, 0.0, 0.0);
        }

        // 2. Right Hand
        frame[21] = new Landmark(wristX, wristY, 0.0, 1.0); // wrist
        
        // Set standard finger node offsets relative to wrist
        int idx = 22;
        for (int f = 0; f < 5; f++) {
            boolean isOpen = openFingers != null && f < openFingers.length ? openFingers[f] : true;
            double fingerExtend = isOpen ? 0.15 : 0.03;
            double angle = (f - 2) * (Math.PI / 8.0) - Math.PI / 2.0;
            double fx = Math.cos(angle);
            double fy = Math.sin(angle);
            
            frame[idx++] = new Landmark(wristX + fx * 0.04, wristY + fy * 0.04, 0.0, 1.0);
            frame[idx++] = new Landmark(wristX + fx * 0.07, wristY + fy * 0.07, 0.0, 1.0);
            frame[idx++] = new Landmark(wristX + fx * 0.10, wristY + fy * 0.10, 0.0, 1.0);
            frame[idx++] = new Landmark(wristX + fx * (0.10 + fingerExtend), wristY + fy * (0.10 + fingerExtend), 0.0, 1.0); // Tip
        }

        // 3. Pose
        frame[42] = new Landmark(0.0, -0.2, 0.0, 1.0); // Nose (index 42 in frame, 0 in pose)
        frame[53] = new Landmark(-0.35, 0.0, 0.0, 1.0); // Left Shoulder
        frame[54] = new Landmark(0.35, 0.0, 0.0, 1.0);  // Right Shoulder
        
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
