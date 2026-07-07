package com.signlink.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.signlink.backend.dto.GestureSampleRequest;
import com.signlink.backend.dto.Landmark;
import com.signlink.backend.model.GesturePrototype;
import com.signlink.backend.model.GestureSample;
import com.signlink.backend.model.UserProfile;
import com.signlink.backend.repository.GesturePrototypeRepository;
import com.signlink.backend.repository.GestureSampleRepository;
import com.signlink.backend.engine.FeatureEngine;
import com.signlink.backend.engine.DataQualityEngine;
import com.signlink.backend.engine.KnowledgeEngine;
import com.signlink.backend.engine.ContextEngine;
import com.signlink.backend.service.OnlineLearningService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/gestures")
@CrossOrigin(origins = "*")
public class GestureController {

    @Autowired
    private GestureSampleRepository gestureSampleRepository;

    @Autowired
    private GesturePrototypeRepository gesturePrototypeRepository;

    @Autowired
    private FeatureEngine featureEngine;

    @Autowired
    private DataQualityEngine dataQualityEngine;

    @Autowired
    private KnowledgeEngine knowledgeEngine;

    @Autowired
    private ContextEngine contextEngine;

    @Autowired
    private OnlineLearningService onlineLearningService;

    private final ObjectMapper mapper = new ObjectMapper();

    @GetMapping("/templates")
    public List<GesturePrototype> getPrototypes() {
        return gesturePrototypeRepository.findAll();
    }

    @GetMapping("/templates/{label}")
    public ResponseEntity<GesturePrototype> getPrototypeByLabel(@PathVariable String label) {
        List<GesturePrototype> list = gesturePrototypeRepository.findByLabelOrderByVersionDesc(label.toUpperCase().trim());
        if (list.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(list.get(0));
    }

    @GetMapping("/templates/evolutions/{label}")
    public List<GesturePrototype> getPrototypeEvolutions(@PathVariable String label) {
        return gesturePrototypeRepository.findByLabelOrderByVersionDesc(label.toUpperCase().trim());
    }

    @GetMapping("/knowledge/graph")
    public Map<String, Object> getKnowledgeGraph() {
        return knowledgeEngine.getKnowledgeGraph();
    }

    @GetMapping("/context/next")
    public List<String> getNextCandidates(
            @RequestParam(required = false) List<String> history,
            @RequestParam(required = false) UUID userId) {
        
        UUID activeUserId = userId != null ? userId : UUID.fromString("00000000-0000-0000-0000-000000000000");
        UserProfile profile = knowledgeEngine.getOrCreateUserProfile(activeUserId, "User");
        return contextEngine.predictNextCandidates(history, profile);
    }

    @PostMapping("/samples")
    public ResponseEntity<?> addSample(@RequestBody GestureSampleRequest req) {
        try {
            Landmark[][] sequence = req.getLandmarksSequence();
            if (sequence == null || sequence.length == 0) {
                return ResponseEntity.badRequest().body(Map.of("message", "Chuỗi toạ độ rỗng"));
            }

            // Parse frames into coordinate lists for Left/Right Hand, Pose, and Face
            List<Landmark[]> leftHandSeq = new ArrayList<>();
            List<Landmark[]> rightHandSeq = new ArrayList<>();
            List<Landmark[]> poseSeq = new ArrayList<>();
            List<Landmark[]> faceSeq = new ArrayList<>();

            for (Landmark[] frame : sequence) {
                Landmark[] left = new Landmark[21];
                Landmark[] right = new Landmark[21];
                Landmark[] pose = new Landmark[33];
                Landmark[] face = new Landmark[1];

                if (frame.length >= 21) System.arraycopy(frame, 0, left, 0, 21);
                if (frame.length >= 42) System.arraycopy(frame, 21, right, 0, 21);
                if (frame.length >= 75) System.arraycopy(frame, 42, pose, 0, Math.min(33, frame.length - 42));
                if (frame.length >= 76) {
                    face[0] = frame[75];
                } else {
                    face[0] = new Landmark(0.0, 0.0, 0.0, 0.0);
                }

                leftHandSeq.add(left);
                rightHandSeq.add(right);
                poseSeq.add(pose);
                faceSeq.add(face);
            }

            // 1. GFEE - Gesture Feature Extraction Engine
            FeatureEngine.GestureSignature signature = featureEngine.computeSignature(
                    leftHandSeq, rightHandSeq, poseSeq, faceSeq
            );

            // 2. DQVE - Data Quality & Validation Engine
            List<GesturePrototype> existing = gesturePrototypeRepository.findAll();
            DataQualityEngine.QualityReport report = dataQualityEngine.validateSample(
                    signature.featureVectors,
                    signature.completenessScore,
                    signature.peakAcceleration,
                    existing
            );

            if (!report.isValid) {
                return ResponseEntity.badRequest().body(Map.of("message", report.rejectionReason));
            }

            // 3. Save Valid Gesture Sample
            GestureSample sample = new GestureSample();
            sample.setId(UUID.randomUUID());
            sample.setUserId(req.getUserId() != null ? req.getUserId() : UUID.fromString("00000000-0000-0000-0000-000000000000"));
            sample.setLabel(req.getLabel().toUpperCase().trim());
            sample.setFeatureVectors(mapper.writeValueAsString(signature.featureVectors));
            sample.setLandmarksSequence(mapper.writeValueAsString(sequence));
            sample.setWeight(1.0);
            sample.setCreatedAt(System.currentTimeMillis());

            gestureSampleRepository.save(sample);

            // 4. Optimize Prototypes
            onlineLearningService.optimizePrototypes(sample.getLabel(), 3);

            return ResponseEntity.ok(Map.of("message", "Mẫu được lưu và cập nhật Prototype thành công!"));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{label}")
    public ResponseEntity<?> deleteGesture(@PathVariable String label) {
        gestureSampleRepository.deleteByLabel(label.toUpperCase());
        gesturePrototypeRepository.deleteByLabel(label.toUpperCase());
        return ResponseEntity.ok(Map.of("message", "Xoá cử chỉ thành công"));
    }

    @PostMapping("/optimize")
    public ResponseEntity<?> triggerOptimize() {
        List<GesturePrototype> prototypes = gesturePrototypeRepository.findAll();
        Set<String> labels = new HashSet<>();
        for (GesturePrototype p : prototypes) {
            labels.add(p.getLabel());
        }
        for (String label : labels) {
            onlineLearningService.optimizePrototypes(label, 3);
        }
        return ResponseEntity.ok(Map.of("message", "Tối ưu hóa chạy thành công cho tất cả cử chỉ"));
    }
}
