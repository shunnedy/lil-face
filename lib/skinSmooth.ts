import { gaussianBlurRGBA } from './imageAdjust';

/**
 * Add paint to the skin-smooth mask at (cx, cy) with given radius.
 * mask values: 0=no effect, 1=full effect
 */
export function paintSkinMask(
  mask: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  strength: number, // 0-1
): void {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const d2 = (px - cx) ** 2 + (py - cy) ** 2;
      if (d2 >= r2) continue;
      const t = 1 - Math.sqrt(d2) / radius;
      const w = t * t * strength;
      const idx = py * width + px;
      mask[idx] = Math.min(1, mask[idx] + w * 0.15);
    }
  }
}

/**
 * Erase skin mask at (cx, cy)
 */
export function eraseSkinMask(
  mask: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
): void {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const d2 = (px - cx) ** 2 + (py - cy) ** 2;
      if (d2 < r2) mask[py * width + px] = 0;
    }
  }
}

/**
 * Apply skin smoothing: blend original with blurred using the mask.
 * smoothness: 0-100 controls blend strength
 * skinBrightness: 0-100 adds brightness only to masked region
 */
export function applySkinSmooth(
  imageData: ImageData,
  mask: Float32Array,
  smoothness: number,
  skinBrightness: number,
): ImageData {
  const { width, height } = imageData;
  const d = imageData.data;
  const blurRadius = Math.max(2, Math.round(smoothness * 0.12));
  const blurred = gaussianBlurRGBA(imageData, blurRadius);
  const bd = blurred.data;
  const blendStrength = smoothness / 100;
  const brightBoost = skinBrightness * 0.5;

  for (let i = 0; i < width * height; i++) {
    const m = mask[i];
    if (m === 0) continue;
    const blend = m * blendStrength;
    const bright = m * brightBoost;
    const p = i * 4;
    d[p]   = Math.min(255, d[p]   * (1 - blend) + bd[p]   * blend + bright);
    d[p+1] = Math.min(255, d[p+1] * (1 - blend) + bd[p+1] * blend + bright);
    d[p+2] = Math.min(255, d[p+2] * (1 - blend) + bd[p+2] * blend + bright);
  }

  return imageData;
}

/**
 * Apply privacy blur: heavy Gaussian blur where mask > 0
 */
export function applyPrivacyBlur(
  imageData: ImageData,
  mask: Float32Array,
): ImageData {
  const { width, height } = imageData;
  const d = imageData.data;
  const blurRadius = 14;
  const blurred = gaussianBlurRGBA(imageData, blurRadius);
  const bd = blurred.data;

  for (let i = 0; i < width * height; i++) {
    if (mask[i] < 0.1) continue;
    const p = i * 4;
    d[p]   = bd[p];
    d[p+1] = bd[p+1];
    d[p+2] = bd[p+2];
  }
  return imageData;
}
