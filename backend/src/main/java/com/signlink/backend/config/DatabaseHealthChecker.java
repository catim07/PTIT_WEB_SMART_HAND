package com.signlink.backend.config;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

import com.signlink.backend.repository.GesturePrototypeRepository;
import com.signlink.backend.repository.RecognitionLogRepository;
import com.signlink.backend.repository.UserProfileRepository;

@Component
@Order(1)
public class DatabaseHealthChecker implements CommandLineRunner {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private GesturePrototypeRepository gesturePrototypeRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private RecognitionLogRepository recognitionLogRepository;

    @Override
    public void run(String... args) {
        try {
            Document pingCommand = new Document("ping", 1);
            Document pingResult = mongoTemplate.getDb().runCommand(pingCommand);
            String dbName = mongoTemplate.getDb().getName();
            
            long prototypes = gesturePrototypeRepository.count();
            long users = userProfileRepository.count();
            long logs = recognitionLogRepository.count();

            System.out.println();
            System.out.println("================================================================================");
            System.out.println("  🟢 [MONGODB ATLAS CONNECTED SUCCESSFULLY / KẾT NỐI DATABASE THÀNH CÔNG]");
            System.out.println("--------------------------------------------------------------------------------");
            System.out.println("  📍 Hệ Quản Trị DB      : MongoDB Atlas (Cloud)");
            System.out.println("  📁 Tên Database        : " + dbName);
            System.out.println("  ⚡ Trạng Thái Kết Nối  : OK (Ping ok = " + pingResult.get("ok") + ")");
            System.out.println("  📊 Dữ Liệu Hiện Tại:");
            System.out.println("     • gesture_prototypes : " + prototypes + " mẫu cử chỉ");
            System.out.println("     • user_profiles      : " + users + " hồ sơ người dùng");
            System.out.println("     • recognition_logs   : " + logs + " nhật ký nhận diện");
            System.out.println("================================================================================");
            System.out.println();
        } catch (Exception e) {
            System.err.println();
            System.err.println("================================================================================");
            System.err.println("  🔴 [MONGODB CONNECTION FAILED / KẾT NỐI DATABASE THẤT BẠI]");
            System.err.println("--------------------------------------------------------------------------------");
            System.err.println("  ❌ Lỗi kết nối: " + e.getMessage());
            System.err.println("================================================================================");
            System.err.println();
        }
    }
}
