import { EditorState, ExportSettings } from '@/types/editor';
import { renderAtOriginalResolution } from './renderFull';

/** Draw watermark text onto a canvas context */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ExportSettings,
): void {
  const { watermarkText, watermarkOpacity, watermarkPosition, watermarkSize } = settings;
  if (!watermarkText.trim()) return;

  ctx.save();
  ctx.globalAlpha = watermarkOpacity / 100;
  ctx.font = `bold ${watermarkSize}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;

  const padding = watermarkSize;
  const metrics = ctx.measureText(watermarkText);
  const tw = metrics.width;
  const th = watermarkSize;

  let x: number, y: number;
  switch (watermarkPosition) {
    case 'topLeft':     x = padding; y = padding + th; break;
    case 'topRight':    x = width - tw - padding; y = padding + th; break;
    case 'bottomLeft':  x = padding; y = height - padding; break;
    case 'center':      x = (width - tw) / 2; y = (height + th) / 2; break;
    case 'bottomRight':
    default:            x = width - tw - padding; y = height - padding; break;
  }

  ctx.strokeText(watermarkText, x, y);
  ctx.fillText(watermarkText, x, y);
  ctx.restore();
}

/**
 * Export at original image resolution.
 * Re-renders the full pipeline at the source image's native pixel dimensions.
 */
export async function exportImage(
  state: EditorState,
  settings: ExportSettings,
): Promise<void> {
  // Render at original resolution (may take a moment for large images)
  const sourceCanvas = renderAtOriginalResolution(state);

  let w = sourceCanvas.width;
  let h = sourceCanvas.height;

  // Resize if requested
  if (settings.resizeEnabled && settings.resizeWidth > 0 && settings.resizeHeight > 0) {
    const targetAr = settings.resizeWidth / settings.resizeHeight;
    const srcAr = w / h;
    if (srcAr > targetAr) {
      w = settings.resizeWidth;
      h = Math.round(w / srcAr);
    } else {
      h = settings.resizeHeight;
      w = Math.round(h * srcAr);
    }
  }

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = w;
  exportCanvas.height = h;
  const ctx = exportCanvas.getContext('2d')!;

  ctx.drawImage(sourceCanvas, 0, 0, w, h);

  if (settings.watermarkEnabled && settings.watermarkText) {
    drawWatermark(ctx, w, h, settings);
  }

  const mimeType = settings.format === 'png' ? 'image/png'
    : settings.format === 'webp' ? 'image/webp'
    : 'image/jpeg';
  const quality = settings.format === 'png' ? undefined : settings.quality;

  const dataUrl = exportCanvas.toDataURL(mimeType, quality);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `retouch_${Date.now()}.${settings.format}`;
  link.click();
}

/** Batch export: X/Twitter (1200×675), Fanclub (1080×1350), Instagram (1080×1080) */
export async function batchExport(
  state: EditorState,
  settings: ExportSettings,
): Promise<void> {
  // Render once at full resolution, then scale to each target
  const sourceCanvas = renderAtOriginalResolution(state);

  const presets = [
    { name: 'twitter',   w: 1200, h: 675  },
    { name: 'fanclub',   w: 1080, h: 1350 },
    { name: 'instagram', w: 1080, h: 1080 },
  ];

  for (const preset of presets) {
    const c = document.createElement('canvas');
    const srcAr = sourceCanvas.width / sourceCanvas.height;
    const tgtAr = preset.w / preset.h;

    let sw = sourceCanvas.width, sh = sourceCanvas.height;
    let sx = 0, sy = 0;

    if (srcAr > tgtAr) {
      sw = Math.round(sh * tgtAr);
      sx = Math.round((sourceCanvas.width - sw) / 2);
    } else {
      sh = Math.round(sw / tgtAr);
      sy = Math.round((sourceCanvas.height - sh) / 2);
    }

    c.width = preset.w;
    c.height = preset.h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, preset.w, preset.h);

    if (settings.watermarkEnabled && settings.watermarkText) {
      drawWatermark(ctx, preset.w, preset.h, settings);
    }

    const dataUrl = c.toDataURL('image/jpeg', settings.quality);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `retouch_${preset.name}_${Date.now()}.jpg`;
    link.click();
    await new Promise(r => setTimeout(r, 100));
  }
}
