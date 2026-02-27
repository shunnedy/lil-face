'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorState } from '@/types/editor';
import { applyColorAdjustments, applyVignetteOverlay } from '@/lib/imageAdjust';
import { applyLiquify } from '@/lib/liquify';
import { applySkinSmooth, applyPrivacyBlur } from '@/lib/skinSmooth';
import { applyFilter } from '@/lib/filters';
import { buildFaceControlPoints, applyFaceWarp } from '@/lib/faceWarp';
import { addLiquifyStroke } from '@/lib/liquify';
import { paintSkinMask, eraseSkinMask } from '@/lib/skinSmooth';

interface Props {
  state: EditorState;
  onLiquifyUpdate: (dx: Float32Array, dy: Float32Array) => void;
  onSkinMaskUpdate: (mask: Float32Array) => void;
  onPrivacyMaskUpdate: (mask: Float32Array) => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  onImageLoad: (img: HTMLImageElement) => void;
  onHistoryPush?: () => void;
}



export default function EditorCanvas({
  state,
  onLiquifyUpdate,
  onSkinMaskUpdate,
  onPrivacyMaskUpdate,
  onCanvasReady,
  onImageLoad,
  onHistoryPush,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderReqRef = useRef<number | null>(null);
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const isDragging = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // --- Compute display dimensions ---
  useEffect(() => {
    if (!state.originalImage || !containerRef.current) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = state.originalImage.naturalWidth;
    const ih = state.originalImage.naturalHeight;
    const scale = Math.min(cw / iw, ch / ih, 1);
    setDisplayW(Math.round(iw * scale));
    setDisplayH(Math.round(ih * scale));
  }, [state.originalImage]);

  // --- Canvas render pipeline ---
  const render = useCallback(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.originalImage || displayW === 0) return;

    canvas.width = displayW;
    canvas.height = displayH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (s.showOriginal) {
      ctx.drawImage(s.originalImage, 0, 0, displayW, displayH);
      return;
    }

    // Draw image to get ImageData
    ctx.drawImage(s.originalImage, 0, 0, displayW, displayH);
    let imageData = ctx.getImageData(0, 0, displayW, displayH);

    // Face warp (only if landmarks detected and any face adj != 0)
    if (s.landmarks && s.landmarks.length > 400) {
      const cps = buildFaceControlPoints(s.landmarks, s.faceAdjustments);
      if (cps.length > 0) {
        imageData = applyFaceWarp(imageData, cps);
      }
    }

    // Liquify
    if (s.liquifyDX && s.liquifyDY) {
      // Check if any displacement exists
      let hasDisp = false;
      for (let i = 0; i < Math.min(100, s.liquifyDX.length); i++) {
        if (s.liquifyDX[i] !== 0) { hasDisp = true; break; }
      }
      if (!hasDisp) {
        for (let i = 0; i < s.liquifyDX.length; i += 100) {
          if (s.liquifyDX[i] !== 0) { hasDisp = true; break; }
        }
      }
      if (hasDisp) imageData = applyLiquify(imageData, s.liquifyDX, s.liquifyDY);
    }

    // Skin smooth
    if (s.skinMask) {
      const hasMask = s.skinMask.some(v => v > 0);
      if (hasMask) {
        imageData = applySkinSmooth(imageData, s.skinMask, s.skinSettings.smoothness, s.skinSettings.skinBrightness);
      }
    }

    // Privacy blur
    if (s.privacyMask) {
      const hasMask = s.privacyMask.some(v => v > 0);
      if (hasMask) imageData = applyPrivacyBlur(imageData, s.privacyMask);
    }

    // Color adjustments
    imageData = applyColorAdjustments(imageData, s.adjustments);

    // Filter
    if (s.activeFilter !== 'none') {
      imageData = applyFilter(imageData, s.activeFilter);
    }

    ctx.putImageData(imageData, 0, 0);

    // Vignette overlay
    if (s.adjustments.vignette > 0) {
      applyVignetteOverlay(ctx, displayW, displayH, s.adjustments.vignette);
    }
  }, [displayW, displayH]);

  // --- Schedule render when state changes ---
  useEffect(() => {
    if (!state.originalImage) return;
    if (renderReqRef.current) cancelAnimationFrame(renderReqRef.current);
    renderReqRef.current = requestAnimationFrame(() => {
      render();
      if (canvasRef.current) onCanvasReady(canvasRef.current);
    });
    return () => {
      if (renderReqRef.current) cancelAnimationFrame(renderReqRef.current);
    };
  }, [state.renderVersion, state.originalImage, displayW, displayH, render, onCanvasReady]);

  // --- Coordinate helper ---
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  // --- Mouse handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.originalImage) return;
    isDragging.current = true;
    const pos = getCanvasCoords(e);
    lastPos.current = pos;

    if (s.activeTool === 'skinBrush') {
      const mask = s.skinMask ? new Float32Array(s.skinMask) : new Float32Array(displayW * displayH);
      const erase = e.altKey;
      if (erase) eraseSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize);
      else paintSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize, 1);
      onSkinMaskUpdate(mask);
    }
    if (s.activeTool === 'privacyBlur') {
      const mask = s.privacyMask ? new Float32Array(s.privacyMask) : new Float32Array(displayW * displayH);
      paintSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize * 1.5, 1);
      onPrivacyMaskUpdate(mask);
    }
  }, [getCanvasCoords, displayW, displayH, onSkinMaskUpdate, onPrivacyMaskUpdate]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    const pos = getCanvasCoords(e);
    setCursorPos(pos);

    if (!isDragging.current || !s.originalImage) return;
    const last = lastPos.current ?? pos;
    const dx = pos.x - last.x;
    const dy = pos.y - last.y;
    lastPos.current = pos;

    if (s.activeTool === 'liquify') {
      const dxF = s.liquifyDX ? new Float32Array(s.liquifyDX) : new Float32Array(displayW * displayH);
      const dyF = s.liquifyDY ? new Float32Array(s.liquifyDY) : new Float32Array(displayW * displayH);
      addLiquifyStroke(
        dxF, dyF, displayW, displayH,
        pos.x, pos.y, dx, dy,
        s.liquifySettings.size, s.liquifySettings.strength, s.liquifySettings.mode,
      );
      onLiquifyUpdate(dxF, dyF);
    }

    if (s.activeTool === 'skinBrush') {
      const mask = s.skinMask ? new Float32Array(s.skinMask) : new Float32Array(displayW * displayH);
      const erase = e.altKey;
      if (erase) eraseSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize);
      else paintSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize, 1);
      onSkinMaskUpdate(mask);
    }

    if (s.activeTool === 'privacyBlur') {
      const mask = s.privacyMask ? new Float32Array(s.privacyMask) : new Float32Array(displayW * displayH);
      paintSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize * 1.5, 1);
      onPrivacyMaskUpdate(mask);
    }
  }, [getCanvasCoords, displayW, displayH, onLiquifyUpdate, onSkinMaskUpdate, onPrivacyMaskUpdate]);

  const handleMouseUp = useCallback(() => {
    const wasDragging = isDragging.current;
    isDragging.current = false;
    lastPos.current = null;
    if (wasDragging && onHistoryPush) {
      const tool = stateRef.current.activeTool;
      if (tool === 'liquify' || tool === 'skinBrush' || tool === 'privacyBlur') {
        onHistoryPush();
      }
    }
  }, [onHistoryPush]);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    isDragging.current = false;
    lastPos.current = null;
  }, []);

  // --- Drag & Drop handlers ---
  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      onImageLoad(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [onImageLoad]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the container itself (not a child)
    if (e.currentTarget === e.target) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadImageFile(file);
  }, [loadImageFile]);

  // Brush cursor size in pixels
  const brushRadius = state.activeTool === 'liquify'
    ? state.liquifySettings.size
    : state.skinSettings.brushSize * (state.activeTool === 'privacyBlur' ? 1.5 : 1);

  const showBrush = ['liquify', 'skinBrush', 'privacyBlur'].includes(state.activeTool);

  if (!state.originalImage) {
    return (
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 flex items-center justify-center text-gray-500 transition-colors ${
          isDragOver ? 'bg-blue-900/30' : 'bg-[#111]'
        }`}
      >
        <div className="text-center pointer-events-none select-none">
          <div className="text-6xl mb-4">{isDragOver ? '📂' : '📸'}</div>
          <div className="text-lg text-gray-400">画像をアップロードしてください</div>
          <div className="text-sm mt-2 text-gray-600">JPG / PNG / WEBP 対応</div>
          <div className={`mt-6 border-2 border-dashed rounded-xl px-10 py-5 text-sm transition-colors ${
            isDragOver
              ? 'border-blue-400 text-blue-300 bg-blue-900/20'
              : 'border-gray-700 text-gray-600'
          }`}>
            {isDragOver ? 'ドロップして開く' : 'ここにドラッグ&ドロップ'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 flex items-center justify-center overflow-hidden relative transition-colors ${
        isDragOver ? 'bg-blue-900/30' : 'bg-[#111]'
      }`}
      style={{ minHeight: 0 }}
    >
      {/* Drag overlay when image is already loaded */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-blue-400 rounded-xl px-12 py-8 bg-blue-900/40 text-blue-300 text-lg">
            ドロップして画像を差し替え
          </div>
        </div>
      )}

      {/* Checkerboard background for transparent images */}
      <div className="relative" style={{ display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: '100%',
            cursor: showBrush ? 'none' : 'default',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* Custom brush cursor */}
        {showBrush && cursorPos && displayW > 0 && (
          <div
            className="pointer-events-none absolute rounded-full border-2 border-white/70"
            style={{
              left: (cursorPos.x / displayW) * 100 + '%',
              top: (cursorPos.y / displayH) * 100 + '%',
              width: brushRadius * 2 * (canvasRef.current ? canvasRef.current.getBoundingClientRect().width / displayW : 1),
              height: brushRadius * 2 * (canvasRef.current ? canvasRef.current.getBoundingClientRect().width / displayW : 1),
              transform: 'translate(-50%, -50%)',
              mixBlendMode: 'difference',
            }}
          />
        )}

        {/* Before/After label */}
        {state.showOriginal && (
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            オリジナル
          </div>
        )}
      </div>
    </div>
  );
}
