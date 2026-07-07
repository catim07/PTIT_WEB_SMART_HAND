package com.signlink.backend.repository;

import com.signlink.backend.model.TransitionProbability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransitionProbabilityRepository extends JpaRepository<TransitionProbability, Long> {
    Optional<TransitionProbability> findByPrevLabelAndCurrLabel(String prevLabel, String currLabel);
    List<TransitionProbability> findByPrevLabel(String prevLabel);
    
    @Query("SELECT SUM(t.transitionCount) FROM TransitionProbability t WHERE t.prevLabel = ?1")
    Integer sumTransitionCountByPrevLabel(String prevLabel);
}
