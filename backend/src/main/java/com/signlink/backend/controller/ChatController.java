package com.signlink.backend.controller;

import com.signlink.backend.model.ChatMessageEntity;
import com.signlink.backend.repository.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*")
public class ChatController {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @GetMapping("/history")
    public List<ChatMessageEntity> getChatHistory(@RequestParam(defaultValue = "SẢNH_CHUNG") String roomId) {
        List<ChatMessageEntity> list = chatMessageRepository.findTop50ByRoomIdOrderByTimestampDesc(roomId);
        Collections.reverse(list); // Oldest first for chat display order
        return list;
    }

    @DeleteMapping("/history")
    public ResponseEntity<?> clearHistory(@RequestParam(defaultValue = "SẢNH_CHUNG") String roomId) {
        List<ChatMessageEntity> list = chatMessageRepository.findTop50ByRoomIdOrderByTimestampDesc(roomId);
        chatMessageRepository.deleteAll(list);
        return ResponseEntity.ok(Map.of("message", "Đã xóa lịch sử chat thành công!"));
    }
}
