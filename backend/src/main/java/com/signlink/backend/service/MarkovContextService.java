package com.signlink.backend.service;

import com.signlink.backend.model.TransitionProbability;
import com.signlink.backend.repository.TransitionProbabilityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Service
public class MarkovContextService {

    @Autowired
    private TransitionProbabilityRepository transitionProbabilityRepository;

    private static final double LAMBDA = 0.35; // Context weight weight

    /**
     * Adjusted confidence score based on the transition probability from the previous word.
     * Formula: C_final = C_geo * (1 - lambda) + lambda * P(curr | prev)
     */
    public double adjustConfidence(String prevWord, String currWord, double geometricConfidence) {
        if (prevWord == null || prevWord.isEmpty()) {
            return geometricConfidence; // No context history
        }

        // Fetch transition probability from DB
        Optional<TransitionProbability> opt = transitionProbabilityRepository
                .findByPrevLabelAndCurrLabel(prevWord, currWord);

        double prob = 0.0;
        if (opt.isPresent()) {
            prob = opt.get().getProbability();
        } else {
            // Default low probability for unknown transition
            prob = 0.01;
        }

        // Apply context formula
        return geometricConfidence * (1.0 - LAMBDA) + LAMBDA * prob;
    }

    /**
     * Learns transition counts from a confirmed sentence and updates probabilities.
     */
    @Transactional
    public void learnSentenceTransitions(List<String> words) {
        if (words == null || words.size() < 2) return;

        for (int i = 0; i < words.size() - 1; i++) {
            String prev = words.get(i);
            String curr = words.get(i + 1);

            // Increment transition count
            TransitionProbability trans = transitionProbabilityRepository
                    .findByPrevLabelAndCurrLabel(prev, curr)
                    .orElse(new TransitionProbability(prev, curr, 0, 0.0));

            trans.setTransitionCount(trans.getTransitionCount() + 1);
            transitionProbabilityRepository.save(trans);
        }

        // Recompute probabilities for all prev words involved
        for (int i = 0; i < words.size() - 1; i++) {
            recalculateProbabilitiesFor(words.get(i));
        }
    }

    /**
     * Normalizes transition counts into probability values [0.0, 1.0] for a given preceding state.
     */
    private void recalculateProbabilitiesFor(String prevLabel) {
        List<TransitionProbability> list = transitionProbabilityRepository.findByPrevLabel(prevLabel);
        if (list.isEmpty()) return;

        int totalCount = 0;
        for (TransitionProbability t : list) {
            totalCount += t.getTransitionCount();
        }

        if (totalCount == 0) return;

        for (TransitionProbability t : list) {
            t.setProbability((double) t.getTransitionCount() / totalCount);
            transitionProbabilityRepository.save(t);
        }
    }
}
