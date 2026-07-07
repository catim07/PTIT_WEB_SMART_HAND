package com.signlink.backend.dto;

import java.util.UUID;

public class GestureSampleRequest {
    private UUID userId;
    private String label;
    private Landmark[][] landmarksSequence;

    public GestureSampleRequest() {
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public Landmark[][] getLandmarksSequence() {
        return landmarksSequence;
    }

    public void setLandmarksSequence(Landmark[][] landmarksSequence) {
        this.landmarksSequence = landmarksSequence;
    }
}
