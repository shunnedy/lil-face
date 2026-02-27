'use client';
import { ActiveTool } from '@/types/editor';

interface Props {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  faceDetected: boolean;
  faceDetecting: boolean;
  onDetectFace: () => void;
}

interface ToolBtn {
  id: ActiveTool;
  icon: string;
  label: string;
  shortcut: string;
}

const TOOLS: ToolBtn[] = [
  { id: 'select',      icon: '🖱️',  label: '選択',          shortcut: 'V' },
  { id: 'liquify',     icon: '〰️',  label: 'リキファイ',    shortcut: 'L' },
  { id: 'skinBrush',   icon: '🖌️',  label: '肌ブラシ',      shortcut: 'B' },
  { id: 'spotHeal',    icon: '⭕',   label: 'スポット修復',  shortcut: 'J' },
  { id: 'privacyBlur', icon: '🌀',  label: 'プライバシー',  shortcut: 'P' },
  { id: 'crop',        icon: '✂️',  label: 'クロップ',      shortcut: 'C' },
];

export default function LeftPanel({ activeTool, onToolChange, faceDetected, faceDetecting, onDetectFace }: Props) {
  return (
    <div className="w-[68px] bg-[#1c1c1c] border-r border-[#333] flex flex-col items-center py-3 gap-1 shrink-0">
      {TOOLS.map(tool => (
        <button
          key={tool.id}
          title={`${tool.label} (${tool.shortcut})`}
          onClick={() => onToolChange(tool.id)}
          className={`
            w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5
            transition-all duration-150 group relative
            ${activeTool === tool.id
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
              : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
            }
          `}
        >
          <span className="text-xl leading-none">{tool.icon}</span>
          <span className="text-[9px] leading-none">{tool.label.slice(0, 4)}</span>
          {/* Tooltip */}
          <div className="absolute left-full ml-2 bg-[#333] text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
            {tool.label}
            <span className="ml-1 text-gray-400">[{tool.shortcut}]</span>
          </div>
        </button>
      ))}

      <div className="w-8 border-t border-[#333] my-2" />

      {/* Face Detection Button */}
      <button
        title="顔検出"
        onClick={onDetectFace}
        disabled={faceDetecting}
        className={`
          w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all
          ${faceDetected ? 'bg-green-700/50 text-green-300' : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-white'}
          ${faceDetecting ? 'animate-pulse opacity-60' : ''}
        `}
      >
        <span className="text-xl leading-none">{faceDetecting ? '⏳' : faceDetected ? '✅' : '🤖'}</span>
        <span className="text-[9px] leading-none">{faceDetecting ? '検出中' : '顔AI'}</span>
      </button>
    </div>
  );
}
