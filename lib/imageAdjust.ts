import { Adjustments } from '@/types/editor';

/** Apply all color/tone adjustments to ImageData in-place. Returns the same ImageData. */
export function applyColorAdjustments(imageData: ImageData, adj: Adjustments): ImageData {
  const d = imageData.data;
  const n = d.length;

  const brightAdd = adj.brightness * 2.55;
  const contrastF = adj.contrast !== 0
    ? (259 * (adj.contrast + 255)) / (255 * (259 - adj.contrast))
    : 1;
  const satF = adj.saturation / 100 + 1;
  const warmR = adj.warmth * 0.8;
  const warmB = -adj.warmth * 0.8;
  const expF = Math.pow(2, adj.exposure);
  const shadowStrength = adj.shadows * 0.5;
  const highlightStrength = adj.highlights * 0.5;

  for (let i = 0; i < n; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // Exposure
    if (adj.exposure !== 0) {
      r *= expF; g *= expF; b *= expF;
    }

    // Brightness
    if (brightAdd !== 0) {
      r += brightAdd; g += brightAdd; b += brightAdd;
    }

    // Contrast
    if (contrastF !== 1) {
      r = contrastF * (r - 128) + 128;
      g = contrastF * (g - 128) + 128;
      b = contrastF * (b - 128) + 128;
    }

    // Warmth
    if (warmR !== 0) {
      r += warmR; b += warmB;
    }

    // Saturation
    if (satF !== 1) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + satF * (r - gray);
      g = gray + satF * (g - gray);
      b = gray + satF * (b - gray);
    }

    // Shadows (boost dark areas)
    if (shadowStrength !== 0) {
      const lum = (r + g + b) / 765; // 0-1
      const mask = Math.pow(1 - lum, 2);
      const boost = shadowStrength * mask;
      r += boost; g += boost; b += boost;
    }

    // Highlights (adjust bright areas)
    if (highlightStrength !== 0) {
      const lum = (r + g + b) / 765;
      const mask = Math.pow(lum, 2);
      const boost = highlightStrength * mask;
      r += boost; g += boost; b += boost;
    }

    d[i]   = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i+1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i+2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }

  // Clarity: local contrast enhancement via unsharp mask approximation
  if (adj.clarity > 0) {
    applyClarity(imageData, adj.clarity);
  }

  // Sharpness: unsharp mask
  if (adj.sharpness > 0) {
    applySharpen(imageData, adj.sharpness);
  }

  return imageData;
}

function applyClarity(imageData: ImageData, amount: number): void {
  const { width } = imageData;
  const d = imageData.data;
  // Use a moderate-radius blur to simulate clarity
  const blurred = gaussianBlurRGBA(imageData, Math.round(width * 0.02 + 4));
  const bd = blurred.data;
  const f = amount * 0.015;

  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = d[i+c] - bd[i+c];
      const v = d[i+c] + diff * f;
      d[i+c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
}

function applySharpen(imageData: ImageData, amount: number): void {
  void imageData.width;
  const d = imageData.data;
  const blurred = gaussianBlurRGBA(imageData, 1);
  const bd = blurred.data;
  const f = amount * 0.008;

  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = d[i+c] - bd[i+c];
      const v = d[i+c] + diff * f;
      d[i+c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
}

/** Simple separable Gaussian blur */
export function gaussianBlurRGBA(imageData: ImageData, radius: number): ImageData {
  if (radius < 1) return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

  const { width, height } = imageData;
  const src = imageData.data;
  const tmp = new Float32Array(width * height * 4);
  const out = new Uint8ClampedArray(width * height * 4);

  const sigma = radius / 3;
  const size = Math.round(sigma * 3) * 2 + 1;
  const kernel: number[] = [];
  let ksum = 0;
  const half = Math.floor(size / 2);
  for (let k = 0; k < size; k++) {
    const x = k - half;
    const v = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(v);
    ksum += v;
  }
  for (let k = 0; k < size; k++) kernel[k] /= ksum;

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < size; k++) {
        const sx = Math.max(0, Math.min(width - 1, x + k - half));
        const idx = (y * width + sx) * 4;
        r += src[idx]   * kernel[k];
        g += src[idx+1] * kernel[k];
        b += src[idx+2] * kernel[k];
        a += src[idx+3] * kernel[k];
      }
      const idx = (y * width + x) * 4;
      tmp[idx]=r; tmp[idx+1]=g; tmp[idx+2]=b; tmp[idx+3]=a;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < size; k++) {
        const sy = Math.max(0, Math.min(height - 1, y + k - half));
        const idx = (sy * width + x) * 4;
        r += tmp[idx]   * kernel[k];
        g += tmp[idx+1] * kernel[k];
        b += tmp[idx+2] * kernel[k];
        a += tmp[idx+3] * kernel[k];
      }
      const idx = (y * width + x) * 4;
      out[idx]   = r < 0 ? 0 : r > 255 ? 255 : r;
      out[idx+1] = g < 0 ? 0 : g > 255 ? 255 : g;
      out[idx+2] = b < 0 ? 0 : b > 255 ? 255 : b;
      out[idx+3] = a < 0 ? 0 : a > 255 ? 255 : a;
    }
  }

  return new ImageData(out, width, height);
}

/** Draw a vignette gradient overlay on a canvas context */
export function applyVignetteOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number, // 0-100
): void {
  const strength = amount / 100;
  const cx = width / 2, cy = height / 2;
  const r = Math.sqrt(cx * cx + cy * cy);
  const gradient = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.1);
  gradient.addColorStop(0, `rgba(0,0,0,0)`);
  gradient.addColorStop(1, `rgba(0,0,0,${(strength * 0.75).toFixed(3)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
