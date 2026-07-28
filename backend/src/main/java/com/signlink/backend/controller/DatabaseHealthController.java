package com.signlink.backend.controller;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.signlink.backend.repository.GesturePrototypeRepository;
import com.signlink.backend.repository.RecognitionLogRepository;
import com.signlink.backend.repository.UserProfileRepository;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
@CrossOrigin(origins = "*")
public class DatabaseHealthController {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private GesturePrototypeRepository gesturePrototypeRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private RecognitionLogRepository recognitionLogRepository;

    @GetMapping("/db")
    public ResponseEntity<?> getDatabaseStatus() {
        Map<String, Object> status = new HashMap<>();
        try {
            Document pingResult = mongoTemplate.getDb().runCommand(new Document("ping", 1));
            status.put("connected", true);
            status.put("databaseType", "MongoDB Atlas (Cloud)");
            status.put("databaseName", mongoTemplate.getDb().getName());
            status.put("ping", pingResult.get("ok"));
            
            Map<String, Long> collections = new HashMap<>();
            collections.put("gesture_prototypes", gesturePrototypeRepository.count());
            collections.put("user_profiles", userProfileRepository.count());
            collections.put("recognition_logs", recognitionLogRepository.count());
            status.put("collections", collections);

            return ResponseEntity.ok(status);
        } catch (Exception e) {
            status.put("connected", false);
            status.put("error", e.getMessage());
            return ResponseEntity.status(500).body(status);
        }
    }
}
