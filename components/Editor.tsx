'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useEditorState, HistorySnapshot } from '@/hooks/useEditorState';
import { DEFAULT_ADJUSTMENTS, DEFAULT_FACE, DEFAULT_BODY_ADJ, DEFAULT_BODY_ANCHORS } from '@/types/editor';
import TopBar from './TopBar';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import EditorCanvas from './EditorCanvas';
import { detectFaceLandmarks } from '@/lib/faceDetect';
import { exportImage, batchExport } from '@/lib/exportImage';

export default function Editor() {
  const {
    state, setImage, setTool, setAdjustment, setFace, setSkin, setLiquify,
    setFilter, setExport, setLandmarks, setFaceDetecting,
    updateLiquifyField, updateSkinMask, updatePrivacyMask,
    setShowOriginal, resetAdjustments, resetFace, resetLiquify, resetSkinMask,
    setBodyAdj, setBodyAnchor, resetBodyAdj,
    canUndo, canRedo, initHistory, pushHistory, undo, redo,
  } = useEditorState();

  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Build a snapshot from current state
  const buildSnapshot = useCallback((): HistorySnapshot => ({
    adjustments: stateRef.current.adjustments,
    faceAdjustments: stateRef.current.faceAdjustments,
    bodyAdjustments: stateRef.current.bodyAdjustments,
    bodyAnchors: stateRef.current.bodyAnchors,
    activeFilter: stateRef.current.activeFilter,
    liquifyDX: stateRef.current.liquifyDX ? new Float32Array(stateRef.current.liquifyDX) : null,
    liquifyDY: stateRef.current.liquifyDY ? new Float32Array(stateRef.current.liquifyDY) : null,
    skinMask: stateRef.current.skinMask ? new Float32Array(stateRef.current.skinMask) : null,
    privacyMask: stateRef.current.privacyMask ? new Float32Array(stateRef.current.privacyMask) : null,
  }), []);

  const handlePushHistory = useCallback(() => {
    pushHistory(buildSnapshot());
  }, [pushHistory, buildSnapshot]);

  // Keyboard shortcuts
  useEffect(() => {
    const keyMap: Record<string, () => void> = {
      'v': () => setTool('select'),
      'l': () => setTool('liquify'),
      'b': () => setTool('skinBrush'),
      'j': () => setTool('spotHeal'),
      'p': () => setTool('privacyBlur'),
      'c': () => setTool('crop'),
    };

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Undo: Ctrl+Z
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') || (e.ctrlKey && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      const fn = keyMap[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTool, undo, redo]);

  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    // Compute display scale
    const maxW = 1400;
    const maxH = 900;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const dw = Math.round(img.naturalWidth * scale);
    const dh = Math.round(img.naturalHeight * scale);
    setImage(img, dw, dh);
    // Initialize history with clean slate
    initHistory({
      adjustments: DEFAULT_ADJUSTMENTS,
      faceAdjustments: DEFAULT_FACE,
      bodyAdjustments: DEFAULT_BODY_ADJ,
      bodyAnchors: DEFAULT_BODY_ANCHORS,
      activeFilter: 'none',
      liquifyDX: null,
      liquifyDY: null,
      skinMask: null,
      privacyMask: null,
    });
  }, [setImage, initHistory]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    displayCanvasRef.current = canvas;
  }, []);

  const handleDetectFace = useCallback(async () => {
    if (!displayCanvasRef.current) return;
    setFaceDetecting(true);
    try {
      const landmarks = await detectFaceLandmarks(displayCanvasRef.current);
      setLandmarks(landmarks);
    } catch (e) {
      console.error('Face detection failed:', e);
      setLandmarks(null);
    }
  }, [setFaceDetecting, setLandmarks]);

  const handleExport = useCallback(async () => {
    if (!displayCanvasRef.current) return;
    await exportImage(displayCanvasRef.current, state.exportSettings);
  }, [state.exportSettings]);

  const handleBatchExport = useCallback(async () => {
    if (!displayCanvasRef.current) return;
    await batchExport(displayCanvasRef.current, state.exportSettings);
  }, [state.exportSettings]);

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-[#111] text-white overflow-hidden">
      <TopBar
        hasImage={!!state.originalImage}
        showOriginal={state.showOriginal}
        onToggleOriginal={setShowOriginal}
        onImageLoad={handleImageLoad}
        onExport={handleExport}
        onBatchExport={handleBatchExport}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          activeTool={state.activeTool}
          onToolChange={setTool}
          faceDetected={state.faceDetected}
          faceDetecting={state.faceDetecting}
          onDetectFace={handleDetectFace}
        />

        <EditorCanvas
          state={state}
          onLiquifyUpdate={updateLiquifyField}
          onSkinMaskUpdate={updateSkinMask}
          onPrivacyMaskUpdate={updatePrivacyMask}
          onCanvasReady={handleCanvasReady}
          onImageLoad={handleImageLoad}
          onHistoryPush={handlePushHistory}
          onBodyAnchorUpdate={setBodyAnchor}
          onToolChange={setTool}
        />

        <RightPanel
          state={state}
          onAdjustment={setAdjustment}
          onFace={setFace}
          onSkin={setSkin}
          onLiquify={setLiquify}
          onFilter={setFilter}
          onExport={setExport}
          onResetAdjustments={resetAdjustments}
          onResetFace={resetFace}
          onResetLiquify={resetLiquify}
          onResetSkinMask={resetSkinMask}
          onAdjustmentCommit={handlePushHistory}
          onFaceCommit={handlePushHistory}
          onBodyAdj={setBodyAdj}
          onBodyAnchorPlace={(anchor) => {
            const toolMap = { chest: 'placeChest', leftThigh: 'placeLeftThigh', rightThigh: 'placeRightThigh' } as const;
            setTool(toolMap[anchor]);
          }}
          onBodyAnchorDelete={(anchor) => setBodyAnchor(anchor, null)}
          onResetBodyAdj={resetBodyAdj}
          onBodyAdjCommit={handlePushHistory}
        />
      </div>
    </div>
  );
}
