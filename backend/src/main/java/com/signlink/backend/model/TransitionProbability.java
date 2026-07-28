package com.signlink.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "transition_probabilities")
@CompoundIndex(name = "prev_curr_idx", def = "{'prevLabel': 1, 'currLabel': 1}", unique = true)
public class TransitionProbability {

    @Id
    private String id;

    @Field("prev_label")
    private String prevLabel;

    @Field("curr_label")
    private String currLabel;

    @Field("transition_count")
    private Integer transitionCount = 1;

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
    public String getId() {
        return id;
    }

    public void setId(String id) {
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
