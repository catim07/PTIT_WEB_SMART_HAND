import { type Landmark } from '../types';

// Connection pairs of the hand skeleton (indexes 0-20)
const CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm connections (metacarpal bases)
  [5, 9], [9, 13], [13, 17]
];

export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  isRec: boolean
): void {
  if (!landmarks || landmarks.length !== 21) return;

  // Set line styles for skeleton bones
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw bone lines (glowing cyan-blue)
  ctx.shadowBlur = 10;
  ctx.shadowColor = isRec ? '#ff1744' : '#00f2fe';
  ctx.strokeStyle = isRec ? 'rgba(255, 23, 68, 0.8)' : 'rgba(0, 242, 254, 0.8)';

  for (const [startIdx, endIdx] of CONNECTIONS) {
    const start = landmarks[startIdx];
    const end = landmarks[endIdx];

    if (!start || !end) continue;

    // Flip X axis on screen because the video is mirrored
    const sx = (1 - start.x) * width;
    const sy = start.y * height;
    const ex = (1 - end.x) * width;
    const ey = end.y * height;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  // Draw joints (purple/pink glow)
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#bf55ec';
  ctx.fillStyle = '#bf55ec';

  landmarks.forEach((landmark, idx) => {
    // Flip X axis
    const x = (1 - landmark.x) * width;
    const y = landmark.y * height;

    ctx.beginPath();
    // Highlight fingertips (4, 8, 12, 16, 20) with green/gold
    if ([4, 8, 12, 16, 20].includes(idx)) {
      ctx.fillStyle = isRec ? '#ff1744' : '#00e676';
      ctx.shadowColor = isRec ? '#ff1744' : '#00e676';
      ctx.arc(x, y, 7, 0, 2 * Math.PI);
    } else if (idx === 0) {
      // Highlight wrist
      ctx.fillStyle = '#4facfe';
      ctx.shadowColor = '#4facfe';
      ctx.arc(x, y, 9, 0, 2 * Math.PI);
    } else {
      ctx.fillStyle = '#bf55ec';
      ctx.shadowColor = '#bf55ec';
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
    }
    ctx.fill();
  });

  // Reset shadow for next drawing cycles
  ctx.shadowBlur = 0;
}
