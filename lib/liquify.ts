/** Liquify / Warp tool - displacement field operations */

export type LiquifyMode = 'push' | 'pull' | 'restore' | 'expand' | 'shrink';

/**
 * Add a warp stroke to the displacement field.
 * cx,cy = brush center (canvas coords)
 * dx,dy = drag delta (push mode only)
 */
export function addLiquifyStroke(
  dxField: Float32Array,
  dyField: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  radius: number,
  strength: number,
  mode: LiquifyMode,
): void {
  const r2 = radius * radius;
  const sigma2 = (radius / 2.5) ** 2;
  const s = strength / 100;

  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const d2 = (px - cx) ** 2 + (py - cy) ** 2;
      if (d2 >= r2) continue;

      const w = Math.exp(-d2 / (2 * sigma2)) * s;
      const idx = py * width + px;

      switch (mode) {
        case 'push':
          dxField[idx] += dx * w;
          dyField[idx] += dy * w;
          break;

        case 'pull': {
          // Pull pixels toward brush center
          const dist = Math.sqrt(d2) || 1;
          const nx = (cx - px) / dist;
          const ny = (cy - py) / dist;
          dxField[idx] += nx * radius * 0.08 * w;
          dyField[idx] += ny * radius * 0.08 * w;
          break;
        }

        case 'expand': {
          // Push pixels away from center
          const dist = Math.sqrt(d2) || 1;
          const nx = (px - cx) / dist;
          const ny = (py - cy) / dist;
          dxField[idx] += nx * radius * 0.08 * w;
          dyField[idx] += ny * radius * 0.08 * w;
          break;
        }

        case 'shrink': {
          // Pull pixels toward center
          const dist = Math.sqrt(d2) || 1;
          const nx = (cx - px) / dist;
          const ny = (cy - py) / dist;
          dxField[idx] += nx * radius * 0.08 * w;
          dyField[idx] += ny * radius * 0.08 * w;
          break;
        }

        case 'restore':
          dxField[idx] *= (1 - w);
          dyField[idx] *= (1 - w);
          break;
      }
    }
  }
}

/**
 * Apply displacement field to imageData.
 * For each output pixel (x,y), reads from source at (x+dx, y+dy).
 */
export function applyLiquify(
  imageData: ImageData,
  dxField: Float32Array,
  dyField: Float32Array,
): ImageData {
  const { width, height } = imageData;
  const src = imageData.data;
  const outData = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const sx = x + dxField[idx];
      const sy = y + dyField[idx];

      // Bilinear interpolation
      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const sx1 = sx0 + 1;
      const sy1 = sy0 + 1;
      const fx = sx - sx0;
      const fy = sy - sy0;

      const sx0c = sx0 < 0 ? 0 : sx0 >= width ? width - 1 : sx0;
      const sx1c = sx1 < 0 ? 0 : sx1 >= width ? width - 1 : sx1;
      const sy0c = sy0 < 0 ? 0 : sy0 >= height ? height - 1 : sy0;
      const sy1c = sy1 < 0 ? 0 : sy1 >= height ? height - 1 : sy1;

      const i00 = (sy0c * width + sx0c) * 4;
      const i10 = (sy0c * width + sx1c) * 4;
      const i01 = (sy1c * width + sx0c) * 4;
      const i11 = (sy1c * width + sx1c) * 4;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const oi = idx * 4;
      outData[oi]   = src[i00]   * w00 + src[i10]   * w10 + src[i01]   * w01 + src[i11]   * w11;
      outData[oi+1] = src[i00+1] * w00 + src[i10+1] * w10 + src[i01+1] * w01 + src[i11+1] * w11;
      outData[oi+2] = src[i00+2] * w00 + src[i10+2] * w10 + src[i01+2] * w01 + src[i11+2] * w11;
      outData[oi+3] = src[i00+3] * w00 + src[i10+3] * w10 + src[i01+3] * w01 + src[i11+3] * w11;
    }
  }

  return new ImageData(outData, width, height);
}

/**
 * Apply displacement field writing into a pre-allocated destination buffer.
 * Avoids creating a new Uint8ClampedArray per frame — use during active drag.
 */
export function applyLiquifyInto(
  srcData: Uint8ClampedArray,
  dstData: Uint8ClampedArray,
  dxField: Float32Array,
  dyField: Float32Array,
  width: number,
  height: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const sx = x + dxField[idx];
      const sy = y + dyField[idx];
      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const fx = sx - sx0;
      const fy = sy - sy0;

      const sx0c = sx0 < 0 ? 0 : sx0 >= width ? width - 1 : sx0;
      const sx1c = sx0 + 1 >= width ? width - 1 : sx0 + 1;
      const sy0c = sy0 < 0 ? 0 : sy0 >= height ? height - 1 : sy0;
      const sy1c = sy0 + 1 >= height ? height - 1 : sy0 + 1;

      const i00 = (sy0c * width + sx0c) * 4;
      const i10 = (sy0c * width + sx1c) * 4;
      const i01 = (sy1c * width + sx0c) * 4;
      const i11 = (sy1c * width + sx1c) * 4;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const oi = idx * 4;
      dstData[oi]   = srcData[i00]   * w00 + srcData[i10]   * w10 + srcData[i01]   * w01 + srcData[i11]   * w11;
      dstData[oi+1] = srcData[i00+1] * w00 + srcData[i10+1] * w10 + srcData[i01+1] * w01 + srcData[i11+1] * w11;
      dstData[oi+2] = srcData[i00+2] * w00 + srcData[i10+2] * w10 + srcData[i01+2] * w01 + srcData[i11+2] * w11;
      dstData[oi+3] = srcData[i00+3] * w00 + srcData[i10+3] * w10 + srcData[i01+3] * w01 + srcData[i11+3] * w11;
    }
  }
}

/** Check if the displacement field has any non-zero values */
export function hasDisplacement(dx: Float32Array | null): boolean {
  if (!dx) return false;
  for (let i = 0; i < dx.length; i++) {
    if (dx[i] !== 0) return true;
  }
  return false;
}

/** Reset displacement field to zero */
export function resetLiquify(
  dxField: Float32Array,
  dyField: Float32Array,
): void {
  dxField.fill(0);
  dyField.fill(0);
}
