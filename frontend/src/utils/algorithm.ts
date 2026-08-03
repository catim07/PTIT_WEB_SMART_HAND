import { type Landmark, type GestureTemplate } from '../types';

/**
 * Exponential Moving Average (EMA) Landmark Smoother to reduce camera jitter & noise.
 */
let prevSmoothedLandmarks: Landmark[] | null = null;

export function resetEMAFilter(): void {
  prevSmoothedLandmarks = null;
}

export function filterLandmarksEMA(landmarks: Landmark[], alpha = 0.85): Landmark[] {
  if (!landmarks || landmarks.length === 0) return [];
  if (!prevSmoothedLandmarks || prevSmoothedLandmarks.length !== landmarks.length) {
    prevSmoothedLandmarks = landmarks.map(l => ({ ...l }));
    return landmarks;
  }

  const smoothed = landmarks.map((l, i) => {
    const prev = prevSmoothedLandmarks![i];
    return {
      x: alpha * l.x + (1 - alpha) * prev.x,
      y: alpha * l.y + (1 - alpha) * prev.y,
      z: alpha * l.z + (1 - alpha) * (prev.z || 0),
      visibility: l.visibility
    };
  });

  prevSmoothedLandmarks = smoothed;
  return smoothed;
}

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
 * extracting hand shapes, relative coordinates to the face, and dual-hand spatial vectors.
 */
export function extractFeatures(
  handLandmarks: Landmark[] | null,
  poseLandmarks: Landmark[] | null,
  secondHandLandmarks?: Landmark[] | null
): {
  normalizedCoords: Landmark[];
  featureVector: number[];
} {
  // If main hand is not detected, we cannot extract meaningful gesture features
  if (!handLandmarks || handLandmarks.length !== 21) {
    return { normalizedCoords: [], featureVector: [] };
  }

  // Apply EMA smoothing to main hand
  const smoothedHand = filterLandmarksEMA(handLandmarks);
  const wrist = smoothedHand[0];

  // 1. Hand Coordinate Translation Invariance (Relative to Wrist)
  const shifted: Landmark[] = smoothedHand.map(l => ({
    x: l.x - wrist.x,
    y: l.y - wrist.y,
    z: l.z - wrist.z
  }));

  // 2. Scale Invariance (Relative to distance L0 -> L9 middle base)
  const scale = getDistance3D(smoothedHand[0], smoothedHand[9]) || 0.1;
  const normalizedCoords: Landmark[] = shifted.map(l => ({
    x: l.x / scale,
    y: l.y / scale,
    z: l.z / scale
  }));

  // 3. Feature Vector Generation (84 dimensions including dual-hand fusion)
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
  if (poseLandmarks && poseLandmarks[0]) {
    const nose = poseLandmarks[0];
    const bodyScale = (poseLandmarks[11] && poseLandmarks[12]) 
      ? getDistance3D(poseLandmarks[11], poseLandmarks[12]) || 0.3
      : 0.3;
      
    featureVector.push(
      (wrist.x - nose.x) / bodyScale,
      (wrist.y - nose.y) / bodyScale,
      (wrist.z - nose.z) / bodyScale
    );
  } else {
    featureVector.push(0, 0, 0);
  }

  // E. Dual-Hand Spatial Feature Fusion (3 features)
  if (secondHandLandmarks && secondHandLandmarks.length === 21) {
    const wrist2 = secondHandLandmarks[0];
    const bodyScale = (poseLandmarks && poseLandmarks[11] && poseLandmarks[12])
      ? getDistance3D(poseLandmarks[11], poseLandmarks[12]) || 0.3
      : 0.3;

    featureVector.push(
      (wrist.x - wrist2.x) / bodyScale,
      (wrist.y - wrist2.y) / bodyScale,
      (wrist.z - wrist2.z) / bodyScale
    );
  } else {
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
 * Comprehensive Real-Time Posture Coach (Grammarly Cho Cử Chỉ V2).
 * Evaluates posture geometry, elevation, finger extension, and orientation for 11+ gestures.
 */
export function diagnoseGestureError(
  label: string,
  inputSequence: number[][],
  landmarksSequence: Landmark[][]
): string | null {
  if (inputSequence.length === 0 || landmarksSequence.length === 0) return null;

  const lastFrameLandmarks = landmarksSequence[landmarksSequence.length - 1];

  // 1. UONG_NUOC (Drinking water): Hand raised near mouth/face
  if (label === 'UONG_NUOC') {
    let minRelY = Infinity;
    for (const vec of inputSequence) {
      const relY = vec[vec.length - 5] !== undefined ? vec[vec.length - 5] : vec[vec.length - 2];
      if (relY < minRelY) minRelY = relY;
    }
    if (minRelY > 0.35) {
      return 'Mẹo cử chỉ "Uống Nước": Bạn cần đưa bàn tay lên cao sát miệng hơn.';
    }
  }

  // 2. HELLO / TAM_BIET (Wave Goodbye/Hello): Extended fingers & hand high near shoulder/head
  if (label === 'HELLO' || label === 'TAM_BIET') {
    let avgTipDistSum = 0;
    for (const vec of inputSequence) {
      const tips = vec.slice(63, 68);
      const avgTips = tips.reduce((s, v) => s + v, 0) / (tips.length || 1);
      avgTipDistSum += avgTips;
    }
    const finalAvgTipDist = avgTipDistSum / inputSequence.length;

    if (finalAvgTipDist < 1.0) {
      return `Mẹo cử chỉ "${label === 'HELLO' ? 'Chào Bạn' : 'Tạm Biệt'}": Hãy mở rộng các ngón tay và xòe lòng bàn tay ra.`;
    }
  }

  // 3. SOS (Emergency): High elevation & crossed posture
  if (label === 'SOS') {
    let avgRelY = 0;
    for (const vec of inputSequence) {
      avgRelY += vec[vec.length - 5] !== undefined ? vec[vec.length - 5] : vec[vec.length - 2];
    }
    avgRelY /= inputSequence.length;

    if (avgRelY > 0.7) {
      return 'Mẹo cử chỉ khẩn cấp "SOS": Hãy giữ tay cao hơn ở vị trí trước ngực hoặc ngang vai.';
    }
  }

  // 4. LIKE (Thumbs Up): Thumb pointing upwards
  if (label === 'LIKE') {
    if (lastFrameLandmarks && lastFrameLandmarks.length === 21) {
      const thumbTip = lastFrameLandmarks[4];
      const indexTip = lastFrameLandmarks[8];
      if (thumbTip.y >= indexTip.y) {
        return 'Mẹo cử chỉ "LIKE": Hãy hướng ngón tay cái thẳng đứng lên trên.';
      }
    }
  }

  // 5. DISLIKE (Thumbs Down): Thumb pointing downwards
  if (label === 'DISLIKE') {
    if (lastFrameLandmarks && lastFrameLandmarks.length === 21) {
      const thumbTip = lastFrameLandmarks[4];
      const wrist = lastFrameLandmarks[0];
      if (thumbTip.y <= wrist.y) {
        return 'Mẹo cử chỉ "DISLIKE": Hãy quay ngón cái chúi thẳng xuống đất.';
      }
    }
  }

  // 6. CAM_ON (Thank you): Flat open palm near chest/chin
  if (label === 'CAM_ON') {
    if (lastFrameLandmarks && lastFrameLandmarks.length === 21) {
      const wrist = lastFrameLandmarks[0];
      const middleTip = lastFrameLandmarks[12];
      const len = getDistance3D(wrist, middleTip);
      if (len < 0.2) {
        return 'Mẹo cử chỉ "Cảm Ơn": Duỗi thẳng lòng bàn tay chạm nhẹ hướng về phía trước.';
      }
    }
  }

  // 7. XIN_LOI (Sorry): Closed fist near chest
  if (label === 'XIN_LOI') {
    if (lastFrameLandmarks && lastFrameLandmarks.length === 21) {
      const wrist = lastFrameLandmarks[0];
      const middleTip = lastFrameLandmarks[12];
      const len = getDistance3D(wrist, middleTip);
      if (len > 0.35) {
        return 'Mẹo cử chỉ "Xin Lỗi": Nắm nhẹ bàn tay lại thành hình nắm đấm trước ngực.';
      }
    }
  }

  // 8. OK (Okay sign): Thumb and index tips touching
  if (label === 'OK') {
    if (lastFrameLandmarks && lastFrameLandmarks.length === 21) {
      const thumbTip = lastFrameLandmarks[4];
      const indexTip = lastFrameLandmarks[8];
      const dist = getDistance3D(thumbTip, indexTip);
      if (dist > 0.08) {
        return 'Mẹo cử chỉ "OK": Chạm đầu ngón cái và ngón trỏ vào nhau tạo thành hình tròn.';
      }
    }
  }

  // 9. YEU_THUONG (Love): I Love You hand sign (Thumb, Index, Pinky extended)
  if (label === 'YEU_THUONG') {
    if (lastFrameLandmarks && lastFrameLandmarks.length === 21) {
      const wrist = lastFrameLandmarks[0];
      const indexTip = lastFrameLandmarks[8];
      const pinkyTip = lastFrameLandmarks[20];
      const middleTip = lastFrameLandmarks[12];

      const indexLen = getDistance3D(wrist, indexTip);
      const pinkyLen = getDistance3D(wrist, pinkyTip);
      const middleLen = getDistance3D(wrist, middleTip);

      if (indexLen < 0.2 || pinkyLen < 0.2 || middleLen > 0.25) {
        return 'Mẹo cử chỉ "Yêu Thương": Giữ duỗi ngón trỏ, ngón út và ngón cái; gập ngón giữa và ngón áp út lại.';
      }
    }
  }

  // 10. GIUP_DOI (Help): Open palm facing up
  if (label === 'GIUP_DOI') {
    if (lastFrameLandmarks && lastFrameLandmarks.length === 21) {
      const wrist = lastFrameLandmarks[0];
      const middleTip = lastFrameLandmarks[12];
      if (middleTip.y > wrist.y + 0.1) {
        return 'Mẹo cử chỉ "Giúp Đỡ": Đưa ngửa lòng bàn tay hướng lên phía trước.';
      }
    }
  }

  return null;
}

/**
 * Accurately counts extended fingers (0 to 5) from 21 MediaPipe hand landmarks
 * using 3D skeletal geometry and joint angle thresholds.
 */
export function countExtendedFingers(handLandmarks: Landmark[]): { count: number; label: string; details: string } {
  if (!handLandmarks || handLandmarks.length !== 21) {
    return { count: 0, label: 'SO_0', details: 'SO_0 (Nắm Tay)' };
  }

  const wrist = handLandmarks[0];
  const thumbTip = handLandmarks[4];
  const indexTip = handLandmarks[8];
  const middleTip = handLandmarks[12];
  const ringTip = handLandmarks[16];
  const pinkyTip = handLandmarks[20];

  // For non-thumb fingers (Index: 8, Middle: 12, Ring: 16, Pinky: 20):
  // Compare 3D Euclidean distance from Wrist to Tip vs Wrist to PIP joint.
  const isIndexOpen = getDistance3D(indexTip, wrist) > getDistance3D(handLandmarks[6], wrist) * 1.12;
  const isMiddleOpen = getDistance3D(middleTip, wrist) > getDistance3D(handLandmarks[10], wrist) * 1.12;
  const isRingOpen = getDistance3D(ringTip, wrist) > getDistance3D(handLandmarks[14], wrist) * 1.12;
  const isPinkyOpen = getDistance3D(pinkyTip, wrist) > getDistance3D(handLandmarks[18], wrist) * 1.12;

  // 1. BAN_TIM (Finger Heart 🫰): Thumb Tip (4) and Index Tip (8) pinched close (<0.085 in 3D) while Index is extended outward (not folded deep in fist)
  const thumbIndexDist = getDistance3D(thumbTip, indexTip);
  const indexWristDist = getDistance3D(indexTip, wrist);
  const indexPipDist = getDistance3D(handLandmarks[6], wrist);
  if (thumbIndexDist < 0.085 && indexWristDist > indexPipDist * 0.95 && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    return { count: 2, label: 'BAN_TIM', details: 'BAN_TIM (Bắn Tim 🫰)' };
  }

  // 2. LIKE (Thích 👍): Thumb UP + Index/Middle/Ring/Pinky folded
  const thumbMcp = handLandmarks[2];
  const thumbDist = getDistance3D(thumbTip, handLandmarks[17]);
  const thumbBaseDist = getDistance3D(thumbMcp, handLandmarks[17]);
  const isThumbOpen = thumbDist > thumbBaseDist * 1.15;

  if (isThumbOpen && !isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen && thumbTip.y < thumbMcp.y) {
    return { count: 1, label: 'LIKE', details: 'LIKE (Thích 👍)' };
  }

  // 3. OK (Đồng ý 👌): Thumb Tip (4) and Index Tip (8) pinched in circle + Middle, Ring, Pinky extended open
  if (thumbIndexDist < 0.085 && isMiddleOpen && isRingOpen && isPinkyOpen) {
    return { count: 3, label: 'OK', details: 'OK (Đồng Ý 👌)' };
  }

  // 4. LOVE_YOU (Bắn Tim I Love You 🤟): Thumb, Index, Pinky extended + Middle & Ring folded
  if (isIndexOpen && isPinkyOpen && !isMiddleOpen && !isRingOpen) {
    return { count: 3, label: 'LOVE_YOU', details: 'LOVE_YOU (Yêu Bạn 🤟)' };
  }

  // 5. LETTER_A (Chữ A): Fist with Thumb resting along side
  if (!isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen && isThumbOpen && thumbTip.y >= thumbMcp.y) {
    return { count: 0, label: 'CHUU_A', details: 'CHUU_A (Chữ A)' };
  }

  // 6. LETTER_B (Chữ B): 4 fingers extended straight up together + Thumb folded TIGHTLY across palm center (MCP 9)
  const thumbPalmCenterDist = getDistance3D(thumbTip, handLandmarks[9]);
  if (isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen && !isThumbOpen && thumbPalmCenterDist < 0.11) {
    return { count: 4, label: 'CHUU_B', details: 'CHUU_B (Chữ B)' };
  }

  // 7. LETTER_C (Chữ C): All fingers curved forming a "C" shape
  if (thumbIndexDist >= 0.09 && thumbIndexDist <= 0.24 && isIndexOpen && !isRingOpen && !isPinkyOpen && isThumbOpen) {
    const middleDist = getDistance3D(middleTip, wrist);
    if (middleDist < getDistance3D(indexTip, wrist) * 1.05) {
      return { count: 1, label: 'CHUU_C', details: 'CHUU_C (Chữ C)' };
    }
  }

  // 8. LETTER_D (Chữ D): Index finger extended UP straight + Thumb tip touching Middle & Ring tips
  const thumbMiddleDist = getDistance3D(thumbTip, middleTip);
  if (isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen && thumbMiddleDist < 0.10) {
    return { count: 1, label: 'CHUU_D', details: 'CHUU_D (Chữ D)' };
  }

  // 9. LETTER_E (Chữ E): All fingertips bent touching thumb tip in a small fist
  if (!isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen && !isThumbOpen && thumbIndexDist < 0.075) {
    return { count: 0, label: 'CHUU_E', details: 'CHUU_E (Chữ E)' };
  }

  // 10. LETTER_G (Chữ G): Index finger & Thumb extended horizontally forming gun/claw shape
  const indexHoriz = Math.abs(indexTip.y - handLandmarks[5].y) < 0.08 && isIndexOpen;
  if (indexHoriz && isThumbOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    return { count: 2, label: 'CHUU_G', details: 'CHUU_G (Chữ G)' };
  }

  // 11. LETTER_H (Chữ H): Index & Middle extended horizontally together
  const middleHoriz = Math.abs(middleTip.y - handLandmarks[9].y) < 0.08 && isMiddleOpen;
  if (indexHoriz && middleHoriz && !isRingOpen && !isPinkyOpen) {
    return { count: 2, label: 'CHUU_H', details: 'CHUU_H (Chữ H)' };
  }

  // 12. LETTER_I (Chữ I): Pinky finger pointing UP straight, other fingers folded into fist
  if (isPinkyOpen && !isIndexOpen && !isMiddleOpen && !isRingOpen && !isThumbOpen) {
    return { count: 1, label: 'CHUU_I', details: 'CHUU_I (Chữ I)' };
  }

  // 13. LETTER_L (Chữ L): Index finger pointing UP + Thumb extended horizontally forming "L"
  if (isIndexOpen && isThumbOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen && thumbTip.x !== indexTip.x && thumbTip.y > indexTip.y) {
    return { count: 2, label: 'CHUU_L', details: 'CHUU_L (Chữ L)' };
  }

  // 14. LETTER_P (Chữ P - Biểu tượng PTIT): Index finger pointing DOWN/FORWARD + Thumb touching middle finger
  if (isIndexOpen && indexTip.y > handLandmarks[5].y && !isRingOpen && !isPinkyOpen) {
    return { count: 2, label: 'CHUU_P', details: 'CHUU_P (Chữ P - PTIT 🎓)' };
  }

  // 15. LETTER_T (Chữ T - Thầy Cô): Thumb tucked under index finger
  const indexMcp = handLandmarks[5];
  if (getDistance3D(thumbTip, indexMcp) < 0.08 && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    return { count: 1, label: 'CHUU_T', details: 'CHUU_T (Chữ T - Thầy Cô 👨‍🏫)' };
  }

  // 16. LETTER_M (Chữ M): 3 fingers (Index, Middle, Ring) pointing DOWN over thumb
  if (indexTip.y > wrist.y && middleTip.y > wrist.y && ringTip.y > wrist.y && pinkyTip.y <= wrist.y) {
    return { count: 3, label: 'CHUU_M', details: 'CHUU_M (Chữ M)' };
  }

  // 17. LETTER_N (Chữ N): 2 fingers (Index, Middle) pointing DOWN over thumb
  if (indexTip.y > wrist.y && middleTip.y > wrist.y && ringTip.y <= wrist.y) {
    return { count: 2, label: 'CHUU_N', details: 'CHUU_N (Chữ N)' };
  }

  // 16. LETTER_O (Chữ O): All 5 fingertips curved meeting in an "O" circle
  if (thumbIndexDist < 0.08 && getDistance3D(thumbTip, middleTip) < 0.08 && !isIndexOpen && !isPinkyOpen) {
    return { count: 0, label: 'CHUU_O', details: 'CHUU_O (Chữ O)' };
  }

  // 17. LETTER_U (Chữ U): Index & Middle extended UP touching together
  const indexMiddleDist = getDistance3D(indexTip, middleTip);
  if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen && indexMiddleDist < 0.055) {
    return { count: 2, label: 'CHUU_U', details: 'CHUU_U (Chữ U)' };
  }

  // 18. LETTER_V (Chữ V): Index & Middle extended UP spread in V-shape
  if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen && indexMiddleDist >= 0.055) {
    return { count: 2, label: 'CHUU_V', details: 'CHUU_V (Chữ V)' };
  }

  // 19. LETTER_W (Chữ W): Index, Middle, Ring extended UP spread (3 fingers)
  if (isIndexOpen && isMiddleOpen && isRingOpen && !isPinkyOpen) {
    return { count: 3, label: 'CHUU_W', details: 'CHUU_W (Chữ W)' };
  }

  // 20. LETTER_Y (Chữ Y): Thumb & Pinky extended out (Hang Loose / Shaka)
  if (isThumbOpen && isPinkyOpen && !isIndexOpen && !isMiddleOpen && !isRingOpen) {
    return { count: 2, label: 'CHUU_Y', details: 'CHUU_Y (Chữ Y)' };
  }

  // 21. LETTER_K (Chữ K): Index UP + Middle forward/angled
  if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen && getDistance3D(thumbTip, handLandmarks[9]) < 0.12) {
    return { count: 2, label: 'CHUU_K', details: 'CHUU_K (Chữ K)' };
  }

  // 22. LETTER_Q (Chữ Q): Index & Thumb pointing DOWN forming a hook
  if (indexTip.y > handLandmarks[5].y && isThumbOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    return { count: 2, label: 'CHUU_Q', details: 'CHUU_Q (Chữ Q)' };
  }

  // 23. LETTER_R (Chữ R): Index crossed over Middle finger
  if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen && getDistance3D(indexTip, middleTip) < 0.035) {
    return { count: 2, label: 'CHUU_R', details: 'CHUU_R (Chữ R)' };
  }

  // 24. Closed Fist (Nắm Đấm / Nắm Tay): All 5 fingers folded
  if (!isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen && !isThumbOpen) {
    return { count: 0, label: 'SO_0', details: 'SO_0 (Nắm Tay)' };
  }

  // 25. LETTER_X (Chữ X): Index finger bent into a hook shape
  if (!isMiddleOpen && !isRingOpen && !isPinkyOpen && getDistance3D(indexTip, wrist) < getDistance3D(handLandmarks[6], wrist)) {
    return { count: 1, label: 'CHUU_X', details: 'CHUU_X (Chữ X)' };
  }

  let count = 0;
  if (isThumbOpen) count++;
  if (isIndexOpen) count++;
  if (isMiddleOpen) count++;
  if (isRingOpen) count++;
  if (isPinkyOpen) count++;

  const labelMap: Record<number, string> = {
    0: 'SO_0 (Nắm Tay)',
    1: 'SO_1 (1 Ngón - Số 1)',
    2: 'SO_2 (2 Ngón - Số 2)',
    3: 'SO_3 (3 Ngón - Số 3)',
    4: 'SO_4 (4 Ngón - Số 4)',
    5: 'SO_5 (5 Ngón - Số 5)',
  };

  return {
    count,
    label: `SO_${count}`,
    details: labelMap[count] || `SO_${count} (Số ${count})`,
  };
}

/**
 * Detects 2-hand dynamic gestures (Dual-Hand VSL) when both left and right hands are present.
 */
export function detectDualHandGesture(leftHand: Landmark[], rightHand: Landmark[]): { label: string; details: string } | null {
  if (!leftHand || leftHand.length !== 21 || !rightHand || rightHand.length !== 21) {
    return null;
  }

  const leftWrist = leftHand[0];
  const rightWrist = rightHand[0];

  // Distance between wrists
  const wristDist = getDistance3D(leftWrist, rightWrist);

  // 1. BAN_TIM_2T (Trái Tim 2 Tay 🫶): Wrists/thumbs/index tips touching
  const leftThumb = leftHand[4];
  const rightThumb = rightHand[4];
  const leftIndex = leftHand[8];
  const rightIndex = rightHand[8];

  const thumbTouch = getDistance3D(leftThumb, rightThumb) < 0.12;
  const indexTouch = getDistance3D(leftIndex, rightIndex) < 0.12;

  if (thumbTouch && indexTouch) {
    return { label: 'BAN_TIM_2T', details: 'BAN_TIM_2T (Trái Tim 2 Tay 🫶)' };
  }

  // 2. CAM_ON_2T (Cảm Ơn / Chắp Tay 🙏): Both palms pressed close together
  const palmDist = getDistance3D(leftHand[9], rightHand[9]);
  if (palmDist < 0.14) {
    return { label: 'CAM_ON_2T', details: 'CAM_ON_2T (Cảm Ơn / Chắp Tay 🙏)' };
  }

  // 3. AN_COM_2T (Ăn Cơm 2 Tay 🍚): Left and right hands close near center
  if (wristDist < 0.22 && getDistance3D(rightIndex, rightThumb) < 0.09) {
    return { label: 'AN_COM_2T', details: 'AN_COM_2T (Ăn Cơm 2 Tay 🍚)' };
  }

  // 4. Dual-Hand Finger Count Sum (Số 6 -> Số 10): Sum extended fingers on both hands
  const leftFingers = countExtendedFingers(leftHand).count;
  const rightFingers = countExtendedFingers(rightHand).count;
  const totalFingers = leftFingers + rightFingers;

  if (totalFingers >= 6) {
    return {
      label: `SO_${totalFingers}`,
      details: `SO_${totalFingers} (${totalFingers} Ngón - Số ${totalFingers} 🙌)`
    };
  }

  return null;
}
