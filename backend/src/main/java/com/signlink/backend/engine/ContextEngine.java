package com.signlink.backend.engine;

import com.signlink.backend.model.TransitionProbability;
import com.signlink.backend.model.UserProfile;
import com.signlink.backend.repository.TransitionProbabilityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class ContextEngine {

    @Autowired
    private TransitionProbabilityRepository transitionProbabilityRepository;

    @Autowired
    private KnowledgeEngine knowledgeEngine;

    /**
     * Boosts gesture prediction confidence based on the Context Intelligence equation:
     * P_final = P_geom * (1.0 + eta * (P_markov + P_grammar + P_habit))
     */
    public double adjustConfidence(
            String previousWord, 
            String currentWord, 
            double geometricConfidence, 
            double eta,
            UserProfile userProfile) {
        
        if (previousWord == null || previousWord.isEmpty()) {
            return geometricConfidence;
        }

        String prev = previousWord.toUpperCase().trim();
        String curr = currentWord.toUpperCase().trim();

        // 1. Markov Transition probability
        Optional<TransitionProbability> opt = transitionProbabilityRepository.findByPrevLabelAndCurrLabel(prev, curr);
        double markovProb = opt.map(TransitionProbability::getProbability).orElse(0.05);

        // 2. Grammar structure matching (Subject-Verb-Object)
        double grammarProb = evaluateGrammarRules(prev, curr);

        // 3. User habits (Context/Category continuity)
        double categoryProb = evaluateCategoryContinuity(prev, curr);

        // Combine contextual probabilities
        double contextBoost = 0.5 * markovProb + 0.3 * grammarProb + 0.2 * categoryProb;

        // Apply context adjustment
        double adjusted = geometricConfidence * (1.0 + eta * contextBoost);
        return Math.max(0.0, Math.min(1.0, adjusted));
    }

    /**
     * Predicts the most likely next gesture candidates based on SVO grammar, category context, and Markov chains.
     */
    public List<String> predictNextCandidates(List<String> history, UserProfile profile) {
        List<String> predictions = new ArrayList<>();
        if (history == null || history.isEmpty()) {
            // Default greeting context
            predictions.add("HELLO");
            predictions.add("TÔI");
            return predictions;
        }

        String lastWord = history.get(history.size() - 1).toUpperCase().trim();

        // 1. Fetch transition counts from DB
        List<TransitionProbability> transitions = transitionProbabilityRepository.findByPrevLabel(lastWord);
        transitions.sort((a, b) -> Double.compare(b.getProbability(), a.getProbability()));

        // Add top transition recommendations
        for (TransitionProbability tp : transitions) {
            predictions.add(tp.getCurrLabel());
            if (predictions.size() >= 3) break;
        }

        // 2. Fallback on Grammar-based Rule suggestions
        if (isSubject(lastWord)) {
            addIfNotExists(predictions, "MUỐN");
            addIfNotExists(predictions, "CẦN");
            addIfNotExists(predictions, "THÍCH");
        } else if (isVerb(lastWord)) {
            addIfNotExists(predictions, "UONG_NUOC");
            addIfNotExists(predictions, "AN_COM");
            addIfNotExists(predictions, "DI");
            addIfNotExists(predictions, "LIKE");
        } else if ("SOS".equals(lastWord)) {
            addIfNotExists(predictions, "HOSPITAL");
            addIfNotExists(predictions, "DOCTOR");
        }

        // 3. Limit predictions to 4 suggestions
        if (predictions.size() > 4) {
            predictions = predictions.subList(0, 4);
        }
        return predictions;
    }

    private void addIfNotExists(List<String> list, String word) {
        if (!list.contains(word)) {
            list.add(word);
        }
    }

    private double evaluateGrammarRules(String prev, String curr) {
        if (isSubject(prev) && isVerb(curr)) return 0.8;
        if (isVerb(prev) && !isSubject(curr)) return 0.7; // verb to object/noun
        return 0.1;
    }

    private double evaluateCategoryContinuity(String prev, String curr) {
        String prevCat = knowledgeEngine.getCategory(prev);
        String currCat = knowledgeEngine.getCategory(curr);
        if (prevCat != null && prevCat.equals(currCat)) {
            return 0.6; // Category continuity (e.g. SOS -> Doctor)
        }
        return 0.1;
    }

    private boolean isSubject(String word) {
        return Arrays.asList("TÔI", "BẠN", "ANH", "CHỊ").contains(word);
    }

    private boolean isVerb(String word) {
        return Arrays.asList("MUỐN", "THÍCH", "GHÉT", "CẦN").contains(word);
    }

    /**
     * Train Markov bigram transition counts on completed sentences.
     */
    public void trainTransitions(List<String> words) {
        if (words == null || words.size() < 2) return;

        for (int i = 0; i < words.size() - 1; i++) {
            String prev = words.get(i).toUpperCase().trim();
            String next = words.get(i + 1).toUpperCase().trim();

            Optional<TransitionProbability> opt = transitionProbabilityRepository.findByPrevLabelAndCurrLabel(prev, next);
            TransitionProbability tp;
            if (opt.isPresent()) {
                tp = opt.get();
                tp.setTransitionCount(tp.getTransitionCount() + 1);
            } else {
                tp = new TransitionProbability();
                tp.setPrevLabel(prev);
                tp.setCurrLabel(next);
                tp.setTransitionCount(1);
            }
            transitionProbabilityRepository.save(tp);
        }

        recalculateProbabilities(words);
    }

    private void recalculateProbabilities(List<String> words) {
        for (String w : words) {
            String prev = w.toUpperCase().trim();
            List<TransitionProbability> list = transitionProbabilityRepository.findByPrevLabel(prev);
            if (list.isEmpty()) continue;

            int total = 0;
            for (TransitionProbability tp : list) {
                total += tp.getTransitionCount();
            }

            if (total > 0) {
                for (TransitionProbability tp : list) {
                    tp.setProbability((double) tp.getTransitionCount() / total);
                    transitionProbabilityRepository.save(tp);
                }
            }
        }
    }
}
