package com.signlink.backend.repository;

import com.signlink.backend.model.UserProfile;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;

@Repository
public interface UserProfileRepository extends MongoRepository<UserProfile, UUID> {
}
