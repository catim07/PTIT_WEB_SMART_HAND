package com.signlink.backend.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.signlink.backend.dto.Landmark;
import com.signlink.backend.model.GesturePrototype;
import com.signlink.backend.model.UserProfile;
import com.signlink.backend.repository.GesturePrototypeRepository;
import com.signlink.backend.repository.UserProfileRepository;
import com.signlink.backend.repository.RecognitionLogRepository;
import com.signlink.backend.engine.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class GestureWebSocketHandler extends TextWebSocketHandler {

    @Autowired
    private GesturePrototypeRepository gesturePrototypeRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private RecognitionLogRepository recognitionLogRepository;

    @Autowired
    private FeatureEngine featureEngine;

    @Autowired
    private SimilarityEngine similarityEngine;

    @Autowired
    private ContextEngine contextEngine;

    @Autowired
    private ExplainabilityEngine explainabilityEngine;

    @Autowired
    private LearningEngine learningEngine;

    @Autowired
    private KnowledgeEngine knowledgeEngine;

    @Autowired
    private ConfidenceCalibrationEngine confidenceCalibrationEngine;

    private final ObjectMapper mapper = new ObjectMapper();

    // Map to keep track of the sliding frame buffer per connection session
    private final Map<String, List<Landmark[]>> sessionBuffers = new ConcurrentHashMap<>();
    // Map to keep track of the previous predicted word for Markov Context
    private final Map<String, String> sessionContext = new ConcurrentHashMap<>();
    // Map to throttle CPU usage (evaluating every N frames)
    private final Map<String, Integer> sessionFrameCounters = new ConcurrentHashMap<>();
    // Map to keep track of the sliding window of last N predictions for smoothing (Hysteresis Filter)
    private final Map<String, List<String>> sessionPredictionHistory = new ConcurrentHashMap<>();

    private static final int WINDOW_SIZE = 15; // Max sliding window length
    private static final int RECOGNITION_INTERVAL = 2; // Evaluate every 2 frames (ultra fast)
    private static final int FILTER_WINDOW_SIZE = 3; // Hysteresis majority vote window length

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessionBuffers.put(session.getId(), new ArrayList<>());
        sessionContext.put(session.getId(), "");
        sessionFrameCounters.put(session.getId(), 0);
        sessionPredictionHistory.put(session.getId(), new ArrayList<>());
        sendTextMessage(session, Map.of("type", "INFO", "message", "Kết nối WebSocket thành công. Bắt đầu nhận dạng..."));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = mapper.readValue(message.getPayload(), new TypeReference<Map<String, Object>>() {});
        String type = (String) payload.get("type");

        if ("FRAME".equals(type)) {
            List<Map<String, Object>> landmarksRaw = (List<Map<String, Object>>) payload.get("landmarks");
            if (landmarksRaw != null) {
                Landmark[] frame = parseFrame(landmarksRaw);
                List<Landmark[]> buffer = sessionBuffers.get(session.getId());
                if (buffer != null) {
                    buffer.add(frame);
                    if (buffer.size() > WINDOW_SIZE) {
                        buffer.remove(0);
                    }

                    int count = sessionFrameCounters.getOrDefault(session.getId(), 0) + 1;
                    sessionFrameCounters.put(session.getId(), count);

                    if (buffer.size() >= 5 && count % RECOGNITION_INTERVAL == 0) {
                        processRecognition(session, buffer);
                    }
                }
            }
        } else if ("PREV_WORD".equals(type)) {
            String prevWord = (String) payload.get("word");
            String oldPrevWord = sessionContext.get(session.getId());
            sessionContext.put(session.getId(), prevWord != null ? prevWord.toUpperCase().trim() : "");
            
            // Train Markov transitions online automatically in the background if consecutive words exist
            if (oldPrevWord != null && !oldPrevWord.isEmpty() && prevWord != null && !prevWord.isEmpty()) {
                contextEngine.trainTransitions(Arrays.asList(oldPrevWord, prevWord.toUpperCase().trim()));
            }
        } else if ("CLEAR_CONTEXT".equals(type)) {
            sessionContext.put(session.getId(), "");
        } else if ("LEARN_SENTENCE".equals(type)) {
            List<String> words = (List<String>) payload.get("words");
            if (words != null) {
                contextEngine.trainTransitions(words);
                sendTextMessage(session, Map.of("type", "INFO", "message", "Đã cập nhật xích Markov!"));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessionBuffers.remove(session.getId());
        sessionContext.remove(session.getId());
        sessionFrameCounters.remove(session.getId());
        sessionPredictionHistory.remove(session.getId());
    }

    private void processRecognition(WebSocketSession session, List<Landmark[]> buffer) throws IOException {
        List<GesturePrototype> prototypes = gesturePrototypeRepository.findAll();
        if (prototypes.isEmpty()) {
            return;
        }

        // Strict Hand Presence Check: Ensure at least one frame in buffer contains a valid non-zero hand
        boolean hasValidHand = false;
        for (Landmark[] frame : buffer) {
            if (isHandNonZero(frame, 0) || isHandNonZero(frame, 21)) {
                hasValidHand = true;
                break;
            }
        }

        if (!hasValidHand) {
            Map<String, Object> response = new HashMap<>();
            response.put("type", "PREDICTION");
            response.put("predicted", "KHÔNG PHÁT HIỆN TAY");
            response.put("confidence", 0.0);
            response.put("feedback", "Vui lòng đưa bàn tay vào khung hình camera.");
            response.put("candidates", Collections.emptyList());
            sendTextMessage(session, response);
            return;
        }

        // 1. GFEE - Extract features
        List<Landmark[]> leftHandSeq = new ArrayList<>();
        List<Landmark[]> rightHandSeq = new ArrayList<>();
        List<Landmark[]> poseSeq = new ArrayList<>();
        List<Landmark[]> faceSeq = new ArrayList<>();

        for (Landmark[] frame : buffer) {
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

        FeatureEngine.GestureSignature signature = featureEngine.computeSignature(leftHandSeq, rightHandSeq, poseSeq, faceSeq);
        double[][] inputFeatures = signature.featureVectors;

        // Load user profile
        UUID activeUserId = UUID.fromString("00000000-0000-0000-0000-000000000000");
        UserProfile profile = knowledgeEngine.getOrCreateUserProfile(activeUserId, "User");
        double speedMultiplier = profile.getGestureSpeedMultiplier() != null ? profile.getGestureSpeedMultiplier() : 1.0;

        // Retrieve User Reliability
        double reliability = learningEngine.computeUserReliability(recognitionLogRepository.findAll());

        List<Map.Entry<GesturePrototype, Double>> candidateScores = new ArrayList<>();
        String prevWord = sessionContext.getOrDefault(session.getId(), "");

        for (GesturePrototype proto : prototypes) {
            try {
                double[][] protoFeatures = mapper.readValue(proto.getFeatureVectors(), double[][].class);
                
                // Load adaptive weights
                double[] featureWeights = null;
                if (proto.getFeatureWeights() != null) {
                    featureWeights = mapper.readValue(proto.getFeatureWeights(), double[].class);
                }

                // 2. ASE - Compute Adaptive DTW++ distance
                double dist = similarityEngine.computeAdaptiveDtw(inputFeatures, protoFeatures, featureWeights, speedMultiplier);

                // Compute geometric match confidence base
                double geomConf = Math.max(0.0, 1.0 - (dist / 1.1));

                // 3. CIE - Context adjust boost P(W_t | W_t-1)
                double contextBoost = 0.0;
                if (!prevWord.isEmpty()) {
                    contextBoost = contextEngine.adjustConfidence(prevWord, proto.getLabel(), 1.0, 0.40, profile) - 1.0;
                }

                // 4. CCE - Confidence Calibration
                double finalConf = confidenceCalibrationEngine.calibrate(dist, contextBoost, reliability, proto);

                candidateScores.add(new AbstractMap.SimpleEntry<>(proto, finalConf));

            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        candidateScores.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));

        if (candidateScores.isEmpty()) return;

        Map.Entry<GesturePrototype, Double> bestMatch = candidateScores.get(0);
        GesturePrototype bestProto = bestMatch.getKey();
        String label = bestProto.getLabel();
        double confidence = bestMatch.getValue();

        // 4b. CCE - Check against dynamic threshold
        double dynamicThreshold = confidenceCalibrationEngine.getDynamicThreshold(label);
        boolean isLowConfidence = confidence < dynamicThreshold;
        if (isLowConfidence) {
            label = "ĐANG PHÂN TÍCH...";
        }

        // 4c. Hysteresis Filtering (temporal majority voting)
        List<String> hist = sessionPredictionHistory.get(session.getId());
        if (hist != null) {
            hist.add(label);
            if (hist.size() > FILTER_WINDOW_SIZE) {
                hist.remove(0);
            }

            Map<String, Integer> votes = new HashMap<>();
            for (String l : hist) {
                votes.put(l, votes.getOrDefault(l, 0) + 1);
            }

            String smoothedLabel = label;
            int maxVotes = 0;
            for (Map.Entry<String, Integer> vote : votes.entrySet()) {
                if (vote.getValue() > maxVotes) {
                    maxVotes = vote.getValue();
                    smoothedLabel = vote.getKey();
                }
            }

            if (maxVotes >= 3 && !isLowConfidence) {
                label = smoothedLabel;
            }
        }

        List<String> topCandidates = new ArrayList<>();
        for (int i = 0; i < Math.min(3, candidateScores.size()); i++) {
            String variantTag = candidateScores.get(i).getKey().getVariantName() != null 
                    ? " (" + candidateScores.get(i).getKey().getVariantName() + ")" : "";
            topCandidates.add(candidateScores.get(i).getKey().getLabel() + variantTag + " (" + Math.round(candidateScores.get(i).getValue() * 100) + "%)");
        }

        // 5. XDE - Explainable Decision Engine
        String feedback = "";
        ExplainabilityEngine.GestureExplanation explanation = null;

        if (!"ĐANG PHÂN TÍCH...".equals(label)) {
            double[] lastInputFrame = inputFeatures[inputFeatures.length - 1];
            double[] lastProtoFrame = new double[44];
            try {
                double[][] protoFeatures = mapper.readValue(bestProto.getFeatureVectors(), double[][].class);
                lastProtoFrame = protoFeatures[protoFeatures.length - 1];
            } catch (Exception e) {
                e.printStackTrace();
            }

            explanation = explainabilityEngine.explainPrediction(lastInputFrame, lastProtoFrame, label, confidence);
            feedback = explanation.generalFeedback;
        } else {
            feedback = "Đang phân tích cử chỉ tay của bạn...";
        }

        // Apply quality warnings
        if (signature.isJittery) {
            feedback = "[Cảnh báo rung lắc] " + feedback;
        }
        if (signature.completenessScore < 0.70) {
            feedback = "[Mất nét tay] " + feedback;
        }

        // Send prediction package back to client
        Map<String, Object> response = new HashMap<>();
        response.put("type", "PREDICTION");
        response.put("predicted", label);
        response.put("confidence", confidence);
        response.put("feedback", feedback);
        response.put("candidates", topCandidates);
        response.put("features", inputFeatures);
        response.put("fingerMatch", explanation != null ? explanation.fingerMatchPercentage : 0.0);
        response.put("palmMatch", explanation != null ? explanation.palmMatchPercentage : 0.0);
        response.put("motionMatch", explanation != null ? explanation.motionMatchPercentage : 0.0);
        response.put("bodyMatch", explanation != null ? explanation.bodyMatchPercentage : 0.0);
        response.put("trajectoryMatch", explanation != null ? explanation.trajectoryMatchPercentage : 0.0);

        sendTextMessage(session, response);
    }

    private Landmark[] parseFrame(List<Map<String, Object>> raw) {
        Landmark[] frame = new Landmark[76]; // 21 + 21 + 33 + 1
        for (int i = 0; i < 76; i++) {
            if (i < raw.size()) {
                Map<String, Object> node = raw.get(i);
                double x = node.get("x") != null ? ((Number) node.get("x")).doubleValue() : 0.0;
                double y = node.get("y") != null ? ((Number) node.get("y")).doubleValue() : 0.0;
                double z = node.get("z") != null ? ((Number) node.get("z")).doubleValue() : 0.0;
                double v = node.get("visibility") != null ? ((Number) node.get("visibility")).doubleValue() : 0.0;
                frame[i] = new Landmark(x, y, z, v);
            } else {
                frame[i] = new Landmark(0.0, 0.0, 0.0, 0.0);
            }
        }
        return frame;
    }

    private boolean isHandNonZero(Landmark[] frame, int offset) {
        if (frame == null || frame.length < offset + 21) return false;
        double sum = 0.0;
        for (int i = offset; i < offset + 21; i++) {
            Landmark l = frame[i];
            if (l != null) {
                sum += Math.abs(l.getX()) + Math.abs(l.getY()) + Math.abs(l.getZ());
            }
        }
        return sum > 0.01;
    }

    private void sendTextMessage(WebSocketSession session, Object payload) throws IOException {
        if (session.isOpen()) {
            session.sendMessage(new TextMessage(mapper.writeValueAsString(payload)));
        }
    }
}
