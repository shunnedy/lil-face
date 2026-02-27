'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import {
  EditorState, FaceAdjustments, Adjustments, SkinSettings,
  FaceLandmark, FilterPreset, BodyAnchors, BodyAdjustments,
} from '@/types/editor';
import { applyColorAdjustments, applyVignetteOverlay, gaussianBlurRGBA } from '@/lib/imageAdjust';
import { applyLiquifyInto, applyLiquifyWithPreservation, addLiquifyStroke } from '@/lib/liquify';
import { applySkinSmooth, applyPrivacyBlur } from '@/lib/skinSmooth';
import { applyFilter } from '@/lib/filters';
import { buildFaceControlPoints, applyFaceWarp } from '@/lib/faceWarp';
import { buildBodyControlPoints, hasBodyAdjustment } from '@/lib/bodyWarp';
import { paintSkinMask, eraseSkinMask } from '@/lib/skinSmooth';

interface Props {
  state: EditorState;
  onLiquifyUpdate: (dx: Float32Array, dy: Float32Array) => void;
  onSkinMaskUpdate: (mask: Float32Array) => void;
  onPrivacyMaskUpdate: (mask: Float32Array) => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  onImageLoad: (img: HTMLImageElement) => void;
  onHistoryPush?: () => void;
  onBodyAnchorUpdate: (key: keyof BodyAnchors, pos: { x: number; y: number } | null) => void;
  onToolChange: (tool: EditorState['activeTool']) => void;
}

/** Fields that affect the "base" image (everything except liquify) */
interface BaseKey {
  image: HTMLImageElement | null;
  landmarks: FaceLandmark[] | null;
  faceAdj: FaceAdjustments;
  bodyAdj: BodyAdjustments;
  bodyAnchors: BodyAnchors;
  adj: Adjustments;
  filter: FilterPreset;
  skinMask: Float32Array | null;
  skinSettings: SkinSettings;
  privacyMask: Float32Array | null;
  w: number;
  h: number;
}

// Sigma for anchor hit-test and visual display (in canvas pixels)
const CHEST_SIGMA = (w: number) => w * 0.13;
const THIGH_SIGMA = (w: number) => w * 0.11;
const ANCHOR_HIT_RADIUS = 20; // canvas pixels

export default function EditorCanvas({
  state,
  onLiquifyUpdate,
  onSkinMaskUpdate,
  onPrivacyMaskUpdate,
  onCanvasReady,
  onImageLoad,
  onHistoryPush,
  onBodyAnchorUpdate,
  onToolChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderReqRef = useRef<number | null>(null);
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // Zoom / pan
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  zoomRef.current = zoom;
  panRef.current = pan;

  const stateRef = useRef(state);
  stateRef.current = state;

  // --- Performance: base image cache ---
  const baseImgRef = useRef<ImageData | null>(null);
  const prevBaseKeyRef = useRef<BaseKey | null>(null);
  const blurredBaseRef = useRef<ImageData | null>(null); // for texture preservation

  // --- Performance: local liquify fields during drag ---
  const liqDXRef = useRef<Float32Array | null>(null);
  const liqDYRef = useRef<Float32Array | null>(null);
  const isLiquifyDragRef = useRef(false);
  const hasLiquifyRef = useRef(false);

  // --- Pre-allocated output buffer for liquify ---
  const outBufRef = useRef<Uint8ClampedArray<ArrayBuffer> | null>(null);

  // --- Canvas 2D context ---
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
    }
  }, []);

  // Pan
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  // Tool drag
  const isDragging = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  // Anchor drag
  const draggingAnchorRef = useRef<keyof BodyAnchors | null>(null);

  // Sync local liquify refs when state changes (outside drag)
  useEffect(() => {
    if (!isLiquifyDragRef.current) {
      liqDXRef.current = state.liquifyDX;
      liqDYRef.current = state.liquifyDY;
      hasLiquifyRef.current = false;
      if (state.liquifyDX) {
        for (let i = 0; i < state.liquifyDX.length; i += 500) {
          if (state.liquifyDX[i] !== 0) { hasLiquifyRef.current = true; break; }
        }
      }
    }
  }, [state.liquifyDX, state.liquifyDY]);

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
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [state.originalImage]);

  // --- Core render function ---
  const renderCanvas = useCallback(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.originalImage || displayW === 0) return;

    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
      ctxRef.current = canvas.getContext('2d', { willReadFrequently: true });
    }
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (s.showOriginal) {
      ctx.drawImage(s.originalImage, 0, 0, displayW, displayH);
      return;
    }

    // --- Check if base needs recompute ---
    const bk = prevBaseKeyRef.current;
    const needsBase = !bk ||
      bk.image !== s.originalImage || bk.landmarks !== s.landmarks ||
      bk.faceAdj !== s.faceAdjustments || bk.bodyAdj !== s.bodyAdjustments ||
      bk.bodyAnchors !== s.bodyAnchors ||
      bk.adj !== s.adjustments || bk.filter !== s.activeFilter ||
      bk.skinMask !== s.skinMask || bk.skinSettings !== s.skinSettings ||
      bk.privacyMask !== s.privacyMask || bk.w !== displayW || bk.h !== displayH;

    if (needsBase) {
      ctx.drawImage(s.originalImage, 0, 0, displayW, displayH);
      let id = ctx.getImageData(0, 0, displayW, displayH);

      // Face warp (cached — only on adj changes, not during liquify drag)
      if (s.landmarks && s.landmarks.length > 400) {
        const cps = buildFaceControlPoints(s.landmarks, s.faceAdjustments);
        if (cps.length > 0) id = applyFaceWarp(id, cps);
      }

      // Body warp (instant sliders, same algorithm as face warp)
      if (hasBodyAdjustment(s.bodyAnchors, s.bodyAdjustments)) {
        const bodyCPs = buildBodyControlPoints(s.bodyAnchors, s.bodyAdjustments, displayW, displayH);
        if (bodyCPs.length > 0) id = applyFaceWarp(id, bodyCPs);
      }

      // Skin smooth
      if (s.skinMask) {
        let hasMask = false;
        for (let i = 0; i < s.skinMask.length; i += 200) {
          if (s.skinMask[i] > 0) { hasMask = true; break; }
        }
        if (hasMask) id = applySkinSmooth(id, s.skinMask, s.skinSettings.smoothness, s.skinSettings.skinBrightness);
      }

      // Privacy blur
      if (s.privacyMask) {
        let hasMask = false;
        for (let i = 0; i < s.privacyMask.length; i += 200) {
          if (s.privacyMask[i] > 0) { hasMask = true; break; }
        }
        if (hasMask) id = applyPrivacyBlur(id, s.privacyMask);
      }

      id = applyColorAdjustments(id, s.adjustments);
      if (s.activeFilter !== 'none') id = applyFilter(id, s.activeFilter);

      baseImgRef.current = id;
      blurredBaseRef.current = null; // invalidate blur cache
      prevBaseKeyRef.current = {
        image: s.originalImage, landmarks: s.landmarks,
        faceAdj: s.faceAdjustments, bodyAdj: s.bodyAdjustments,
        bodyAnchors: s.bodyAnchors, adj: s.adjustments,
        filter: s.activeFilter, skinMask: s.skinMask,
        skinSettings: s.skinSettings, privacyMask: s.privacyMask,
        w: displayW, h: displayH,
      };
    }

    const base = baseImgRef.current!;
    const dx = liqDXRef.current;
    const dy = liqDYRef.current;

    if (hasLiquifyRef.current && dx && dy) {
      const needed = displayW * displayH * 4;
      if (!outBufRef.current || outBufRef.current.length !== needed) {
        outBufRef.current = new Uint8ClampedArray(new ArrayBuffer(needed));
      }
      const t = s.liquifySettings.texturePreservation / 100;
      if (t > 0) {
        if (!blurredBaseRef.current) {
          blurredBaseRef.current = gaussianBlurRGBA(base, 5);
        }
        applyLiquifyWithPreservation(
          base.data, blurredBaseRef.current.data,
          outBufRef.current, dx, dy, displayW, displayH, t,
        );
      } else {
        applyLiquifyInto(base.data, outBufRef.current, dx, dy, displayW, displayH);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx.putImageData(new ImageData(outBufRef.current as any, displayW, displayH), 0, 0);
    } else {
      ctx.putImageData(base, 0, 0);
    }

    if (s.adjustments.vignette > 0) {
      applyVignetteOverlay(ctx, displayW, displayH, s.adjustments.vignette);
    }
  }, [displayW, displayH]);

  // --- Schedule React-triggered renders ---
  useEffect(() => {
    if (!state.originalImage) return;
    if (renderReqRef.current) cancelAnimationFrame(renderReqRef.current);
    renderReqRef.current = requestAnimationFrame(() => {
      renderCanvas();
      if (canvasRef.current) onCanvasReady(canvasRef.current);
    });
    return () => { if (renderReqRef.current) cancelAnimationFrame(renderReqRef.current); };
  }, [state.renderVersion, state.originalImage, displayW, displayH, renderCanvas, onCanvasReady]);

  // --- Mouse wheel zoom ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      if (!stateRef.current.originalImage) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(8, Math.max(0.1, oldZoom * factor));
      const ratio = newZoom / oldZoom;
      setZoom(newZoom);
      setPan(p => ({ x: mx * (1 - ratio) + p.x * ratio, y: my * (1 - ratio) + p.y * ratio }));
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, []);

  // --- Canvas coordinate helper ---
  const getCanvasCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  // Check if a canvas position hits a body anchor
  const hitTestAnchor = useCallback((pos: { x: number; y: number }): keyof BodyAnchors | null => {
    const { bodyAnchors } = stateRef.current;
    const r = ANCHOR_HIT_RADIUS;
    if (bodyAnchors.chest && Math.hypot(pos.x - bodyAnchors.chest.x, pos.y - bodyAnchors.chest.y) < r) return 'chest';
    if (bodyAnchors.leftThigh && Math.hypot(pos.x - bodyAnchors.leftThigh.x, pos.y - bodyAnchors.leftThigh.y) < r) return 'leftThigh';
    if (bodyAnchors.rightThigh && Math.hypot(pos.x - bodyAnchors.rightThigh.x, pos.y - bodyAnchors.rightThigh.y) < r) return 'rightThigh';
    return null;
  }, []);

  // --- Mouse handlers (all on container) ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.originalImage) return;

    // Middle mouse or select tool = pan
    if (e.button === 1 || s.activeTool === 'select') {
      e.preventDefault();
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
      return;
    }

    const pos = getCanvasCoords(e.clientX, e.clientY);
    if (!pos) return;

    // Anchor placement tools
    const placeTool = s.activeTool;
    if (placeTool === 'placeChest' || placeTool === 'placeLeftThigh' || placeTool === 'placeRightThigh') {
      const key: keyof BodyAnchors = placeTool === 'placeChest' ? 'chest' : placeTool === 'placeLeftThigh' ? 'leftThigh' : 'rightThigh';
      onBodyAnchorUpdate(key, { x: pos.x, y: pos.y });
      onToolChange('select');
      return;
    }

    // Anchor drag — check if clicking on an existing anchor
    const hitAnchor = hitTestAnchor(pos);
    if (hitAnchor) {
      draggingAnchorRef.current = hitAnchor;
      isDragging.current = true;
      lastPos.current = pos;
      return;
    }

    isDragging.current = true;
    lastPos.current = pos;

    if (s.activeTool === 'liquify') {
      isLiquifyDragRef.current = true;
      liqDXRef.current = s.liquifyDX ? new Float32Array(s.liquifyDX) : new Float32Array(displayW * displayH);
      liqDYRef.current = s.liquifyDY ? new Float32Array(s.liquifyDY) : new Float32Array(displayW * displayH);
      return;
    }

    if (s.activeTool === 'skinBrush') {
      const mask = s.skinMask ? new Float32Array(s.skinMask) : new Float32Array(displayW * displayH);
      if (e.altKey) eraseSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize);
      else paintSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize, 1);
      onSkinMaskUpdate(mask);
    }
    if (s.activeTool === 'privacyBlur') {
      const mask = s.privacyMask ? new Float32Array(s.privacyMask) : new Float32Array(displayW * displayH);
      paintSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize * 1.5, 1);
      onPrivacyMaskUpdate(mask);
    }
  }, [getCanvasCoords, hitTestAnchor, displayW, displayH, onBodyAnchorUpdate, onToolChange, onSkinMaskUpdate, onPrivacyMaskUpdate]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const s = stateRef.current;

    if (isPanningRef.current) {
      const ps = panStartRef.current;
      setPan({ x: ps.px + (e.clientX - ps.mx), y: ps.py + (e.clientY - ps.my) });
      return;
    }

    const pos = getCanvasCoords(e.clientX, e.clientY);
    setCursorPos(pos);

    if (!isDragging.current || !s.originalImage) return;
    if (!pos) return;

    // Anchor drag
    if (draggingAnchorRef.current) {
      onBodyAnchorUpdate(draggingAnchorRef.current, { x: pos.x, y: pos.y });
      return;
    }

    const last = lastPos.current ?? pos;
    const ddx = pos.x - last.x;
    const ddy = pos.y - last.y;
    lastPos.current = pos;

    if (s.activeTool === 'liquify') {
      addLiquifyStroke(
        liqDXRef.current!, liqDYRef.current!, displayW, displayH,
        pos.x, pos.y, ddx, ddy,
        s.liquifySettings.size, s.liquifySettings.strength, s.liquifySettings.mode,
      );
      hasLiquifyRef.current = true;
      renderCanvas();
      return;
    }

    if (s.activeTool === 'skinBrush') {
      const mask = s.skinMask ? new Float32Array(s.skinMask) : new Float32Array(displayW * displayH);
      if (e.altKey) eraseSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize);
      else paintSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize, 1);
      onSkinMaskUpdate(mask);
    }
    if (s.activeTool === 'privacyBlur') {
      const mask = s.privacyMask ? new Float32Array(s.privacyMask) : new Float32Array(displayW * displayH);
      paintSkinMask(mask, displayW, displayH, pos.x, pos.y, s.skinSettings.brushSize * 1.5, 1);
      onPrivacyMaskUpdate(mask);
    }
  }, [getCanvasCoords, displayW, displayH, renderCanvas, onBodyAnchorUpdate, onSkinMaskUpdate, onPrivacyMaskUpdate]);

  const handleMouseUp = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      return;
    }

    if (draggingAnchorRef.current) {
      draggingAnchorRef.current = null;
      isDragging.current = false;
      lastPos.current = null;
      onHistoryPush?.();
      return;
    }

    if (isLiquifyDragRef.current && liqDXRef.current && liqDYRef.current) {
      isLiquifyDragRef.current = false;
      onLiquifyUpdate(new Float32Array(liqDXRef.current), new Float32Array(liqDYRef.current));
      onHistoryPush?.();
    } else if (isDragging.current && onHistoryPush) {
      const tool = stateRef.current.activeTool;
      if (tool === 'skinBrush' || tool === 'privacyBlur') onHistoryPush();
    }

    isDragging.current = false;
    lastPos.current = null;
  }, [onLiquifyUpdate, onHistoryPush]);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    if (isPanningRef.current) { isPanningRef.current = false; setIsPanning(false); }
    isDragging.current = false;
    draggingAnchorRef.current = null;
    lastPos.current = null;
  }, []);

  const handleDoubleClick = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // --- Drag & Drop ---
  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { onImageLoad(img); URL.revokeObjectURL(url); };
    img.src = url;
  }, [onImageLoad]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { if (e.currentTarget === e.target) setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadImageFile(file);
  }, [loadImageFile]);

  // --- Cursor ---
  const isPlaceTool = ['placeChest', 'placeLeftThigh', 'placeRightThigh'].includes(state.activeTool);
  const showBrush = ['liquify', 'skinBrush', 'privacyBlur'].includes(state.activeTool);
  const brushRadius = state.activeTool === 'liquify'
    ? state.liquifySettings.size
    : state.skinSettings.brushSize * (state.activeTool === 'privacyBlur' ? 1.5 : 1);

  const cursor = isPanning ? 'grabbing'
    : !state.originalImage ? (isDragOver ? 'copy' : 'default')
    : isPlaceTool ? 'crosshair'
    : draggingAnchorRef.current ? 'grabbing'
    : (cursorPos && hitTestAnchor(cursorPos)) ? 'grab'
    : state.activeTool === 'select' ? 'grab'
    : showBrush ? 'none'
    : 'default';

  // --- Anchor sigma for display ---
  const chestSigma = CHEST_SIGMA(displayW);
  const thighSigma = THIGH_SIGMA(displayW);

  // --- Empty state ---
  if (!state.originalImage) {
    return (
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 flex items-center justify-center transition-colors ${isDragOver ? 'bg-blue-900/30' : 'bg-[#111]'}`}
        style={{ cursor }}
      >
        <div className="text-center pointer-events-none select-none">
          <div className="text-6xl mb-4">{isDragOver ? '📂' : '📸'}</div>
          <div className="text-lg text-gray-400">画像をアップロードしてください</div>
          <div className="text-sm mt-2 text-gray-600">JPG / PNG / WEBP 対応</div>
          <div className={`mt-6 border-2 border-dashed rounded-xl px-10 py-5 text-sm transition-colors ${
            isDragOver ? 'border-blue-400 text-blue-300 bg-blue-900/20' : 'border-gray-700 text-gray-600'
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 flex items-center justify-center overflow-hidden relative transition-colors select-none ${
        isDragOver ? 'bg-blue-900/30' : 'bg-[#111]'
      }`}
      style={{ minHeight: 0, cursor }}
    >
      {/* Placement mode hint */}
      {isPlaceTool && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none z-20">
          {state.activeTool === 'placeChest' ? '胸の中心をクリック' : state.activeTool === 'placeLeftThigh' ? '左太ももの中心をクリック' : '右太ももの中心をクリック'}
        </div>
      )}

      {/* Zoom wrapper */}
      <div
        style={{
          display: 'inline-block',
          position: 'relative',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center',
          willChange: 'transform',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />

        {/* Body anchor overlays — inside zoom wrapper so they scale naturally */}
        {!state.showOriginal && (
          <>
            <AnchorOverlay
              anchor={state.bodyAnchors.chest}
              sigma={chestSigma}
              color="#f87171"
              label="胸"
            />
            <AnchorOverlay
              anchor={state.bodyAnchors.leftThigh}
              sigma={thighSigma}
              color="#60a5fa"
              label="左もも"
            />
            <AnchorOverlay
              anchor={state.bodyAnchors.rightThigh}
              sigma={thighSigma}
              color="#34d399"
              label="右もも"
            />
          </>
        )}

        {/* Brush cursor */}
        {showBrush && cursorPos && displayW > 0 && (
          <div
            className="pointer-events-none absolute rounded-full border-2 border-white/70"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: brushRadius * 2,
              height: brushRadius * 2,
              transform: 'translate(-50%, -50%)',
              mixBlendMode: 'difference',
            }}
          />
        )}

        {state.showOriginal && (
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded pointer-events-none">
            オリジナル
          </div>
        )}
      </div>

      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-blue-400 rounded-xl px-12 py-8 bg-blue-900/40 text-blue-300 text-lg">
            ドロップして画像を差し替え
          </div>
        </div>
      )}

      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] px-2 py-1 rounded pointer-events-none select-none">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

/** Render a draggable anchor circle overlay */
function AnchorOverlay({
  anchor, sigma, color, label,
}: {
  anchor: { x: number; y: number } | null;
  sigma: number;
  color: string;
  label: string;
}) {
  if (!anchor) return null;
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: anchor.x, top: anchor.y, transform: 'translate(-50%, -50%)' }}
    >
      {/* Influence radius ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: sigma * 2,
          height: sigma * 2,
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          border: `1px dashed ${color}`,
          opacity: 0.35,
        }}
      />
      {/* Center dot */}
      <div
        className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{
          backgroundColor: `${color}33`,
          borderColor: color,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      </div>
      {/* Label */}
      <div
        className="absolute text-[9px] font-medium px-1 rounded whitespace-nowrap"
        style={{ color, top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 2 }}
      >
        {label}
      </div>
    </div>
  );
}
