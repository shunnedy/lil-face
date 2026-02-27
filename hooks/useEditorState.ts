'use client';
import { useCallback, useReducer, useRef } from 'react';
import {
  EditorState, ActiveTool, Adjustments, FaceAdjustments, SkinSettings,
  LiquifySettings, FilterPreset, ExportSettings, CropState,
  DEFAULT_ADJUSTMENTS, DEFAULT_FACE, DEFAULT_SKIN, DEFAULT_LIQUIFY, DEFAULT_EXPORT,
  FaceLandmark,
} from '@/types/editor';

type Action =
  | { type: 'SET_IMAGE'; image: HTMLImageElement; width: number; height: number; scale: number }
  | { type: 'SET_TOOL'; tool: ActiveTool }
  | { type: 'SET_ADJUSTMENT'; key: keyof Adjustments; value: number }
  | { type: 'SET_FACE'; key: keyof FaceAdjustments; value: number }
  | { type: 'SET_SKIN'; key: keyof SkinSettings; value: number }
  | { type: 'SET_LIQUIFY'; key: keyof LiquifySettings; value: number | string }
  | { type: 'SET_FILTER'; filter: FilterPreset }
  | { type: 'SET_EXPORT'; key: keyof ExportSettings; value: unknown }
  | { type: 'SET_LANDMARKS'; landmarks: FaceLandmark[] | null }
  | { type: 'SET_FACE_DETECTING'; value: boolean }
  | { type: 'SET_LIQUIFY_FIELD'; dx: Float32Array; dy: Float32Array }
  | { type: 'SET_SKIN_MASK'; mask: Float32Array }
  | { type: 'SET_PRIVACY_MASK'; mask: Float32Array }
  | { type: 'SET_SHOW_ORIGINAL'; value: boolean }
  | { type: 'SET_CROP'; crop: Partial<CropState> }
  | { type: 'RESET_ADJUSTMENTS' }
  | { type: 'RESET_FACE' }
  | { type: 'RESET_LIQUIFY' }
  | { type: 'RESET_SKIN_MASK' }
  | { type: 'FORCE_RENDER' };

const initialState: EditorState = {
  originalImage: null,
  imageWidth: 0,
  imageHeight: 0,
  displayScale: 1,

  activeTool: 'select',

  adjustments: DEFAULT_ADJUSTMENTS,
  faceAdjustments: DEFAULT_FACE,
  skinSettings: DEFAULT_SKIN,
  liquifySettings: DEFAULT_LIQUIFY,
  exportSettings: DEFAULT_EXPORT,

  liquifyDX: null,
  liquifyDY: null,
  skinMask: null,
  privacyMask: null,

  activeFilter: 'none',

  landmarks: null,
  faceDetecting: false,
  faceDetected: false,

  cropState: { active: false, ratio: '1:1', x: 0, y: 0, w: 0, h: 0 },
  showOriginal: false,
  renderVersion: 0,
};

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'SET_IMAGE': {
      const w = action.width;
      const h = action.height;
      return {
        ...state,
        originalImage: action.image,
        imageWidth: w,
        imageHeight: h,
        displayScale: action.scale,
        liquifyDX: new Float32Array(Math.round(w * action.scale) * Math.round(h * action.scale)),
        liquifyDY: new Float32Array(Math.round(w * action.scale) * Math.round(h * action.scale)),
        skinMask: new Float32Array(Math.round(w * action.scale) * Math.round(h * action.scale)),
        privacyMask: new Float32Array(Math.round(w * action.scale) * Math.round(h * action.scale)),
        landmarks: null,
        faceDetected: false,
        renderVersion: state.renderVersion + 1,
      };
    }
    case 'SET_TOOL':
      return { ...state, activeTool: action.tool };
    case 'SET_ADJUSTMENT':
      return { ...state, adjustments: { ...state.adjustments, [action.key]: action.value }, renderVersion: state.renderVersion + 1 };
    case 'SET_FACE':
      return { ...state, faceAdjustments: { ...state.faceAdjustments, [action.key]: action.value }, renderVersion: state.renderVersion + 1 };
    case 'SET_SKIN':
      return { ...state, skinSettings: { ...state.skinSettings, [action.key]: action.value } };
    case 'SET_LIQUIFY':
      return { ...state, liquifySettings: { ...state.liquifySettings, [action.key]: action.value } };
    case 'SET_FILTER':
      return { ...state, activeFilter: action.filter, renderVersion: state.renderVersion + 1 };
    case 'SET_EXPORT':
      return { ...state, exportSettings: { ...state.exportSettings, [action.key]: action.value } };
    case 'SET_LANDMARKS':
      return { ...state, landmarks: action.landmarks, faceDetected: action.landmarks !== null, faceDetecting: false };
    case 'SET_FACE_DETECTING':
      return { ...state, faceDetecting: action.value };
    case 'SET_LIQUIFY_FIELD':
      return { ...state, liquifyDX: action.dx, liquifyDY: action.dy, renderVersion: state.renderVersion + 1 };
    case 'SET_SKIN_MASK':
      return { ...state, skinMask: action.mask, renderVersion: state.renderVersion + 1 };
    case 'SET_PRIVACY_MASK':
      return { ...state, privacyMask: action.mask, renderVersion: state.renderVersion + 1 };
    case 'SET_SHOW_ORIGINAL':
      return { ...state, showOriginal: action.value };
    case 'SET_CROP':
      return { ...state, cropState: { ...state.cropState, ...action.crop } };
    case 'RESET_ADJUSTMENTS':
      return { ...state, adjustments: DEFAULT_ADJUSTMENTS, renderVersion: state.renderVersion + 1 };
    case 'RESET_FACE':
      return { ...state, faceAdjustments: DEFAULT_FACE, renderVersion: state.renderVersion + 1 };
    case 'RESET_LIQUIFY':
      return {
        ...state,
        liquifyDX: state.liquifyDX ? new Float32Array(state.liquifyDX.length) : null,
        liquifyDY: state.liquifyDY ? new Float32Array(state.liquifyDY.length) : null,
        renderVersion: state.renderVersion + 1,
      };
    case 'RESET_SKIN_MASK':
      return {
        ...state,
        skinMask: state.skinMask ? new Float32Array(state.skinMask.length) : null,
        renderVersion: state.renderVersion + 1,
      };
    case 'FORCE_RENDER':
      return { ...state, renderVersion: state.renderVersion + 1 };
    default:
      return state;
  }
}

export function useEditorState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setImage = useCallback((image: HTMLImageElement, displayW: number, displayH: number) => {
    const scale = displayW / image.naturalWidth;
    dispatch({ type: 'SET_IMAGE', image, width: image.naturalWidth, height: image.naturalHeight, scale });
  }, []);

  const setTool = useCallback((tool: ActiveTool) => dispatch({ type: 'SET_TOOL', tool }), []);

  const setAdjustment = useCallback((key: keyof Adjustments, value: number) =>
    dispatch({ type: 'SET_ADJUSTMENT', key, value }), []);

  const setFace = useCallback((key: keyof FaceAdjustments, value: number) =>
    dispatch({ type: 'SET_FACE', key, value }), []);

  const setSkin = useCallback((key: keyof SkinSettings, value: number) =>
    dispatch({ type: 'SET_SKIN', key, value }), []);

  const setLiquify = useCallback((key: keyof LiquifySettings, value: number | string) =>
    dispatch({ type: 'SET_LIQUIFY', key, value }), []);

  const setFilter = useCallback((filter: FilterPreset) =>
    dispatch({ type: 'SET_FILTER', filter }), []);

  const setExport = useCallback((key: keyof ExportSettings, value: unknown) =>
    dispatch({ type: 'SET_EXPORT', key, value }), []);

  const setLandmarks = useCallback((landmarks: FaceLandmark[] | null) =>
    dispatch({ type: 'SET_LANDMARKS', landmarks }), []);

  const setFaceDetecting = useCallback((value: boolean) =>
    dispatch({ type: 'SET_FACE_DETECTING', value }), []);

  const updateLiquifyField = useCallback((dx: Float32Array, dy: Float32Array) =>
    dispatch({ type: 'SET_LIQUIFY_FIELD', dx, dy }), []);

  const updateSkinMask = useCallback((mask: Float32Array) =>
    dispatch({ type: 'SET_SKIN_MASK', mask }), []);

  const updatePrivacyMask = useCallback((mask: Float32Array) =>
    dispatch({ type: 'SET_PRIVACY_MASK', mask }), []);

  const setShowOriginal = useCallback((value: boolean) =>
    dispatch({ type: 'SET_SHOW_ORIGINAL', value }), []);

  const resetAdjustments = useCallback(() => dispatch({ type: 'RESET_ADJUSTMENTS' }), []);
  const resetFace = useCallback(() => dispatch({ type: 'RESET_FACE' }), []);
  const resetLiquify = useCallback(() => dispatch({ type: 'RESET_LIQUIFY' }), []);
  const resetSkinMask = useCallback(() => dispatch({ type: 'RESET_SKIN_MASK' }), []);
  const forceRender = useCallback(() => dispatch({ type: 'FORCE_RENDER' }), []);

  return {
    state,
    setImage,
    setTool,
    setAdjustment,
    setFace,
    setSkin,
    setLiquify,
    setFilter,
    setExport,
    setLandmarks,
    setFaceDetecting,
    updateLiquifyField,
    updateSkinMask,
    updatePrivacyMask,
    setShowOriginal,
    resetAdjustments,
    resetFace,
    resetLiquify,
    resetSkinMask,
    forceRender,
  };
}
