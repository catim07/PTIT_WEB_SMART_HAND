package com.signlink.backend.repository;

import com.signlink.backend.model.GesturePrototype;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GesturePrototypeRepository extends JpaRepository<GesturePrototype, UUID> {
    List<GesturePrototype> findByLabel(String label);
    List<GesturePrototype> findByLabelOrderByVersionDesc(String label);
    Optional<GesturePrototype> findByLabelAndUserId(String label, UUID userId);
    List<GesturePrototype> findByLabelAndUserIdOrderByVersionDesc(String label, UUID userId);
    List<GesturePrototype> findByUserId(UUID userId);
    void deleteByLabel(String label);
}
