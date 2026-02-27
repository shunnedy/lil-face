export interface Adjustments {
  brightness: number;    // -100 to 100
  contrast: number;      // -100 to 100
  saturation: number;    // -100 to 100
  warmth: number;        // -100 to 100
  exposure: number;      // -2 to 2 (EV stops)
  shadows: number;       // -100 to 100
  highlights: number;    // -100 to 100
  clarity: number;       // 0 to 100
  sharpness: number;     // 0 to 100
  vignette: number;      // 0 to 100
}

export interface FaceAdjustments {
  smallFace: number;     // 0 to 100  (slim overall face)
  slimJaw: number;       // 0 to 100  (slim lower jaw/cheek)
  chinLength: number;    // -50 to 50 (chin longer/shorter)
  eyeSize: number;       // 0 to 100  (enlarge eyes)
  eyeWidth: number;      // -50 to 50 (widen/narrow eyes)
  noseSlim: number;      // 0 to 100  (slim nose wings)
  noseTip: number;       // -50 to 50 (raise/lower nose tip)
  lipThickness: number;  // -50 to 50 (thicker/thinner lips)
  mouthCorner: number;   // -50 to 50 (lift/drop corners)
}

export interface SkinSettings {
  smoothness: number;      // 0 to 100
  skinBrightness: number;  // 0 to 100
  brushSize: number;       // 10 to 200
}

export interface LiquifySettings {
  size: number;     // 20 to 300
  strength: number; // 1 to 100
  mode: 'push' | 'pull' | 'restore' | 'expand' | 'shrink';
}

export type ActiveTool =
  | 'select'
  | 'liquify'
  | 'skinBrush'
  | 'spotHeal'
  | 'privacyBlur'
  | 'crop';

export type FilterPreset =
  | 'none'
  | 'clear'
  | 'soft'
  | 'film'
  | 'vivid'
  | 'matte'
  | 'warm'
  | 'cool'
  | 'bw'
  | 'portrait';

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
  name?: string;
}

export type WatermarkPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';

export interface ExportSettings {
  format: 'png' | 'jpeg' | 'webp';
  quality: number;           // 0.1 to 1.0 (jpeg/webp)
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkOpacity: number;  // 0 to 100
  watermarkPosition: WatermarkPosition;
  watermarkSize: number;     // 8 to 72
  removeExif: boolean;
  resizeEnabled: boolean;
  resizeWidth: number;
  resizeHeight: number;
}

export interface CropState {
  active: boolean;
  ratio: '1:1' | '4:5' | '9:16' | '16:9' | '3:4' | '4:3' | 'free';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EditorState {
  originalImage: HTMLImageElement | null;
  imageWidth: number;
  imageHeight: number;
  displayScale: number;

  activeTool: ActiveTool;

  adjustments: Adjustments;
  faceAdjustments: FaceAdjustments;
  skinSettings: SkinSettings;
  liquifySettings: LiquifySettings;
  exportSettings: ExportSettings;

  // Pixel buffers (at display resolution)
  liquifyDX: Float32Array | null;
  liquifyDY: Float32Array | null;
  skinMask: Float32Array | null;
  privacyMask: Float32Array | null;

  activeFilter: FilterPreset;

  landmarks: FaceLandmark[] | null;
  faceDetecting: boolean;
  faceDetected: boolean;

  cropState: CropState;
  showOriginal: boolean;
  renderVersion: number;   // increment to force re-render
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  exposure: 0,
  shadows: 0,
  highlights: 0,
  clarity: 0,
  sharpness: 0,
  vignette: 0,
};

export const DEFAULT_FACE: FaceAdjustments = {
  smallFace: 0,
  slimJaw: 0,
  chinLength: 0,
  eyeSize: 0,
  eyeWidth: 0,
  noseSlim: 0,
  noseTip: 0,
  lipThickness: 0,
  mouthCorner: 0,
};

export const DEFAULT_SKIN: SkinSettings = {
  smoothness: 50,
  skinBrightness: 0,
  brushSize: 60,
};

export const DEFAULT_LIQUIFY: LiquifySettings = {
  size: 80,
  strength: 50,
  mode: 'push',
};

export const DEFAULT_EXPORT: ExportSettings = {
  format: 'jpeg',
  quality: 0.92,
  watermarkEnabled: false,
  watermarkText: '',
  watermarkOpacity: 40,
  watermarkPosition: 'bottomRight',
  watermarkSize: 18,
  removeExif: true,
  resizeEnabled: false,
  resizeWidth: 1080,
  resizeHeight: 1350,
};
