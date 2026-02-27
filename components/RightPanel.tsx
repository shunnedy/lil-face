'use client';
import { useState } from 'react';
import {
  EditorState, Adjustments, FaceAdjustments, SkinSettings,
  LiquifySettings, FilterPreset, ExportSettings,
} from '@/types/editor';
import { FILTER_LIST, FILTER_DEFS } from '@/lib/filters';

// ---- Reusable Slider ----
function Slider({
  label, value, min, max, step = 1, unit = '', onChange, onReset,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  unit?: string; onChange: (v: number) => void; onReset?: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-2">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[11px] text-gray-400">{label}</span>
        <span
          className="text-[11px] text-gray-300 cursor-pointer hover:text-white"
          onClick={onReset}
          title="リセット"
        >
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded appearance-none bg-[#3a3a3a] cursor-pointer accent-blue-500"
        style={{
          background: `linear-gradient(to right, #3b82f6 ${pct}%, #3a3a3a ${pct}%)`,
        }}
      />
    </div>
  );
}

// ---- Collapsible Section ----
function Section({
  title, icon, defaultOpen = true, children, badge,
}: {
  title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#2a2a2a]">
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#252525] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-medium text-gray-200">{title}</span>
          {badge && <span className="text-[10px] bg-green-700 text-green-200 px-1.5 rounded">{badge}</span>}
        </div>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ---- Props ----
interface Props {
  state: EditorState;
  onAdjustment: (key: keyof Adjustments, value: number) => void;
  onFace: (key: keyof FaceAdjustments, value: number) => void;
  onSkin: (key: keyof SkinSettings, value: number) => void;
  onLiquify: (key: keyof LiquifySettings, value: number | string) => void;
  onFilter: (f: FilterPreset) => void;
  onExport: (key: keyof ExportSettings, value: unknown) => void;
  onResetAdjustments: () => void;
  onResetFace: () => void;
  onResetLiquify: () => void;
  onResetSkinMask: () => void;
}

export default function RightPanel({
  state, onAdjustment, onFace, onSkin, onLiquify, onFilter,
  onExport, onResetAdjustments, onResetFace, onResetLiquify, onResetSkinMask,
}: Props) {
  const { adjustments: adj, faceAdjustments: face, skinSettings: skin,
    liquifySettings: liq, exportSettings: exp } = state;

  return (
    <div className="w-[272px] bg-[#1c1c1c] border-l border-[#333] overflow-y-auto flex-shrink-0 flex flex-col text-sm">

      {/* === COLOR === */}
      <Section title="色調補正" icon="🎨" defaultOpen>
        <div className="flex justify-end mb-1">
          <button onClick={onResetAdjustments} className="text-[10px] text-gray-500 hover:text-red-400">リセット</button>
        </div>
        <Slider label="明るさ" value={adj.brightness} min={-100} max={100}
          onChange={v => onAdjustment('brightness', v)} onReset={() => onAdjustment('brightness', 0)} />
        <Slider label="コントラスト" value={adj.contrast} min={-100} max={100}
          onChange={v => onAdjustment('contrast', v)} onReset={() => onAdjustment('contrast', 0)} />
        <Slider label="彩度" value={adj.saturation} min={-100} max={100}
          onChange={v => onAdjustment('saturation', v)} onReset={() => onAdjustment('saturation', 0)} />
        <Slider label="色温度（暖かさ）" value={adj.warmth} min={-100} max={100}
          onChange={v => onAdjustment('warmth', v)} onReset={() => onAdjustment('warmth', 0)} />
        <Slider label="露出" value={adj.exposure} min={-2} max={2} step={0.05}
          onChange={v => onAdjustment('exposure', v)} onReset={() => onAdjustment('exposure', 0)} />
        <Slider label="シャドウ" value={adj.shadows} min={-100} max={100}
          onChange={v => onAdjustment('shadows', v)} onReset={() => onAdjustment('shadows', 0)} />
        <Slider label="ハイライト" value={adj.highlights} min={-100} max={100}
          onChange={v => onAdjustment('highlights', v)} onReset={() => onAdjustment('highlights', 0)} />
        <Slider label="クラリティ" value={adj.clarity} min={0} max={100}
          onChange={v => onAdjustment('clarity', v)} onReset={() => onAdjustment('clarity', 0)} />
        <Slider label="シャープネス" value={adj.sharpness} min={0} max={100}
          onChange={v => onAdjustment('sharpness', v)} onReset={() => onAdjustment('sharpness', 0)} />
        <Slider label="ビネット" value={adj.vignette} min={0} max={100}
          onChange={v => onAdjustment('vignette', v)} onReset={() => onAdjustment('vignette', 0)} />
      </Section>

      {/* === FILTER === */}
      <Section title="フィルター" icon="🎭" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {FILTER_LIST.map(f => {
            const def = FILTER_DEFS[f];
            return (
              <button
                key={f}
                onClick={() => onFilter(f)}
                className={`
                  py-1.5 px-2 rounded text-xs flex items-center gap-1 transition-colors
                  ${state.activeFilter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                  }
                `}
              >
                <span>{def.emoji}</span>
                <span className="truncate">{def.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* === FACE === */}
      <Section
        title="顔の加工"
        icon="😊"
        defaultOpen={state.faceDetected}
        badge={state.faceDetected ? 'AI検出済' : undefined}
      >
        {!state.faceDetected && (
          <div className="text-[11px] text-yellow-500/80 mb-2 bg-yellow-900/20 rounded p-2">
            ⚠️ 顔AIを実行すると精度が上がります（左パネルの 🤖 ボタン）
          </div>
        )}
        <div className="flex justify-end mb-1">
          <button onClick={onResetFace} className="text-[10px] text-gray-500 hover:text-red-400">リセット</button>
        </div>
        <div className="text-[10px] text-gray-500 mb-1 font-medium">輪郭</div>
        <Slider label="小顔" value={face.smallFace} min={0} max={100}
          onChange={v => onFace('smallFace', v)} onReset={() => onFace('smallFace', 0)} />
        <Slider label="エラ削り" value={face.slimJaw} min={0} max={100}
          onChange={v => onFace('slimJaw', v)} onReset={() => onFace('slimJaw', 0)} />
        <Slider label="顎の長さ" value={face.chinLength} min={-50} max={50}
          onChange={v => onFace('chinLength', v)} onReset={() => onFace('chinLength', 0)} />

        <div className="text-[10px] text-gray-500 mb-1 mt-2 font-medium">目</div>
        <Slider label="目の大きさ" value={face.eyeSize} min={0} max={100}
          onChange={v => onFace('eyeSize', v)} onReset={() => onFace('eyeSize', 0)} />
        <Slider label="目の幅" value={face.eyeWidth} min={-50} max={50}
          onChange={v => onFace('eyeWidth', v)} onReset={() => onFace('eyeWidth', 0)} />

        <div className="text-[10px] text-gray-500 mb-1 mt-2 font-medium">鼻</div>
        <Slider label="鼻筋細く" value={face.noseSlim} min={0} max={100}
          onChange={v => onFace('noseSlim', v)} onReset={() => onFace('noseSlim', 0)} />
        <Slider label="鼻先" value={face.noseTip} min={-50} max={50}
          onChange={v => onFace('noseTip', v)} onReset={() => onFace('noseTip', 0)} />

        <div className="text-[10px] text-gray-500 mb-1 mt-2 font-medium">唇・口</div>
        <Slider label="唇の厚み" value={face.lipThickness} min={-50} max={50}
          onChange={v => onFace('lipThickness', v)} onReset={() => onFace('lipThickness', 0)} />
        <Slider label="口角" value={face.mouthCorner} min={-50} max={50}
          onChange={v => onFace('mouthCorner', v)} onReset={() => onFace('mouthCorner', 0)} />
      </Section>

      {/* === SKIN === */}
      <Section title="肌ケア（ブラシ）" icon="🌸" defaultOpen={false}>
        <div className="text-[11px] text-gray-400 mb-2">
          肌ブラシ <kbd className="bg-[#333] px-1 rounded">B</kbd> で塗ってください<br/>
          <span className="text-gray-500">Alt+ドラッグで消去</span>
        </div>
        <Slider label="スムース強度" value={skin.smoothness} min={0} max={100}
          onChange={v => onSkin('smoothness', v)} />
        <Slider label="肌の明るさ" value={skin.skinBrightness} min={0} max={100}
          onChange={v => onSkin('skinBrightness', v)} onReset={() => onSkin('skinBrightness', 0)} />
        <Slider label="ブラシサイズ" value={skin.brushSize} min={10} max={200}
          onChange={v => onSkin('brushSize', v)} unit="px" />
        <button
          onClick={onResetSkinMask}
          className="w-full mt-1 py-1 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-400 rounded transition-colors"
        >
          マスクをリセット
        </button>
      </Section>

      {/* === LIQUIFY === */}
      <Section title="リキファイ（ゆがみ）" icon="〰️" defaultOpen={false}>
        <div className="text-[11px] text-gray-400 mb-2">
          リキファイツール <kbd className="bg-[#333] px-1 rounded">L</kbd> でドラッグ
        </div>
        <Slider label="ブラシサイズ" value={liq.size} min={20} max={300}
          onChange={v => onLiquify('size', v)} unit="px" />
        <Slider label="強さ" value={liq.strength} min={1} max={100}
          onChange={v => onLiquify('strength', v)} />
        <div className="mb-2">
          <div className="text-[11px] text-gray-400 mb-1">モード</div>
          <div className="flex flex-wrap gap-1">
            {(['push','pull','restore','expand','shrink'] as const).map(mode => {
              const labels: Record<string, string> = { push:'プッシュ', pull:'引き寄せ', restore:'復元', expand:'拡大', shrink:'縮小' };
              return (
                <button
                  key={mode}
                  onClick={() => onLiquify('mode', mode)}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    liq.mode === mode ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'
                  }`}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={onResetLiquify}
          className="w-full mt-1 py-1 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-400 rounded transition-colors"
        >
          ゆがみをリセット
        </button>
      </Section>

      {/* === EXPORT === */}
      <Section title="書き出し設定" icon="💾" defaultOpen={false}>
        {/* Format */}
        <div className="mb-2">
          <div className="text-[11px] text-gray-400 mb-1">フォーマット</div>
          <div className="flex gap-1">
            {(['jpeg','png','webp'] as const).map(f => (
              <button
                key={f}
                onClick={() => onExport('format', f)}
                className={`text-[10px] px-2 py-1 rounded flex-1 transition-colors ${
                  exp.format === f ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {exp.format !== 'png' && (
          <Slider label="品質" value={Math.round(exp.quality * 100)} min={10} max={100}
            onChange={v => onExport('quality', v / 100)} unit="%" />
        )}

        {/* Watermark */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-400">透かし</span>
            <button
              onClick={() => onExport('watermarkEnabled', !exp.watermarkEnabled)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                exp.watermarkEnabled ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-gray-500'
              }`}
            >
              {exp.watermarkEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {exp.watermarkEnabled && (
            <>
              <input
                type="text"
                value={exp.watermarkText}
                onChange={e => onExport('watermarkText', e.target.value)}
                placeholder="テキストを入力..."
                className="w-full bg-[#2a2a2a] text-white text-xs px-2 py-1.5 rounded border border-[#3a3a3a] focus:outline-none focus:border-blue-600 mb-1.5"
              />
              <Slider label="不透明度" value={exp.watermarkOpacity} min={5} max={100}
                onChange={v => onExport('watermarkOpacity', v)} unit="%" />
              <Slider label="サイズ" value={exp.watermarkSize} min={8} max={72}
                onChange={v => onExport('watermarkSize', v)} unit="px" />
              <div className="text-[11px] text-gray-400 mb-1">位置</div>
              <div className="grid grid-cols-3 gap-1 text-center">
                {(['topLeft','topRight','center','bottomLeft','bottomRight'] as const).map(pos => {
                  const labels: Record<string, string> = { topLeft:'左上', topRight:'右上', center:'中央', bottomLeft:'左下', bottomRight:'右下' };
                  return (
                    <button
                      key={pos}
                      onClick={() => onExport('watermarkPosition', pos)}
                      className={`text-[10px] py-1 rounded transition-colors ${
                        exp.watermarkPosition === pos ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'
                      }`}
                    >
                      {labels[pos]}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* EXIF */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-gray-400">EXIF情報を削除</span>
          <button
            onClick={() => onExport('removeExif', !exp.removeExif)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              exp.removeExif ? 'bg-green-700 text-green-200' : 'bg-[#2a2a2a] text-gray-500'
            }`}
          >
            {exp.removeExif ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Resize */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-400">リサイズ</span>
            <button
              onClick={() => onExport('resizeEnabled', !exp.resizeEnabled)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                exp.resizeEnabled ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-gray-500'
              }`}
            >
              {exp.resizeEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {exp.resizeEnabled && (
            <div className="flex gap-1 items-center">
              <input type="number" value={exp.resizeWidth} min={100} max={8000}
                onChange={e => onExport('resizeWidth', Number(e.target.value))}
                className="w-full bg-[#2a2a2a] text-white text-xs px-2 py-1 rounded border border-[#3a3a3a] focus:outline-none focus:border-blue-600" />
              <span className="text-gray-500 text-xs">×</span>
              <input type="number" value={exp.resizeHeight} min={100} max={8000}
                onChange={e => onExport('resizeHeight', Number(e.target.value))}
                className="w-full bg-[#2a2a2a] text-white text-xs px-2 py-1 rounded border border-[#3a3a3a] focus:outline-none focus:border-blue-600" />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
