export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface GestureSample {
  id: string;
  label: string; // e.g. "UONG_NUOC", "HELLO", "SOS"
  landmarksSequence: Landmark[][]; // 21 hand landmarks per frame
  poseSequence?: Landmark[][]; // Selected pose landmarks (like shoulders/mouth) per frame
  featureVectors: number[][]; // Feature vectors over time
  createdAt: number;
}

export interface GestureTemplate {
  id: string;
  label: string;
  featureVectors: number[][]; // Clustered centroid or reference sequence
  landmarksSequence?: Landmark[][]; // Landmarks sequence for visual replay
  sampleCount: number;
  isPrototype: boolean;
  updatedAt: number;
}

export interface RecognitionStats {
  totalRecognitions: number;
  correctRecognitions: number;
  accuracy: number;
  gestureCounts: Record<string, number>;
  recentLogs: Array<{
    timestamp: number;
    predicted: string;
    actual: string;
    confidence: number;
    correct: boolean;
  }>;
}

export interface SystemSettings {
  kmeansK: number;
  knnK: number;
  minConfidence: number;
}
