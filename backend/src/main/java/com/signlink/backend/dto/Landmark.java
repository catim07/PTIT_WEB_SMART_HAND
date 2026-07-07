package com.signlink.backend.dto;

public class Landmark {
    private Double x;
    private Double y;
    private Double z;
    private Double visibility;

    public Landmark() {
    }

    public Landmark(Double x, Double y, Double z, Double visibility) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.visibility = visibility;
    }

    public Double getX() {
        return x;
    }

    public void setX(Double x) {
        this.x = x;
    }

    public Double getY() {
        return y;
    }

    public void setY(Double y) {
        this.y = y;
    }

    public Double getZ() {
        return z;
    }

    public void setZ(Double z) {
        this.z = z;
    }

    public Double getVisibility() {
        return visibility;
    }

    public void setVisibility(Double visibility) {
        this.visibility = visibility;
    }
}
