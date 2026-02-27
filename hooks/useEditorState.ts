'use client';
import { useCallback, useReducer, useRef, useState } from 'react';
import {
  EditorState, ActiveTool, Adjustments, FaceAdjustments, BodyAdjustments, BodyAnchors,
  SkinSettings, LiquifySettings, FilterPreset, ExportSettings, CropState,
  DEFAULT_ADJUSTMENTS, DEFAULT_FACE, DEFAULT_BODY_ADJ, DEFAULT_BODY_ANCHORS,
  DEFAULT_SKIN, DEFAULT_LIQUIFY, DEFAULT_EXPORT,
  FaceLandmark,
} from '@/types/editor';

export interface HistorySnapshot {
  adjustments: Adjustments;
  faceAdjustments: FaceAdjustments;
  bodyAdjustments: BodyAdjustments;
  bodyAnchors: BodyAnchors;
  activeFilter: FilterPreset;
  liquifyDX: Float32Array | null;
  liquifyDY: Float32Array | null;
  skinMask: Float32Array | null;
  privacyMask: Float32Array | null;
}

type Action =
  | { type: 'SET_IMAGE'; image: HTMLImageElement; width: number; height: number; scale: number }
  | { type: 'SET_TOOL'; tool: ActiveTool }
  | { type: 'SET_ADJUSTMENT'; key: keyof Adjustments; value: number }
  | { type: 'SET_FACE'; key: keyof FaceAdjustments; value: number }
  | { type: 'SET_BODY_ADJ'; key: keyof BodyAdjustments; value: number }
  | { type: 'SET_BODY_ANCHOR'; key: keyof BodyAnchors; value: { x: number; y: number } | null }
  | { type: 'RESET_BODY_ADJ' }
  | { type: 'RESET_BODY_ANCHORS' }
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
  | { type: 'APPLY_SNAPSHOT'; snapshot: HistorySnapshot }
  | { type: 'FORCE_RENDER' };

const initialState: EditorState = {
  originalImage: null,
  imageWidth: 0,
  imageHeight: 0,
  displayScale: 1,

  activeTool: 'select',

  adjustments: DEFAULT_ADJUSTMENTS,
  faceAdjustments: DEFAULT_FACE,
  bodyAdjustments: DEFAULT_BODY_ADJ,
  bodyAnchors: DEFAULT_BODY_ANCHORS,
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
    case 'SET_BODY_ADJ':
      return { ...state, bodyAdjustments: { ...state.bodyAdjustments, [action.key]: action.value }, renderVersion: state.renderVersion + 1 };
    case 'SET_BODY_ANCHOR':
      return { ...state, bodyAnchors: { ...state.bodyAnchors, [action.key]: action.value }, renderVersion: state.renderVersion + 1 };
    case 'RESET_BODY_ADJ':
      return { ...state, bodyAdjustments: DEFAULT_BODY_ADJ, renderVersion: state.renderVersion + 1 };
    case 'RESET_BODY_ANCHORS':
      return { ...state, bodyAnchors: DEFAULT_BODY_ANCHORS, renderVersion: state.renderVersion + 1 };
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
    case 'APPLY_SNAPSHOT': {
      const s = action.snapshot;
      return {
        ...state,
        adjustments: s.adjustments,
        faceAdjustments: s.faceAdjustments,
        bodyAdjustments: s.bodyAdjustments,
        bodyAnchors: s.bodyAnchors,
        activeFilter: s.activeFilter,
        liquifyDX: s.liquifyDX,
        liquifyDY: s.liquifyDY,
        skinMask: s.skinMask,
        privacyMask: s.privacyMask,
        renderVersion: state.renderVersion + 1,
      };
    }
    case 'FORCE_RENDER':
      return { ...state, renderVersion: state.renderVersion + 1 };
    default:
      return state;
  }
}

export function useEditorState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // --- History ---
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIdxRef = useRef(-1);
  const [historyMeta, setHistoryMeta] = useState({ idx: -1, len: 0 });

  const canUndo = historyMeta.idx > 0;
  const canRedo = historyMeta.idx < historyMeta.len - 1;

  const initHistory = useCallback((snapshot: HistorySnapshot) => {
    historyRef.current = [snapshot];
    historyIdxRef.current = 0;
    setHistoryMeta({ idx: 0, len: 1 });
  }, []);

  const pushHistory = useCallback((snapshot: HistorySnapshot) => {
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 30) {
      historyRef.current = historyRef.current.slice(-30);
    }
    historyIdxRef.current = historyRef.current.length - 1;
    setHistoryMeta({ idx: historyIdxRef.current, len: historyRef.current.length });
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    setHistoryMeta({ idx: historyIdxRef.current, len: historyRef.current.length });
    dispatch({ type: 'APPLY_SNAPSHOT', snapshot: historyRef.current[historyIdxRef.current] });
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    setHistoryMeta({ idx: historyIdxRef.current, len: historyRef.current.length });
    dispatch({ type: 'APPLY_SNAPSHOT', snapshot: historyRef.current[historyIdxRef.current] });
  }, []);

  // --- State setters ---
  const setImage = useCallback((image: HTMLImageElement, displayW: number, displayH: number) => {
    const scale = displayW / image.naturalWidth;
    dispatch({ type: 'SET_IMAGE', image, width: image.naturalWidth, height: image.naturalHeight, scale });
  }, []);

  const setTool = useCallback((tool: ActiveTool) => dispatch({ type: 'SET_TOOL', tool }), []);

  const setAdjustment = useCallback((key: keyof Adjustments, value: number) =>
    dispatch({ type: 'SET_ADJUSTMENT', key, value }), []);

  const setFace = useCallback((key: keyof FaceAdjustments, value: number) =>
    dispatch({ type: 'SET_FACE', key, value }), []);

  const setBodyAdj = useCallback((key: keyof BodyAdjustments, value: number) =>
    dispatch({ type: 'SET_BODY_ADJ', key, value }), []);

  const setBodyAnchor = useCallback((key: keyof BodyAnchors, value: { x: number; y: number } | null) =>
    dispatch({ type: 'SET_BODY_ANCHOR', key, value }), []);

  const resetBodyAdj = useCallback(() => dispatch({ type: 'RESET_BODY_ADJ' }), []);
  const resetBodyAnchors = useCallback(() => dispatch({ type: 'RESET_BODY_ANCHORS' }), []);

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
    setBodyAdj,
    setBodyAnchor,
    resetBodyAdj,
    resetBodyAnchors,
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
    // History
    canUndo,
    canRedo,
    initHistory,
    pushHistory,
    undo,
    redo,
  };
}
