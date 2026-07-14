package com.signlink.backend.controller;

import com.signlink.backend.dto.RecognitionLogRequest;
import com.signlink.backend.dto.SystemStatsResponse;
import com.signlink.backend.model.RecognitionLog;
import com.signlink.backend.repository.RecognitionLogRepository;
import com.signlink.backend.service.OnlineLearningService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/logs")
@CrossOrigin(origins = "*")
public class RecognitionLogController {

    @Autowired
    private RecognitionLogRepository recognitionLogRepository;

    @Autowired
    private OnlineLearningService onlineLearningService;

    @Autowired
    private com.signlink.backend.engine.TrendEngine trendEngine;

    @PostMapping
    public ResponseEntity<?> createLog(@RequestBody RecognitionLogRequest req) {
        UUID logId = UUID.randomUUID();
        RecognitionLog log = new RecognitionLog(
                logId,
                req.getUserId() != null ? req.getUserId() : UUID.fromString("00000000-0000-0000-0000-000000000000"),
                req.getPredictedLabel().toUpperCase().trim(),
                req.getActualLabel().toUpperCase().trim(),
                req.getConfidence(),
                req.getCorrect()
        );

        recognitionLogRepository.save(log);

        // If the user confirms it's correct, trigger online template adaptation!
        if (req.getCorrect() != null && req.getCorrect()) {
            if (req.getFeatureVectors() != null && req.getFeatureVectors().length > 0) {
                onlineLearningService.adaptPrototypeOnline(
                        log.getActualLabel(),
                        log.getUserId(),
                        req.getFeatureVectors(),
                        req.getLandmarksSequence()
                );
                // Dynamically learn and adapt user speed multiplier based on this correct gesture's length
                onlineLearningService.adaptUserSpeed(log.getUserId(), req.getFeatureVectors().length);
            }
        } else if (req.getCorrect() != null && !req.getCorrect()) {
            // Trigger rollback of the faulty predicted template and apply a weight penalty
            onlineLearningService.rollbackLastEvolution(log.getPredictedLabel(), log.getUserId());
        }

        return ResponseEntity.ok(log);
    }

    @GetMapping("/stats")
    public ResponseEntity<SystemStatsResponse> getStats() {
        long total = recognitionLogRepository.count();
        long correct = recognitionLogRepository.countCorrectRecognitions();
        double accuracy = total > 0 ? (double) correct / total : 0.0;

        // Count frequency of correct predictions per gesture
        List<RecognitionLog> allLogs = recognitionLogRepository.findAll();
        Map<String, Integer> counts = new HashMap<>();
        for (RecognitionLog l : allLogs) {
            if (l.getCorrect()) {
                counts.put(l.getActualLabel(), counts.getOrDefault(l.getActualLabel(), 0) + 1);
            }
        }

        // Get 10 most recent logs
        List<RecognitionLog> recent = recognitionLogRepository.findRecentLogs(PageRequest.of(0, 10));

        SystemStatsResponse stats = new SystemStatsResponse(total, correct, accuracy, counts, recent);
        return ResponseEntity.ok(stats);
     }

    @GetMapping("/trends")
    public ResponseEntity<com.signlink.backend.engine.TrendEngine.PerformanceMetrics> getTrends() {
        List<RecognitionLog> logs = recognitionLogRepository.findAll();
        com.signlink.backend.engine.TrendEngine.PerformanceMetrics metrics = trendEngine.calculateTrends(logs);
        return ResponseEntity.ok(metrics);
    }

    @DeleteMapping
    public ResponseEntity<?> clearLogs() {
        recognitionLogRepository.deleteAll();
        return ResponseEntity.ok(Map.of("message", "History cleared successfully"));
    }
}
