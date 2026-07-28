package com.signlink.backend.repository;

import com.signlink.backend.model.RecognitionLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface RecognitionLogRepository extends MongoRepository<RecognitionLog, UUID> {
    List<RecognitionLog> findByUserId(UUID userId);
    
    List<RecognitionLog> findAllByOrderByTimestampDesc(Pageable pageable);

    default List<RecognitionLog> findRecentLogs(Pageable pageable) {
        return findAllByOrderByTimestampDesc(pageable);
    }
    
    long countByCorrectTrue();

    default long countCorrectRecognitions() {
        return countByCorrectTrue();
    }

    List<RecognitionLog> findByActualLabel(String actualLabel);
}
