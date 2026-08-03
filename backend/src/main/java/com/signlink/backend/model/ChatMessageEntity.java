package com.signlink.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import java.util.UUID;

@Document(collection = "chat_messages")
public class ChatMessageEntity {

    @Id
    private String id;

    @Field("sender_name")
    private String senderName;

    @Field("sender_role")
    private String senderRole;

    private String text;

    @Field("sign_keyword")
    private String signKeyword;

    @Field("room_id")
    private String roomId;

    private Long timestamp;

    public ChatMessageEntity() {
    }

    public ChatMessageEntity(String senderName, String senderRole, String text, String signKeyword, String roomId) {
        this.id = UUID.randomUUID().toString();
        this.senderName = senderName;
        this.senderRole = senderRole != null ? senderRole : "USER";
        this.text = text;
        this.signKeyword = signKeyword;
        this.roomId = (roomId != null && !roomId.trim().isEmpty()) ? roomId.trim() : "SẢNH_CHUNG";
        this.timestamp = System.currentTimeMillis();
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getSenderRole() {
        return senderRole;
    }

    public void setSenderRole(String senderRole) {
        this.senderRole = senderRole;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getSignKeyword() {
        return signKeyword;
    }

    public void setSignKeyword(String signKeyword) {
        this.signKeyword = signKeyword;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public Long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Long timestamp) {
        this.timestamp = timestamp;
    }
}
