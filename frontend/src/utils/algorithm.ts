import { type Landmark, type GestureTemplate } from '../types';

/**
 * Calculates Euclidean distance between two 3D landmarks
 */
export function getDistance3D(p1: Landmark, p2: Landmark): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(p1.z - p2.z, 2)
  );
}

/**
 * Calculates Euclidean distance between two feature vectors
 */
export function getVectorDistance(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += Math.pow(v1[i] - v2[i], 2);
  }
  return Math.sqrt(sum);
}

/**
 * Normalizes raw hand and pose landmarks to be translation, scale, and position invariant,
 * extracting hand shapes and relative coordinates to the face.
 */
export function extractFeatures(
  handLandmarks: Landmark[] | null,
  poseLandmarks: Landmark[] | null
): {
  normalizedCoords: Landmark[];
  featureVector: number[];
} {
  // If hand is not detected, we cannot extract meaningful gesture features
  if (!handLandmarks || handLandmarks.length !== 21) {
    return { normalizedCoords: [], featureVector: [] };
  }

  const wrist = handLandmarks[0];

  // 1. Hand Coordinate Translation Invariance (Relative to Wrist)
  const shifted: Landmark[] = handLandmarks.map(l => ({
    x: l.x - wrist.x,
    y: l.y - wrist.y,
    z: l.z - wrist.z
  }));

  // 2. Scale Invariance (Relative to distance L0 -> L9 middle base)
  const scale = getDistance3D(handLandmarks[0], handLandmarks[9]) || 0.1;
  const normalizedCoords: Landmark[] = shifted.map(l => ({
    x: l.x / scale,
    y: l.y / scale,
    z: l.z / scale
  }));

  // 3. Feature Vector Generation (81 dimensions)
  const featureVector: number[] = [];

  // A. Hand joint coordinates (21 joints * 3 = 63 features)
  for (const pt of normalizedCoords) {
    featureVector.push(pt.x, pt.y, pt.z);
  }

  // B. Fingertip to wrist distances (5 features)
  const tipIndices = [4, 8, 12, 16, 20];
  const tipDistances = tipIndices.map(idx => getDistance3D(normalizedCoords[0], normalizedCoords[idx]));
  featureVector.push(...tipDistances);

  // C. Pairwise fingertip distances (10 features)
  for (let i = 0; i < tipIndices.length; i++) {
    for (let j = i + 1; j < tipIndices.length; j++) {
      const d = getDistance3D(normalizedCoords[tipIndices[i]], normalizedCoords[tipIndices[j]]);
      featureVector.push(d);
    }
  }

  // D. Relative Hand Position to Face (3 features)
  // Essential to distinguish: "LIKE" (hand near chest) from "UONG_NUOC" (hand near mouth)
  // Landmark 0 of pose is the Nose (serves as a proxy for the mouth/face center)
  if (poseLandmarks && poseLandmarks[0]) {
    const nose = poseLandmarks[0];
    // Vector from nose to hand wrist, normalized by body scale (distance between shoulders L11 and L12)
    const bodyScale = (poseLandmarks[11] && poseLandmarks[12]) 
      ? getDistance3D(poseLandmarks[11], poseLandmarks[12]) || 0.3
      : 0.3;
      
    featureVector.push(
      (wrist.x - nose.x) / bodyScale,
      (wrist.y - nose.y) / bodyScale,
      (wrist.z - nose.z) / bodyScale
    );
  } else {
    // Fallback if pose not tracked
    featureVector.push(0, 0, 0);
  }

  return { normalizedCoords, featureVector };
}

/**
 * Computes Dynamic Time Warping (DTW) distance between two sequences of feature vectors.
 * Implements classical dynamic programming from scratch.
 */
export function getDTWDistance(seq1: number[][], seq2: number[][]): number {
  const n = seq1.length;
  const m = seq2.length;
  
  if (n === 0 || m === 0) return Infinity;

  // Initialize DP grid
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  dp[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = getVectorDistance(seq1[i - 1], seq2[j - 1]);
      dp[i][j] = cost + Math.min(
        dp[i - 1][j],     // insertion
        dp[i][j - 1],     // deletion
        dp[i - 1][j - 1]  // match
      );
    }
  }

  // Normalized DTW distance by warping path length proxy (n + m) to make varying lengths comparable
  return dp[n][m] / (n + m);
}

/**
 * Custom Sequence KNN Classifier using Dynamic Time Warping (DTW) metric.
 */
export interface SequenceClassificationResult {
  label: string;
  confidence: number;
  allDistances: Array<{ label: string; dist: number }>;
}

export function classifySequence(
  inputSequence: number[][],
  templates: GestureTemplate[],
  k: number,
  minConfidence: number
): SequenceClassificationResult {
  if (templates.length === 0) {
    return { label: 'CHƯA CÓ DỮ LIỆU', confidence: 0, allDistances: [] };
  }

  // 1. Calculate DTW distance from input sequence to all template sequences
  const distances = templates.map(t => {
    const dist = getDTWDistance(inputSequence, t.featureVectors);
    return { id: t.id, label: t.label, dist };
  });

  // Sort by DTW distance (closest first)
  distances.sort((a, b) => a.dist - b.dist);

  // 2. Select top K neighbors
  const actualK = Math.min(k, distances.length);
  const neighbors = distances.slice(0, actualK);

  // 3. Distance-weighted voting
  const epsilon = 0.01;
  const labelWeights: Record<string, number> = {};
  let totalWeight = 0;

  for (const n of neighbors) {
    const weight = 1 / (n.dist + epsilon);
    labelWeights[n.label] = (labelWeights[n.label] || 0) + weight;
    totalWeight += weight;
  }

  // Find label with highest accumulated weight
  let winningLabel = 'KHÔNG XÁC ĐỊNH';
  let maxWeight = 0;

  for (const [label, weight] of Object.entries(labelWeights)) {
    if (weight > maxWeight) {
      maxWeight = weight;
      winningLabel = label;
    }
  }

  const confidence = totalWeight > 0 ? maxWeight / totalWeight : 0;

  // Filter labels below confidence threshold
  if (confidence < minConfidence) {
    return {
      label: 'ĐANG PHÂN TÍCH...',
      confidence,
      allDistances: distances.slice(0, 5)
    };
  }

  return {
    label: winningLabel,
    confidence,
    allDistances: distances.slice(0, 5)
  };
}

/**
 * Online adaptation / self-calibration for a sequence template.
 * Linearly interpolates the template sequence toward the input sequence.
 * Handles different sequence lengths by first resampling the input.
 */
export function adaptSequenceTemplate(
  templateSequence: number[][],
  inputSequence: number[][],
  learningRate = 0.03
): number[][] {
  if (templateSequence.length === 0 || inputSequence.length === 0) return templateSequence;

  // Resample input sequence to match template length
  const targetLength = templateSequence.length;
  const resampledInput: number[][] = [];

  for (let i = 0; i < targetLength; i++) {
    const floatIdx = (i / (targetLength - 1)) * (inputSequence.length - 1);
    const lowIdx = Math.floor(floatIdx);
    const highIdx = Math.ceil(floatIdx);
    const weight = floatIdx - lowIdx;

    const vLow = inputSequence[lowIdx];
    const vHigh = inputSequence[highIdx];
    const dim = vLow.length;
    const interpolatedVec = new Array(dim);

    for (let d = 0; d < dim; d++) {
      interpolatedVec[d] = (1 - weight) * vLow[d] + weight * vHigh[d];
    }
    resampledInput.push(interpolatedVec);
  }

  // Apply adaptation
  return templateSequence.map((tempVec, frameIdx) => {
    const inputVec = resampledInput[frameIdx];
    return tempVec.map((val, d) => (1 - learningRate) * val + learningRate * inputVec[d]);
  });
}

/**
 * Checks for specific posture issues in comparison to template (Grammarly for gestures).
 * Returns helpful textual recommendations if errors are found.
 */
export function diagnoseGestureError(
  label: string,
  inputSequence: number[][],
  landmarksSequence: Landmark[][]
): string | null {
  if (inputSequence.length === 0 || landmarksSequence.length === 0) return null;

  if (label === 'UONG_NUOC') {
    // Check if the hand actually reaches the mouth/face level.
    // The relative Y of the hand relative to the nose is in the last 3 elements of the feature vector.
    // If relative Y is positive (in MediaPipe, positive Y is downwards), it means hand was below nose.
    // Let's check the minimum Y (highest position reached by hand).
    let minRelY = Infinity;
    for (const vec of inputSequence) {
      const relY = vec[vec.length - 2]; // Y relative coordinate is second to last
      if (relY < minRelY) minRelY = relY;
    }

    // If minRelY is too large, the hand didn't go high enough (should go near 0 or negative relative to nose)
    if (minRelY > 0.4) {
      return 'Mẹo cử chỉ "Uống Nước": Bạn cần đưa bàn tay lên cao hơn sát gần miệng để biểu đạt đúng.';
    }
  }

  if (label === 'HELLO') {
    // wave hello: requires palm to be extended, check if fingers are open
    // We can evaluate average tip-to-wrist distances in the feature vector.
    // Tip-to-wrist normalized distances are at index 63 to 67.
    let avgTipDistSum = 0;
    for (const vec of inputSequence) {
      const tips = vec.slice(63, 68);
      const avgTips = tips.reduce((s, v) => s + v, 0) / 5;
      avgTipDistSum += avgTips;
    }
    const finalAvgTipDist = avgTipDistSum / inputSequence.length;

    // Open hand has larger distances (typically > 1.2 normalized). Closed fist is < 0.8
    if (finalAvgTipDist < 1.0) {
      return 'Mẹo cử chỉ "Chào Bạn": Hãy mở rộng các ngón tay và xòe lòng bàn tay ra khi vẫy chào.';
    }
  }

  if (label === 'SOS') {
    // SOS gesture is crossed hands. Let's make sure the hand is held high near head/chest level.
    let avgRelY = 0;
    for (const vec of inputSequence) {
      avgRelY += vec[vec.length - 2];
    }
    avgRelY /= inputSequence.length;

    if (avgRelY > 0.8) {
      return 'Mẹo cử chỉ khẩn cấp "SOS": Bạn cần giữ tay cao hơn ở vị trí trước ngực hoặc ngang vai.';
    }
  }

  return null;
}
