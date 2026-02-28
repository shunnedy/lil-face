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
  // 輪郭
  smallFace: number;     // 0 to 100
  slimJaw: number;       // 0 to 100
  chinLength: number;    // -50 to 50
  jawlineSmooth: number; // 0 to 100
  midFaceShorten: number; // 0 to 100
  headSize: number;       // -50 to 50
  hairlineHeight: number; // -50 to 50 (+ = raise / wider forehead)
  // 目
  eyeSize: number;        // 0 to 100
  eyeWidth: number;       // -50 to 50
  eyeHeight: number;      // -50 to 50 (move up/down)
  eyeVertical: number;    // -50 to 50 (vertical size)
  eyeSpacing: number;     // -50 to 50 (distance between eyes)
  eyeUpperBulge: number;  // 0 to 100  (upper eyelid prominence)
  eyeLowerExpand: number; // 0 to 100  (lower eyelid expansion)
  eyeTilt: number;        // -50 to 50 (+ = cat eye / - = droopy)
  // 鼻
  noseSlim: number;       // 0 to 100  (wing width)
  noseTip: number;        // -50 to 50 (raise/lower tip)
  noseRootWidth: number;  // -50 to 50 (root/bridge-top width)
  noseBridgeWidth: number;// -50 to 50 (mid-bridge width)
  noseTipWidth: number;   // -50 to 50 (nose tip width)
  // 唇・口
  lipThickness: number;   // -50 to 50
  mouthCorner: number;    // -50 to 50
  mouthWidth: number;     // -50 to 50
  mouthHeight: number;    // -50 to 50 (move up/down)
  mouthShift: number;     // -50 to 50 (move left/right)
  mLip: number;           // 0 to 100  (M-shaped Cupid's bow)
  // 眉毛
  eyebrowHeight: number;      // -50 to 50
  eyebrowThickness: number;   // -50 to 50
  eyebrowLength: number;      // -50 to 50
  eyebrowTailLength: number;  // -50 to 50
  eyebrowHeadLength: number;  // -50 to 50
  eyebrowTilt: number;        // -50 to 50 (outer up = angled)
  eyebrowPeakHeight: number;  // -50 to 50
}

export interface BodyAnchors {
  chest: { x: number; y: number } | null;
  leftThigh: { x: number; y: number } | null;
  rightThigh: { x: number; y: number } | null;
}

export interface BodyAdjustments {
  chestSize: number;       // -50 to 50 (larger / smaller)
  thighSize: number;       // -50 to 50 (both thighs together)
  leftThighSize: number;   // -50 to 50 (left thigh independent)
  rightThighSize: number;  // -50 to 50 (right thigh independent)
}

export interface SkinSettings {
  smoothness: number;      // 0 to 100
  skinBrightness: number;  // 0 to 100
  brushSize: number;       // 10 to 200
}

export interface LiquifySettings {
  size: number;                // 20 to 300
  strength: number;            // 1 to 100
  mode: 'push' | 'pull' | 'restore' | 'expand' | 'shrink';
  texturePreservation: number; // 0 to 100 (0=normal warp, 100=pattern stays)
}

export type ActiveTool =
  | 'select'
  | 'liquify'
  | 'skinBrush'
  | 'spotHeal'
  | 'privacyBlur'
  | 'crop'
  | 'placeChest'
  | 'placeLeftThigh'
  | 'placeRightThigh';

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
  bodyAdjustments: BodyAdjustments;
  bodyAnchors: BodyAnchors;
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
  smallFace: 0, slimJaw: 0, chinLength: 0, jawlineSmooth: 0,
  midFaceShorten: 0, headSize: 0, hairlineHeight: 0,
  eyeSize: 0, eyeWidth: 0, eyeHeight: 0, eyeVertical: 0,
  eyeSpacing: 0, eyeUpperBulge: 0, eyeLowerExpand: 0, eyeTilt: 0,
  noseSlim: 0, noseTip: 0, noseRootWidth: 0, noseBridgeWidth: 0, noseTipWidth: 0,
  lipThickness: 0, mouthCorner: 0, mouthWidth: 0,
  mouthHeight: 0, mouthShift: 0, mLip: 0,
  eyebrowHeight: 0, eyebrowThickness: 0, eyebrowLength: 0,
  eyebrowTailLength: 0, eyebrowHeadLength: 0, eyebrowTilt: 0, eyebrowPeakHeight: 0,
};

export const DEFAULT_BODY_ADJ: BodyAdjustments = {
  chestSize: 0,
  thighSize: 0,
  leftThighSize: 0,
  rightThighSize: 0,
};

export const DEFAULT_BODY_ANCHORS: BodyAnchors = {
  chest: null,
  leftThigh: null,
  rightThigh: null,
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
  texturePreservation: 0,
};

export const DEFAULT_EXPORT: ExportSettings = {
  format: 'jpeg',
  quality: 1.0,
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
