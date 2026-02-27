import { FaceLandmark, FaceAdjustments } from '@/types/editor';

// MediaPipe FaceMesh key landmark indices
const LM_JAW = [
  // Right cheek/jaw (image right)
  356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
  // Chin
  377, 152, 148,
  // Left cheek/jaw (image left)
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
];
const LM_CHIN = [152];
const LM_LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const LM_RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const LM_NOSE_TIP = [4, 5, 1, 19, 94];
const LM_LEFT_NOSE_WING = [129, 209, 198];
const LM_RIGHT_NOSE_WING = [358, 429, 420];
const LM_UPPER_LIP_TOP = [0, 267, 37, 39, 40, 270, 269];
const LM_LOWER_LIP_BOTTOM = [17, 314, 84, 181, 91, 405, 321];
const LM_MOUTH_CORNER = [61, 291]; // left, right corners

interface ControlPoint {
  x: number; y: number;
  dx: number; dy: number;
  sigma: number;
}

function landmarksToControlPoints(
  lm: FaceLandmark[],
  indices: number[],
  getDxDy: (lmPoint: FaceLandmark, centerX: number, centerY: number) => { dx: number; dy: number },
  sigma: number,
): ControlPoint[] {
  // Face center
  const xs = indices.map(i => lm[i]?.x ?? 0);
  const ys = indices.map(i => lm[i]?.y ?? 0);
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;

  return indices.map(i => {
    const p = lm[i];
    if (!p) return null;
    const { dx, dy } = getDxDy(p, cx, cy);
    return { x: p.x, y: p.y, dx, dy, sigma };
  }).filter(Boolean) as ControlPoint[];
}

function getFaceSize(lm: FaceLandmark[]): { faceWidth: number; faceHeight: number; cx: number; cy: number } {
  const faceOval = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  const xs = faceOval.map(i => lm[i]?.x ?? 0).filter(x => x > 0);
  const ys = faceOval.map(i => lm[i]?.y ?? 0).filter(y => y > 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    faceWidth: maxX - minX,
    faceHeight: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

/** Build a list of control points from face landmarks + adjustment values */
export function buildFaceControlPoints(
  lm: FaceLandmark[],
  adj: FaceAdjustments,
): ControlPoint[] {
  if (!lm || lm.length < 400) return [];
  const { faceWidth, faceHeight, cx, cy } = getFaceSize(lm);
  const allCPs: ControlPoint[] = [];

  // --- Small Face (slim overall face) ---
  if (adj.smallFace !== 0) {
    const strength = adj.smallFace / 100;
    const sigma = faceWidth * 0.35;
    const cps = landmarksToControlPoints(lm, LM_JAW,
      (p) => {
        const dx = (cx - p.x) * strength * 0.35;
        const dy = (cy - p.y) * strength * 0.1;
        return { dx, dy };
      },
      sigma,
    );
    allCPs.push(...cps);
  }

  // --- Slim Jaw ---
  if (adj.slimJaw !== 0) {
    const strength = adj.slimJaw / 100;
    const sigma = faceWidth * 0.22;
    const jawLower = [377, 400, 378, 379, 365, 397, 152, 148, 176, 149, 150];
    const cps = landmarksToControlPoints(lm, jawLower,
      (p) => ({
        dx: (cx - p.x) * strength * 0.28,
        dy: 0,
      }),
      sigma,
    );
    allCPs.push(...cps);
  }

  // --- Chin Length ---
  if (adj.chinLength !== 0) {
    const strength = adj.chinLength / 50;
    const delta = faceHeight * 0.04 * strength;
    const sigma = faceWidth * 0.15;
    LM_CHIN.forEach(i => {
      const p = lm[i]; if (!p) return;
      allCPs.push({ x: p.x, y: p.y, dx: 0, dy: delta, sigma });
    });
  }

  // --- Eye Size ---
  if (adj.eyeSize !== 0) {
    const strength = adj.eyeSize / 100;
    const expandFactor = strength * 0.22;
    const sigma = faceWidth * 0.09;

    const addEyeCPs = (eyeIndices: number[]) => {
      const pts = eyeIndices.map(i => lm[i]).filter(Boolean) as FaceLandmark[];
      const ecx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const ecy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      eyeIndices.forEach(i => {
        const p = lm[i]; if (!p) return;
        const dx = (p.x - ecx) * expandFactor;
        const dy = (p.y - ecy) * expandFactor;
        allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
      });
    };
    addEyeCPs(LM_LEFT_EYE);
    addEyeCPs(LM_RIGHT_EYE);
  }

  // --- Eye Width ---
  if (adj.eyeWidth !== 0) {
    const strength = adj.eyeWidth / 50;
    const sigma = faceWidth * 0.08;
    const corners = [33, 133, 362, 263]; // eye corners
    corners.forEach((i, ci) => {
      const p = lm[i]; if (!p) return;
      const dir = (ci < 2) ? (ci === 0 ? -1 : 1) : (ci === 2 ? -1 : 1);
      allCPs.push({ x: p.x, y: p.y, dx: dir * faceWidth * 0.025 * strength, dy: 0, sigma });
    });
  }

  // --- Nose Slim ---
  if (adj.noseSlim !== 0) {
    const strength = adj.noseSlim / 100;
    const noseCx = lm[1]?.x ?? cx;
    const sigma = faceWidth * 0.07;

    LM_LEFT_NOSE_WING.forEach(i => {
      const p = lm[i]; if (!p) return;
      allCPs.push({ x: p.x, y: p.y, dx: (noseCx - p.x) * strength * 0.45, dy: 0, sigma });
    });
    LM_RIGHT_NOSE_WING.forEach(i => {
      const p = lm[i]; if (!p) return;
      allCPs.push({ x: p.x, y: p.y, dx: (noseCx - p.x) * strength * 0.45, dy: 0, sigma });
    });
  }

  // --- Nose Tip ---
  if (adj.noseTip !== 0) {
    const strength = adj.noseTip / 50;
    const delta = faceHeight * 0.025 * strength;
    const sigma = faceWidth * 0.08;
    LM_NOSE_TIP.forEach(i => {
      const p = lm[i]; if (!p) return;
      allCPs.push({ x: p.x, y: p.y, dx: 0, dy: -delta, sigma });
    });
  }

  // --- Lip Thickness ---
  if (adj.lipThickness !== 0) {
    const strength = adj.lipThickness / 50;
    const delta = faceHeight * 0.018 * strength;
    const sigma = faceWidth * 0.1;
    LM_UPPER_LIP_TOP.forEach(i => {
      const p = lm[i]; if (!p) return;
      allCPs.push({ x: p.x, y: p.y, dx: 0, dy: -delta * 0.6, sigma });
    });
    LM_LOWER_LIP_BOTTOM.forEach(i => {
      const p = lm[i]; if (!p) return;
      allCPs.push({ x: p.x, y: p.y, dx: 0, dy: delta * 0.6, sigma });
    });
  }

  // --- Mouth Corner (smile/frown) ---
  if (adj.mouthCorner !== 0) {
    const strength = adj.mouthCorner / 50;
    const delta = faceHeight * 0.015 * strength;
    const sigma = faceWidth * 0.06;
    LM_MOUTH_CORNER.forEach(i => {
      const p = lm[i]; if (!p) return;
      allCPs.push({ x: p.x, y: p.y, dx: 0, dy: -delta, sigma });
    });
  }

  return allCPs;
}

/**
 * Apply face warp using Gaussian-weighted displacement from control points.
 * Computes a displacement field and warps the image.
 * For performance, works at full resolution (pre-scale to display size before calling).
 */
export function applyFaceWarp(
  imageData: ImageData,
  controlPoints: ControlPoint[],
): ImageData {
  if (controlPoints.length === 0) return imageData;

  const { width, height } = imageData;
  const src = imageData.data;
  const outData = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let totalDx = 0;
      let totalDy = 0;

      for (const cp of controlPoints) {
        const d2 = (x - cp.x) ** 2 + (y - cp.y) ** 2;
        const sigma2 = cp.sigma ** 2;
        if (d2 > sigma2 * 9) continue; // skip distant points (> 3σ)
        const w = Math.exp(-d2 / (2 * sigma2));
        totalDx += cp.dx * w;
        totalDy += cp.dy * w;
      }

      // Sample from source at (x + totalDx, y + totalDy) - inverse warp
      const sx = x - totalDx;
      const sy = y - totalDy;

      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const fx = sx - sx0;
      const fy = sy - sy0;

      const sx0c = sx0 < 0 ? 0 : sx0 >= width ? width - 1 : sx0;
      const sx1c = (sx0 + 1) < 0 ? 0 : (sx0 + 1) >= width ? width - 1 : sx0 + 1;
      const sy0c = sy0 < 0 ? 0 : sy0 >= height ? height - 1 : sy0;
      const sy1c = (sy0 + 1) < 0 ? 0 : (sy0 + 1) >= height ? height - 1 : sy0 + 1;

      const i00 = (sy0c * width + sx0c) * 4;
      const i10 = (sy0c * width + sx1c) * 4;
      const i01 = (sy1c * width + sx0c) * 4;
      const i11 = (sy1c * width + sx1c) * 4;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const oi = (y * width + x) * 4;
      outData[oi]   = src[i00]   * w00 + src[i10]   * w10 + src[i01]   * w01 + src[i11]   * w11;
      outData[oi+1] = src[i00+1] * w00 + src[i10+1] * w10 + src[i01+1] * w01 + src[i11+1] * w11;
      outData[oi+2] = src[i00+2] * w00 + src[i10+2] * w10 + src[i01+2] * w01 + src[i11+2] * w11;
      outData[oi+3] = src[i00+3] * w00 + src[i10+3] * w10 + src[i01+3] * w01 + src[i11+3] * w11;
    }
  }

  return new ImageData(outData, width, height);
}

export type { ControlPoint };
