package com.signlink.backend.repository;

import com.signlink.backend.model.ChatMessageEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ChatMessageRepository extends MongoRepository<ChatMessageEntity, String> {
    List<ChatMessageEntity> findTop50ByRoomIdOrderByTimestampDesc(String roomId);
}
