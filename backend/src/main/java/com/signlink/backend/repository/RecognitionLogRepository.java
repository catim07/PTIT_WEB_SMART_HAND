package com.signlink.backend.repository;

import com.signlink.backend.model.RecognitionLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface RecognitionLogRepository extends JpaRepository<RecognitionLog, UUID> {
    List<RecognitionLog> findByUserId(UUID userId);
    
    @Query("SELECT r FROM RecognitionLog r ORDER BY r.timestamp DESC")
    List<RecognitionLog> findRecentLogs(Pageable pageable);
    
    @Query("SELECT COUNT(r) FROM RecognitionLog r WHERE r.correct = true")
    long countCorrectRecognitions();
}
