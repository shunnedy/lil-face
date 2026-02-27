'use client';
import { useRef } from 'react';
interface Props {
  hasImage: boolean;
  showOriginal: boolean;
  onToggleOriginal: (v: boolean) => void;
  onImageLoad: (img: HTMLImageElement) => void;
  onExport: () => void;
  onBatchExport: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export default function TopBar({
  hasImage,
  showOriginal,
  onToggleOriginal,
  onImageLoad,
  onExport,
  onBatchExport,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      onImageLoad(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    e.target.value = '';
  };

  return (
    <div className="h-12 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4 gap-3 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <span className="text-lg">✨</span>
        <span className="text-white font-bold text-sm tracking-wider">MeiTu Retouch</span>
      </div>

      {/* Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors flex items-center gap-1"
      >
        <span>📂</span> 開く
      </button>

      {/* Undo / Redo */}
      <div className="flex gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="元に戻す (Ctrl+Z)"
          className={`h-8 w-8 flex items-center justify-center rounded text-sm transition-colors ${
            canUndo
              ? 'text-gray-200 hover:bg-[#2a2a2a]'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          ↩
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="やり直す (Ctrl+Shift+Z)"
          className={`h-8 w-8 flex items-center justify-center rounded text-sm transition-colors ${
            canRedo
              ? 'text-gray-200 hover:bg-[#2a2a2a]'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          ↪
        </button>
      </div>

      <div className="flex-1" />

      {hasImage && (
        <>
          {/* Before/After */}
          <button
            onMouseDown={() => onToggleOriginal(true)}
            onMouseUp={() => onToggleOriginal(false)}
            onMouseLeave={() => onToggleOriginal(false)}
            className={`h-8 px-3 text-xs rounded transition-colors flex items-center gap-1 border ${
              showOriginal
                ? 'bg-yellow-600/30 border-yellow-600 text-yellow-300'
                : 'border-[#444] text-gray-300 hover:bg-[#2a2a2a]'
            }`}
          >
            <span>👁️</span> 比較
          </button>

          {/* Export */}
          <button
            onClick={onExport}
            className="h-8 px-3 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors flex items-center gap-1"
          >
            <span>💾</span> 保存
          </button>

          {/* Batch Export */}
          <button
            onClick={onBatchExport}
            className="h-8 px-3 bg-purple-700 hover:bg-purple-600 text-white text-xs rounded transition-colors flex items-center gap-1"
          >
            <span>📦</span> 一括書出
          </button>
        </>
      )}
    </div>
  );
}
