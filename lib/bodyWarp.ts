import { BodyAnchors, BodyAdjustments } from '@/types/editor';
import { ControlPoint } from './faceWarp';

/**
 * Build Gaussian-weighted control points for body part expansion/contraction.
 * Uses the same algorithm as faceWarp — can be fed directly to applyFaceWarp().
 *
 * Positive size = expand (larger), Negative = contract (smaller).
 * The effect: output pixels near the anchor sample from closer to the anchor center
 * in the source image, producing a stretching (expand) or compression (contract).
 */
function buildExpansionCPs(
  cx: number, cy: number,
  size: number,
  sigma: number,
): ControlPoint[] {
  if (size === 0) return [];
  const strength = size / 50; // normalise to -1...+1
  const cps: ControlPoint[] = [];

  // Ring of control points around the center
  const N = 12;
  const r = sigma * 0.45;
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    // Outward displacement: positive strength → outward dx,dy → expand
    const dx = Math.cos(angle) * sigma * 0.22 * strength;
    const dy = Math.sin(angle) * sigma * 0.22 * strength;
    cps.push({ x: px, y: py, dx, dy, sigma });
  }

  // Anchor pin at center with zero displacement to keep center stable
  cps.push({ x: cx, y: cy, dx: 0, dy: 0, sigma: sigma * 0.4 });

  return cps;
}

/** Build all body control points from anchors + adjustments */
export function buildBodyControlPoints(
  anchors: BodyAnchors,
  adj: BodyAdjustments,
  canvasW: number,
  canvasH: number,
): ControlPoint[] {
  const cps: ControlPoint[] = [];
  void canvasH; // may be used for vertical sigma in the future

  // Chest
  if (anchors.chest) {
    const sigma = canvasW * 0.13;
    cps.push(...buildExpansionCPs(anchors.chest.x, anchors.chest.y, adj.chestSize, sigma));
  }

  // Left thigh (combined: shared + independent)
  if (anchors.leftThigh) {
    const total = adj.thighSize + adj.leftThighSize;
    if (total !== 0) {
      const sigma = canvasW * 0.11;
      cps.push(...buildExpansionCPs(anchors.leftThigh.x, anchors.leftThigh.y, total, sigma));
    }
  }

  // Right thigh
  if (anchors.rightThigh) {
    const total = adj.thighSize + adj.rightThighSize;
    if (total !== 0) {
      const sigma = canvasW * 0.11;
      cps.push(...buildExpansionCPs(anchors.rightThigh.x, anchors.rightThigh.y, total, sigma));
    }
  }

  return cps;
}

/** Returns true if any body adjustment is non-zero and at least one anchor is set */
export function hasBodyAdjustment(anchors: BodyAnchors, adj: BodyAdjustments): boolean {
  if (anchors.chest && adj.chestSize !== 0) return true;
  if (anchors.leftThigh && (adj.thighSize + adj.leftThighSize) !== 0) return true;
  if (anchors.rightThigh && (adj.thighSize + adj.rightThighSize) !== 0) return true;
  return false;
}
