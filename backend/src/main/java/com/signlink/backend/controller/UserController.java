package com.signlink.backend.controller;

import com.signlink.backend.model.UserProfile;
import com.signlink.backend.repository.UserProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserProfileRepository userProfileRepository;

    @GetMapping
    public List<UserProfile> getAllUsers() {
        return userProfileRepository.findAll();
    }

    @PostMapping
    public UserProfile createUser(@RequestBody UserProfile profile) {
        if (profile.getId() == null) {
            profile.setId(UUID.randomUUID());
        }
        if (profile.getCreatedAt() == null) {
            profile.setCreatedAt(System.currentTimeMillis());
        }
        return userProfileRepository.save(profile);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserProfile> getUserById(@PathVariable UUID id) {
        return userProfileRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserProfile> updateUser(@PathVariable UUID id, @RequestBody UserProfile updated) {
        return userProfileRepository.findById(id)
                .map(p -> {
                    p.setName(updated.getName());
                    p.setHandSize(updated.getHandSize());
                    p.setGestureSpeedMultiplier(updated.getGestureSpeedMultiplier());
                    p.setHabits(updated.getHabits());
                    return ResponseEntity.ok(userProfileRepository.save(p));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
