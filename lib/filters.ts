import { FilterPreset } from '@/types/editor';

interface FilterDef {
  label: string;
  emoji: string;
  description: string;
  apply: (d: Uint8ClampedArray, width: number, height: number) => void;
}

export const FILTER_DEFS: Record<FilterPreset, FilterDef> = {
  none: { label: 'なし', emoji: '⬜', description: 'フィルターなし', apply: () => {} },

  clear: {
    label: '透明感', emoji: '✨', description: '透き通るような肌感',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        // Slightly brighten + cool + boost saturation of skin tones
        d[i]   = Math.min(255, d[i]   * 1.04 + 6);
        d[i+1] = Math.min(255, d[i+1] * 1.04 + 4);
        d[i+2] = Math.min(255, d[i+2] * 1.08 + 8);
      }
    },
  },

  soft: {
    label: 'ソフト', emoji: '🌸', description: '柔らかく優しい雰囲気',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        // Desaturate slightly, add warmth
        d[i]   = Math.min(255, (gray + 1.1 * (r - gray)) * 1.03 + 8);
        d[i+1] = Math.min(255, (gray + 1.1 * (g - gray)) + 3);
        d[i+2] = Math.min(255, (gray + 0.9 * (b - gray)) - 2);
      }
    },
  },

  film: {
    label: 'フィルム', emoji: '🎞️', description: 'アナログフィルム風',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        // Lifted shadows, faded highlights, slight green-yellow
        const liftR = Math.max(20, r * 0.9 + 15);
        const liftG = Math.max(20, g * 0.88 + 18);
        const liftB = Math.max(20, b * 0.82 + 12);
        // Add grain
        const grain = (Math.random() - 0.5) * 8;
        d[i]   = Math.min(255, Math.max(0, liftR + grain));
        d[i+1] = Math.min(255, Math.max(0, liftG + grain));
        d[i+2] = Math.min(255, Math.max(0, liftB + grain));
      }
    },
  },

  vivid: {
    label: 'ビビッド', emoji: '🔆', description: '鮮やかで目を引く',
    apply(d) {
      const contrastF = (259 * (40 + 255)) / (255 * (259 - 40));
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        let nr = gray + 1.4 * (r - gray);
        let ng = gray + 1.4 * (g - gray);
        let nb = gray + 1.4 * (b - gray);
        nr = contrastF * (nr - 128) + 128;
        ng = contrastF * (ng - 128) + 128;
        nb = contrastF * (nb - 128) + 128;
        d[i]   = nr < 0 ? 0 : nr > 255 ? 255 : nr;
        d[i+1] = ng < 0 ? 0 : ng > 255 ? 255 : ng;
        d[i+2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
      }
    },
  },

  matte: {
    label: 'マット', emoji: '🤍', description: 'マットでおしゃれな質感',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        // Lift shadows, pull highlights, desaturate
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const sr = gray + 0.85 * (r - gray);
        const sg = gray + 0.85 * (g - gray);
        const sb = gray + 0.85 * (b - gray);
        // Compression (lifted blacks, lowered whites)
        d[i]   = Math.min(240, Math.max(20, sr * 0.88 + 20));
        d[i+1] = Math.min(240, Math.max(20, sg * 0.88 + 20));
        d[i+2] = Math.min(240, Math.max(20, sb * 0.88 + 20));
      }
    },
  },

  warm: {
    label: 'ウォーム', emoji: '🌅', description: '暖かみのある夕陽色',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        d[i]   = Math.min(255, d[i]   * 1.08 + 12);
        d[i+1] = Math.min(255, d[i+1] * 1.02 + 4);
        d[i+2] = Math.max(0,   d[i+2] * 0.88 - 8);
      }
    },
  },

  cool: {
    label: 'クール', emoji: '❄️', description: 'クールで凛とした青み',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        d[i]   = Math.max(0,   d[i]   * 0.9  - 6);
        d[i+1] = Math.min(255, d[i+1] * 1.01 + 2);
        d[i+2] = Math.min(255, d[i+2] * 1.12 + 14);
      }
    },
  },

  bw: {
    label: 'モノクロ', emoji: '🖤', description: 'モノクロームポートレート',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        const gray = Math.round(0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]);
        // Slightly boost contrast for dramatic BW
        const g = Math.min(255, Math.max(0, (gray - 128) * 1.1 + 128));
        d[i] = g; d[i+1] = g; d[i+2] = g;
      }
    },
  },

  portrait: {
    label: 'ポートレート', emoji: '💄', description: 'グラビア向け美肌特化',
    apply(d) {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        // Warm skin tone enhancement, subtle glow
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const highlightMask = (lum / 255) ** 1.5;
        const glow = highlightMask * 10;
        d[i]   = Math.min(255, r * 1.04 + glow + 5);
        d[i+1] = Math.min(255, g * 1.02 + glow + 2);
        d[i+2] = Math.min(255, b * 0.97 + glow - 2);
      }
    },
  },
};

export function applyFilter(imageData: ImageData, filter: FilterPreset): ImageData {
  const def = FILTER_DEFS[filter];
  if (def && filter !== 'none') {
    def.apply(imageData.data, imageData.width, imageData.height);
  }
  return imageData;
}

export const FILTER_LIST: FilterPreset[] = [
  'none', 'clear', 'portrait', 'soft', 'film', 'vivid', 'matte', 'warm', 'cool', 'bw',
];
