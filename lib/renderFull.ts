/**
 * Full-resolution render pipeline.
 * At export time, re-runs all processing at the original image resolution
 * instead of the downscaled display resolution, preserving pixel quality.
 */
import { EditorState } from '@/types/editor';
import { applyColorAdjustments, applyVignetteOverlay, gaussianBlurRGBA } from './imageAdjust';
import { applyLiquifyInto, applyLiquifyWithPreservation } from './liquify';
import { applySkinSmooth, applyPrivacyBlur } from './skinSmooth';
import { applyFilter } from './filters';
import { buildFaceControlPoints, applyFaceWarp } from './faceWarp';
import { buildBodyControlPoints, hasBodyAdjustment } from './bodyWarp';

/** Nearest-neighbor upsample of a Float32Array mask */
function upsampleMask(
  mask: Float32Array,
  srcW: number, srcH: number,
  dstW: number, dstH: number,
): Float32Array {
  if (srcW === dstW && srcH === dstH) return new Float32Array(mask);
  const out = new Float32Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(Math.round(y * srcH / dstH), srcH - 1);
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(Math.round(x * srcW / dstW), srcW - 1);
      out[y * dstW + x] = mask[sy * srcW + sx];
    }
  }
  return out;
}

/**
 * Bilinear upsample of a displacement field, also scaling displacement values.
 * Each displacement value is in display-pixel units → multiply by valueScale
 * to convert to original-pixel units.
 */
function upsampleDisplacement(
  field: Float32Array,
  srcW: number, srcH: number,
  dstW: number, dstH: number,
  valueScale: number,
): Float32Array {
  if (srcW === dstW && srcH === dstH) {
    if (valueScale === 1) return new Float32Array(field);
    const copy = new Float32Array(field);
    for (let i = 0; i < copy.length; i++) copy[i] *= valueScale;
    return copy;
  }
  const out = new Float32Array(dstW * dstH);
  const scaleX = (srcW - 1) / Math.max(dstW - 1, 1);
  const scaleY = (srcH - 1) / Math.max(dstH - 1, 1);
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = x * scaleX;
      const sy = y * scaleY;
      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const fx = sx - sx0;
      const fy = sy - sy0;
      const sx1 = Math.min(sx0 + 1, srcW - 1);
      const sy1 = Math.min(sy0 + 1, srcH - 1);
      const v =
        field[sy0 * srcW + sx0] * (1 - fx) * (1 - fy) +
        field[sy0 * srcW + sx1] * fx       * (1 - fy) +
        field[sy1 * srcW + sx0] * (1 - fx) * fy +
        field[sy1 * srcW + sx1] * fx       * fy;
      out[y * dstW + x] = v * valueScale;
    }
  }
  return out;
}

/**
 * Render the full editor pipeline at the original image resolution.
 * Masks and displacement fields are upsampled from display resolution.
 * Returns an HTMLCanvasElement with the full-resolution composited result.
 */
export function renderAtOriginalResolution(state: EditorState): HTMLCanvasElement {
  const { originalImage, imageWidth: origW, imageHeight: origH, displayScale } = state;
  if (!originalImage) throw new Error('No image loaded');

  const displayW = Math.round(origW * displayScale);
  const displayH = Math.round(origH * displayScale);
  // How much larger is the original vs display
  const upScale = 1 / displayScale;

  const canvas = document.createElement('canvas');
  canvas.width = origW;
  canvas.height = origH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Draw original at full resolution
  ctx.drawImage(originalImage, 0, 0, origW, origH);
  let id = ctx.getImageData(0, 0, origW, origH);

  // Face warp: landmarks are stored at display resolution → scale up
  if (state.landmarks && state.landmarks.length > 400) {
    const scaledLandmarks = state.landmarks.map(l => ({
      ...l,
      x: l.x * upScale,
      y: l.y * upScale,
    }));
    const cps = buildFaceControlPoints(scaledLandmarks, state.faceAdjustments);
    if (cps.length > 0) id = applyFaceWarp(id, cps);
  }

  // Body warp: anchors are stored at display resolution → scale up
  if (hasBodyAdjustment(state.bodyAnchors, state.bodyAdjustments)) {
    const a = state.bodyAnchors;
    const scaledAnchors = {
      chest:      a.chest      ? { x: a.chest.x      * upScale, y: a.chest.y      * upScale } : null,
      leftThigh:  a.leftThigh  ? { x: a.leftThigh.x  * upScale, y: a.leftThigh.y  * upScale } : null,
      rightThigh: a.rightThigh ? { x: a.rightThigh.x * upScale, y: a.rightThigh.y * upScale } : null,
    };
    const bodyCPs = buildBodyControlPoints(scaledAnchors, state.bodyAdjustments, origW, origH);
    if (bodyCPs.length > 0) id = applyFaceWarp(id, bodyCPs);
  }

  // Skin smooth: upsample mask from display to original resolution
  if (state.skinMask) {
    let hasMask = false;
    for (let i = 0; i < state.skinMask.length; i += 200) {
      if (state.skinMask[i] > 0) { hasMask = true; break; }
    }
    if (hasMask) {
      const bigMask = upsampleMask(state.skinMask, displayW, displayH, origW, origH);
      id = applySkinSmooth(id, bigMask, state.skinSettings.smoothness, state.skinSettings.skinBrightness);
    }
  }

  // Privacy blur: upsample mask
  if (state.privacyMask) {
    let hasMask = false;
    for (let i = 0; i < state.privacyMask.length; i += 200) {
      if (state.privacyMask[i] > 0) { hasMask = true; break; }
    }
    if (hasMask) {
      const bigMask = upsampleMask(state.privacyMask, displayW, displayH, origW, origH);
      id = applyPrivacyBlur(id, bigMask);
    }
  }

  // Color adjustments + filter
  id = applyColorAdjustments(id, state.adjustments);
  if (state.activeFilter !== 'none') id = applyFilter(id, state.activeFilter);

  // Liquify: upsample displacement fields and scale displacement values
  if (state.liquifyDX && state.liquifyDY) {
    let hasLiq = false;
    for (let i = 0; i < state.liquifyDX.length; i += 500) {
      if (state.liquifyDX[i] !== 0) { hasLiq = true; break; }
    }
    if (hasLiq) {
      const bigDX = upsampleDisplacement(state.liquifyDX, displayW, displayH, origW, origH, upScale);
      const bigDY = upsampleDisplacement(state.liquifyDY, displayW, displayH, origW, origH, upScale);
      const outBuf = new Uint8ClampedArray(origW * origH * 4);
      const t = state.liquifySettings.texturePreservation / 100;
      if (t > 0) {
        // Scale blur radius proportionally
        const blurRadius = Math.max(2, Math.round(5 * upScale));
        const blurred = gaussianBlurRGBA(id, blurRadius);
        applyLiquifyWithPreservation(id.data, blurred.data, outBuf, bigDX, bigDY, origW, origH, t);
      } else {
        applyLiquifyInto(id.data, outBuf, bigDX, bigDY, origW, origH);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id = new ImageData(outBuf as any, origW, origH);
    }
  }

  ctx.putImageData(id, 0, 0);

  // Vignette (drawn as canvas overlay, scale-independent)
  if (state.adjustments.vignette > 0) {
    applyVignetteOverlay(ctx, origW, origH, state.adjustments.vignette);
  }

  return canvas;
}
