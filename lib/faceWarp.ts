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
const LM_LEFT_EYE  = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const LM_RIGHT_EYE = [33,  7,   163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const LM_NOSE_TIP        = [4, 5, 1, 19, 94];
const LM_LEFT_NOSE_WING  = [129, 209, 198];
const LM_RIGHT_NOSE_WING = [358, 429, 420];
const LM_UPPER_LIP_TOP    = [0, 267, 37, 39, 40, 270, 269];
const LM_LOWER_LIP_BOTTOM = [17, 314, 84, 181, 91, 405, 321];
const LM_MOUTH_CORNER = [61, 291]; // left, right corners

const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

export interface ControlPoint {
  x: number; y: number;
  dx: number; dy: number;
  sigma: number;
}

/** Build a list of control points from face landmarks + adjustment values.
 *  All displacements are computed in face-local space (face-right / face-up axes)
 *  so the result is correct regardless of head orientation (upright, lying down, etc.).
 */
export function buildFaceControlPoints(
  lm: FaceLandmark[],
  adj: FaceAdjustments,
): ControlPoint[] {
  if (!lm || lm.length < 400) return [];

  // ---- Face orientation from chin→forehead vector ----
  const chin     = lm[152];
  const forehead = lm[10];
  if (!chin || !forehead) return [];

  const upRawX = forehead.x - chin.x;
  const upRawY = forehead.y - chin.y;
  const upLen  = Math.hypot(upRawX, upRawY);
  if (upLen < 1) return [];

  // faceUp: unit vector from chin to forehead (anatomical "up")
  const faceUp = { x: upRawX / upLen, y: upRawY / upLen };
  // faceRight: 90° CCW from faceUp → points toward camera's right (face's anatomical left ear)
  const faceRight = { x: -faceUp.y, y: faceUp.x };

  // ---- Face center & anatomical width/height (projection-based, rotation-aware) ----
  let sumX = 0, sumY = 0, count = 0;
  let minR = Infinity, maxR = -Infinity;
  let minU = Infinity, maxU = -Infinity;

  for (const i of FACE_OVAL_INDICES) {
    const p = lm[i]; if (!p) continue;
    sumX += p.x; sumY += p.y; count++;
  }
  const cx = sumX / count;
  const cy = sumY / count;

  for (const i of FACE_OVAL_INDICES) {
    const p = lm[i]; if (!p) continue;
    const r = (p.x - cx) * faceRight.x + (p.y - cy) * faceRight.y;
    const u = (p.x - cx) * faceUp.x    + (p.y - cy) * faceUp.y;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
    if (u < minU) minU = u; if (u > maxU) maxU = u;
  }
  // Anatomical ear-to-ear and chin-to-forehead distances
  const faceWidth  = maxR - minR;
  const faceHeight = maxU - minU;

  // ---- Helpers ----
  /** Convert face-local displacement (h = rightward, v = upward) → image dx,dy */
  const toImg = (h: number, v: number) => ({
    dx: h * faceRight.x + v * faceUp.x,
    dy: h * faceRight.y + v * faceUp.y,
  });
  /** Signed projection of point onto face-right axis (relative to face center) */
  const projR = (px: number, py: number) =>
    (px - cx) * faceRight.x + (py - cy) * faceRight.y;
  /** Signed projection onto face-up axis */
  const projU = (px: number, py: number) =>
    (px - cx) * faceUp.x + (py - cy) * faceUp.y;

  const allCPs: ControlPoint[] = [];

  // ---- Small Face (slim overall face) ----
  if (adj.smallFace !== 0) {
    const strength = adj.smallFace / 100;
    const sigma = faceWidth * 0.35;
    LM_JAW.forEach(i => {
      const p = lm[i]; if (!p) return;
      // Pull toward face center: stronger horizontally, weaker vertically
      const { dx, dy } = toImg(
        -projR(p.x, p.y) * strength * 0.35,
        -projU(p.x, p.y) * strength * 0.1,
      );
      allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
    });
  }

  // ---- Slim Jaw ----
  if (adj.slimJaw !== 0) {
    const strength = adj.slimJaw / 100;
    const sigma = faceWidth * 0.22;
    const jawLower = [377, 400, 378, 379, 365, 397, 152, 148, 176, 149, 150];
    jawLower.forEach(i => {
      const p = lm[i]; if (!p) return;
      // Pull jaw landmarks toward center horizontally (face-right axis)
      const { dx, dy } = toImg(-projR(p.x, p.y) * strength * 0.28, 0);
      allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
    });
  }

  // ---- Chin Length ----
  if (adj.chinLength !== 0) {
    const strength = adj.chinLength / 50;
    // positive strength → longer chin → chin moves AWAY from forehead (−faceUp direction)
    const delta = faceHeight * 0.04 * strength;
    const sigma = faceWidth * 0.15;
    LM_CHIN.forEach(i => {
      const p = lm[i]; if (!p) return;
      const { dx, dy } = toImg(0, -delta); // -faceUp = away from forehead
      allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
    });
  }

  // ---- Eye Size ----
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
        // Expand from eye center — radial, inherently rotation-invariant
        allCPs.push({
          x: p.x, y: p.y,
          dx: (p.x - ecx) * expandFactor,
          dy: (p.y - ecy) * expandFactor,
          sigma,
        });
      });
    };
    addEyeCPs(LM_LEFT_EYE);
    addEyeCPs(LM_RIGHT_EYE);
  }

  // ---- Eye Width ----
  if (adj.eyeWidth !== 0) {
    const strength = adj.eyeWidth / 50;
    const sigma = faceWidth * 0.08;

    // For each eye, move its corners apart (or together) along the faceRight axis,
    // relative to that eye's own center
    const moveEyeCorners = (cornerIndices: number[], eyeIndices: number[]) => {
      const pts = eyeIndices.map(i => lm[i]).filter(Boolean) as FaceLandmark[];
      const ecx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const ecy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      cornerIndices.forEach(i => {
        const p = lm[i]; if (!p) return;
        // Project corner relative to eye center onto faceRight
        const relR = (p.x - ecx) * faceRight.x + (p.y - ecy) * faceRight.y;
        const dir = relR > 0 ? 1 : -1;
        const { dx, dy } = toImg(dir * faceWidth * 0.025 * strength, 0);
        allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
      });
    };
    moveEyeCorners([33, 133], LM_RIGHT_EYE);
    moveEyeCorners([362, 263], LM_LEFT_EYE);
  }

  // ---- Nose Slim ----
  if (adj.noseSlim !== 0) {
    const strength = adj.noseSlim / 100;
    const sigma = faceWidth * 0.07;
    const noseCentral = lm[1];
    if (noseCentral) {
      const noseR = projR(noseCentral.x, noseCentral.y);
      const addWing = (indices: number[]) => {
        indices.forEach(i => {
          const p = lm[i]; if (!p) return;
          // Pull wing toward nose center along faceRight axis
          const { dx, dy } = toImg((noseR - projR(p.x, p.y)) * strength * 0.45, 0);
          allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
        });
      };
      addWing(LM_LEFT_NOSE_WING);
      addWing(LM_RIGHT_NOSE_WING);
    }
  }

  // ---- Nose Tip ----
  if (adj.noseTip !== 0) {
    const strength = adj.noseTip / 50;
    // positive = raise nose tip = toward forehead = +faceUp direction
    const delta = faceHeight * 0.025 * strength;
    const sigma = faceWidth * 0.08;
    LM_NOSE_TIP.forEach(i => {
      const p = lm[i]; if (!p) return;
      const { dx, dy } = toImg(0, delta); // +faceUp = toward forehead
      allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
    });
  }

  // ---- Lip Thickness ----
  if (adj.lipThickness !== 0) {
    const strength = adj.lipThickness / 50;
    const delta = faceHeight * 0.018 * strength;
    const sigma = faceWidth * 0.1;
    LM_UPPER_LIP_TOP.forEach(i => {
      const p = lm[i]; if (!p) return;
      const { dx, dy } = toImg(0, delta * 0.6);  // upper lip → toward forehead
      allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
    });
    LM_LOWER_LIP_BOTTOM.forEach(i => {
      const p = lm[i]; if (!p) return;
      const { dx, dy } = toImg(0, -delta * 0.6); // lower lip → away from forehead
      allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
    });
  }

  // ---- Mouth Corner (smile/frown) ----
  if (adj.mouthCorner !== 0) {
    const strength = adj.mouthCorner / 50;
    // positive = lift corners = toward forehead = +faceUp direction
    const delta = faceHeight * 0.015 * strength;
    const sigma = faceWidth * 0.06;
    LM_MOUTH_CORNER.forEach(i => {
      const p = lm[i]; if (!p) return;
      const { dx, dy } = toImg(0, delta);
      allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
    });
  }

  // ---- Mouth Width ----
  if (adj.mouthWidth !== 0) {
    const strength = adj.mouthWidth / 50;
    const sigma = faceWidth * 0.07;
    const leftCorner = lm[61], rightCorner = lm[291];
    if (leftCorner && rightCorner) {
      const mouthCenterR = (projR(leftCorner.x, leftCorner.y) + projR(rightCorner.x, rightCorner.y)) / 2;
      const delta = faceWidth * 0.03 * strength;
      const moveCorners = (indices: number[]) => {
        indices.forEach(i => {
          const p = lm[i]; if (!p) return;
          // Move outward (or inward) from mouth center in faceRight direction
          const h = (projR(p.x, p.y) - mouthCenterR) > 0 ? delta : -delta;
          const { dx, dy } = toImg(h, 0);
          allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
        });
      };
      moveCorners([61, 78, 95, 88]);
      moveCorners([291, 308, 324, 318]);
    }
  }

  // ---- Mid-Face Shorten (中顔面短縮) ----
  // Compresses the distance between eyes and upper lip along the face-up axis.
  if (adj.midFaceShorten !== 0) {
    const strength = adj.midFaceShorten / 100;
    const sigma = faceHeight * 0.18;

    // Reference: lower eyelid (eye bottom) and top of upper lip — in face-up projection
    const eyeBottomProjU = (lm[23] && lm[253])
      ? (projU(lm[23].x, lm[23].y) + projU(lm[253].x, lm[253].y)) / 2
      : faceHeight * 0.15; // fallback: ~15% above face center

    const lipTopProjU = lm[0]
      ? projU(lm[0].x, lm[0].y)
      : eyeBottomProjU - faceHeight * 0.25; // fallback: below eye bottom

    const midFaceRangeU = eyeBottomProjU - lipTopProjU; // positive value
    const delta = midFaceRangeU * 0.25 * strength;

    // Nose, nostrils, philtrum — move toward forehead (+faceUp), more near lip
    const midFaceLandmarks = [1, 2, 4, 5, 6, 19, 94, 97, 98, 99, 129, 358, 164, 393, 168, 122, 351, 49, 279];
    midFaceLandmarks.forEach(i => {
      const p = lm[i]; if (!p) return;
      // relPos: 0 at eye bottom, 1 at lip top (more displacement near lip)
      const pProjU = projU(p.x, p.y);
      const relPos = midFaceRangeU > 0
        ? Math.max(0, Math.min(1, (eyeBottomProjU - pProjU) / midFaceRangeU))
        : 0;
      const { dx, dy } = toImg(0, delta * relPos); // +faceUp = toward forehead
      allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
    });

    // Upper lip also moves toward forehead
    LM_UPPER_LIP_TOP.forEach(i => {
      const p = lm[i]; if (!p) return;
      const { dx, dy } = toImg(0, delta * 0.5);
      allCPs.push({ x: p.x, y: p.y, dx, dy, sigma: faceWidth * 0.1 });
    });
  }

  // ---- Jawline Smooth (フェイスライン整え) ----
  // For each jaw landmark, compute where it "should" be on the straight reference line
  // between the chin and the cheek anchors (in face-local U coordinates), then
  // displace toward that reference to reduce bumps / droopiness.
  if (adj.jawlineSmooth !== 0) {
    const strength = adj.jawlineSmooth / 100;
    const sigma = faceWidth * 0.09;
    const rightCheekLm = lm[454];
    const leftCheekLm  = lm[234];
    const chinLm       = lm[152];
    if (rightCheekLm && leftCheekLm && chinLm) {
      const chinU       = projU(chinLm.x, chinLm.y);
      const rightCheekR = projR(rightCheekLm.x, rightCheekLm.y);
      const rightCheekU = projU(rightCheekLm.x, rightCheekLm.y);
      const leftCheekR  = projR(leftCheekLm.x, leftCheekLm.y);
      const leftCheekU  = projU(leftCheekLm.x, leftCheekLm.y);
      LM_JAW.forEach(i => {
        const p = lm[i]; if (!p) return;
        const pR = projR(p.x, p.y);
        const pU = projU(p.x, p.y);
        let refU: number;
        if (pR >= 0 && rightCheekR > 0) {
          const t = Math.min(1, pR / rightCheekR);
          refU = chinU + t * (rightCheekU - chinU);
        } else if (pR < 0 && leftCheekR < 0) {
          const t = Math.min(1, pR / leftCheekR);
          refU = chinU + t * (leftCheekU - chinU);
        } else {
          return;
        }
        const dU = (refU - pU) * strength * 0.6;
        if (Math.abs(dU) < 0.1) return;
        const { dx, dy } = toImg(0, dU);
        allCPs.push({ x: p.x, y: p.y, dx, dy, sigma });
      });
    }
  }

  return allCPs;
}

/**
 * Apply face warp using Gaussian-weighted displacement from control points.
 * For performance, works at display resolution (pre-scale landmarks before calling).
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
        if (d2 > sigma2 * 9) continue; // skip > 3σ
        const w = Math.exp(-d2 / (2 * sigma2));
        totalDx += cp.dx * w;
        totalDy += cp.dy * w;
      }

      // Inverse warp: sample from source at (x − dx, y − dy)
      const sx = x - totalDx;
      const sy = y - totalDy;

      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const fx = sx - sx0;
      const fy = sy - sy0;

      const sx0c = sx0 < 0 ? 0 : sx0 >= width  ? width  - 1 : sx0;
      const sx1c = sx0 + 1 < 0 ? 0 : sx0 + 1 >= width  ? width  - 1 : sx0 + 1;
      const sy0c = sy0 < 0 ? 0 : sy0 >= height ? height - 1 : sy0;
      const sy1c = sy0 + 1 < 0 ? 0 : sy0 + 1 >= height ? height - 1 : sy0 + 1;

      const i00 = (sy0c * width + sx0c) * 4;
      const i10 = (sy0c * width + sx1c) * 4;
      const i01 = (sy1c * width + sx0c) * 4;
      const i11 = (sy1c * width + sx1c) * 4;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx       * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx       * fy;

      const oi = (y * width + x) * 4;
      outData[oi]   = src[i00]   * w00 + src[i10]   * w10 + src[i01]   * w01 + src[i11]   * w11;
      outData[oi+1] = src[i00+1] * w00 + src[i10+1] * w10 + src[i01+1] * w01 + src[i11+1] * w11;
      outData[oi+2] = src[i00+2] * w00 + src[i10+2] * w10 + src[i01+2] * w01 + src[i11+2] * w11;
      outData[oi+3] = src[i00+3] * w00 + src[i10+3] * w10 + src[i01+3] * w01 + src[i11+3] * w11;
    }
  }

  return new ImageData(outData, width, height);
}
