package com.signlink.backend.repository;

import com.signlink.backend.model.TransitionProbability;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransitionProbabilityRepository extends MongoRepository<TransitionProbability, String> {
    Optional<TransitionProbability> findByPrevLabelAndCurrLabel(String prevLabel, String currLabel);
    List<TransitionProbability> findByPrevLabel(String prevLabel);
}
