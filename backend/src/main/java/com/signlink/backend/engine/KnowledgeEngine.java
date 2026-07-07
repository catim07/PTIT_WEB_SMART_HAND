package com.signlink.backend.engine;

import com.signlink.backend.model.GesturePrototype;
import com.signlink.backend.model.UserProfile;
import com.signlink.backend.repository.GesturePrototypeRepository;
import com.signlink.backend.repository.UserProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class KnowledgeEngine {

    @Autowired
    private GesturePrototypeRepository gesturePrototypeRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    /**
     * Predefined Knowledge Graph category mapping for Sign Language communication.
     */
    public Map<String, String> getCategoryMapping() {
        Map<String, String> mapping = new HashMap<>();
        mapping.put("HELLO", "Greeting");
        mapping.put("THANK_YOU", "Greeting");
        mapping.put("SORRY", "Greeting");
        mapping.put("SOS", "Emergency");
        mapping.put("HOSPITAL", "Medical");
        mapping.put("DOCTOR", "Medical");
        mapping.put("UONG_NUOC", "Needs");
        mapping.put("AN_COM", "Needs");
        mapping.put("LIKE", "Feedback");
        mapping.put("OK", "Feedback");
        return mapping;
    }

    public String getCategory(String label) {
        if (label == null) return "Unknown";
        return getCategoryMapping().getOrDefault(label.toUpperCase().trim(), "General");
    }

    /**
     * Resolves nodes and links to construct a 2D visualization of the Knowledge Graph.
     */
    public Map<String, Object> getKnowledgeGraph() {
        Map<String, Object> graph = new HashMap<>();
        List<Map<String, String>> nodes = new ArrayList<>();
        List<Map<String, String>> links = new ArrayList<>();

        // 1. Add Category Nodes
        Set<String> categories = new HashSet<>(getCategoryMapping().values());
        for (String cat : categories) {
            Map<String, String> node = new HashMap<>();
            node.put("id", cat);
            node.put("label", cat);
            node.put("type", "category");
            nodes.add(node);
        }

        // 2. Add Gesture Nodes & Semantic "belongs_to" links
        Map<String, String> labelToCategory = getCategoryMapping();
        for (Map.Entry<String, String> entry : labelToCategory.entrySet()) {
            Map<String, String> node = new HashMap<>();
            node.put("id", entry.getKey());
            node.put("label", entry.getKey());
            node.put("type", "gesture");
            nodes.add(node);

            Map<String, String> link = new HashMap<>();
            link.put("source", entry.getKey());
            link.put("target", entry.getValue());
            link.put("type", "belongs_to");
            links.add(link);
        }

        // 3. Add Custom Grammar & Intent associations
        addLink(links, "TÔI", "MUỐN", "subject_verb");
        addLink(links, "MUỐN", "UONG_NUOC", "verb_object");
        addLink(links, "MUỐN", "AN_COM", "verb_object");
        addLink(links, "SOS", "HOSPITAL", "association");
        addLink(links, "HOSPITAL", "DOCTOR", "association");

        graph.put("nodes", nodes);
        graph.put("links", links);
        return graph;
    }

    private void addLink(List<Map<String, String>> links, String source, String target, String type) {
        Map<String, String> link = new HashMap<>();
        link.put("source", source);
        link.put("target", target);
        link.put("type", type);
        links.add(link);
    }

    /**
     * Resolves the active templates for a given user.
     */
    public List<GesturePrototype> getActiveTemplatesForUser(UUID userId) {
        List<GesturePrototype> globalTemplates = gesturePrototypeRepository.findByUserId(null);
        if (userId == null) {
            return globalTemplates;
        }

        List<GesturePrototype> userTemplates = gesturePrototypeRepository.findByUserId(userId);
        Map<String, GesturePrototype> resolved = new HashMap<>();

        // Seed with global templates
        for (GesturePrototype gp : globalTemplates) {
            resolved.put(gp.getLabel().toUpperCase(), gp);
        }

        // Override with personalized local templates
        for (GesturePrototype gp : userTemplates) {
            resolved.put(gp.getLabel().toUpperCase(), gp);
        }

        return new ArrayList<>(resolved.values());
    }

    /**
     * Retrieves or seeds a user profile.
     */
    public UserProfile getOrCreateUserProfile(UUID userId, String defaultName) {
        Optional<UserProfile> opt = userProfileRepository.findById(userId);
        if (opt.isPresent()) {
            return opt.get();
        }
        UserProfile profile = new UserProfile(userId, defaultName);
        return userProfileRepository.save(profile);
    }
}
