'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useEditorState } from '@/hooks/useEditorState';
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
  } = useEditorState();

  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      const fn = keyMap[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTool]);

  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    // Compute display scale
    const maxW = 1400;
    const maxH = 900;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const dw = Math.round(img.naturalWidth * scale);
    const dh = Math.round(img.naturalHeight * scale);
    setImage(img, dw, dh);
  }, [setImage]);

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
        />
      </div>
    </div>
  );
}
