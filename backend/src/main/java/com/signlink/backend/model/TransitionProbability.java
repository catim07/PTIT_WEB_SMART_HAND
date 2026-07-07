package com.signlink.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "transition_probabilities", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"prev_label", "curr_label"})
})
public class TransitionProbability {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "prev_label", nullable = false)
    private String prevLabel;

    @Column(name = "curr_label", nullable = false)
    private String currLabel;

    @Column(name = "transition_count", nullable = false)
    private Integer transitionCount = 1;

    @Column(nullable = false)
    private Double probability = 0.0;

    public TransitionProbability() {
    }

    public TransitionProbability(String prevLabel, String currLabel, Integer transitionCount, Double probability) {
        this.prevLabel = prevLabel;
        this.currLabel = currLabel;
        this.transitionCount = transitionCount;
        this.probability = probability;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPrevLabel() {
        return prevLabel;
    }

    public void setPrevLabel(String prevLabel) {
        this.prevLabel = prevLabel;
    }

    public String getCurrLabel() {
        return currLabel;
    }

    public void setCurrLabel(String currLabel) {
        this.currLabel = currLabel;
    }

    public Integer getTransitionCount() {
        return transitionCount;
    }

    public void setTransitionCount(Integer transitionCount) {
        this.transitionCount = transitionCount;
    }

    public Double getProbability() {
        return probability;
    }

    public void setProbability(Double probability) {
        this.probability = probability;
    }
}
