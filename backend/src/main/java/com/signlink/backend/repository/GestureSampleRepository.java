package com.signlink.backend.repository;

import com.signlink.backend.model.GestureSample;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface GestureSampleRepository extends MongoRepository<GestureSample, UUID> {
    List<GestureSample> findByLabel(String label);
    List<GestureSample> findByUserId(UUID userId);
    List<GestureSample> findByUserIdAndLabel(UUID userId, String label);
    void deleteByLabel(String label);
}
