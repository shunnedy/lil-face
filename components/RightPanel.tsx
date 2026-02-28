'use client';
import { useState } from 'react';
import {
  EditorState, Adjustments, FaceAdjustments, SkinSettings,
  LiquifySettings, FilterPreset, ExportSettings, BodyAdjustments, BodyAnchors,
} from '@/types/editor';
import { FILTER_LIST, FILTER_DEFS } from '@/lib/filters';

// ---- Reusable Slider ----
function Slider({
  label, value, min, max, step = 1, unit = '', onChange, onReset, onCommit,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  unit?: string; onChange: (v: number) => void; onReset?: () => void; onCommit?: () => void;
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
        onMouseUp={onCommit}
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
  onAdjustmentCommit?: () => void;
  onFaceCommit?: () => void;
  onBodyAdj: (key: keyof BodyAdjustments, value: number) => void;
  onBodyAnchorPlace: (anchor: 'chest' | 'leftThigh' | 'rightThigh') => void;
  onBodyAnchorDelete: (anchor: keyof BodyAnchors) => void;
  onResetBodyAdj: () => void;
  onBodyAdjCommit?: () => void;
}

export default function RightPanel({
  state, onAdjustment, onFace, onSkin, onLiquify, onFilter,
  onExport, onResetAdjustments, onResetFace, onResetLiquify, onResetSkinMask,
  onAdjustmentCommit, onFaceCommit,
  onBodyAdj, onBodyAnchorPlace, onBodyAnchorDelete, onResetBodyAdj, onBodyAdjCommit,
}: Props) {
  const { adjustments: adj, faceAdjustments: face, skinSettings: skin,
    liquifySettings: liq, exportSettings: exp,
    bodyAdjustments: bodyAdj, bodyAnchors } = state;

  return (
    <div className="w-[272px] bg-[#1c1c1c] border-l border-[#333] overflow-y-auto flex-shrink-0 flex flex-col text-sm">

      {/* === COLOR === */}
      <Section title="色調補正" icon="🎨" defaultOpen>
        <div className="flex justify-end mb-1">
          <button onClick={onResetAdjustments} className="text-[10px] text-gray-500 hover:text-red-400">リセット</button>
        </div>
        <Slider label="明るさ" value={adj.brightness} min={-100} max={100}
          onChange={v => onAdjustment('brightness', v)} onReset={() => onAdjustment('brightness', 0)} onCommit={onAdjustmentCommit} />
        <Slider label="コントラスト" value={adj.contrast} min={-100} max={100}
          onChange={v => onAdjustment('contrast', v)} onReset={() => onAdjustment('contrast', 0)} onCommit={onAdjustmentCommit} />
        <Slider label="彩度" value={adj.saturation} min={-100} max={100}
          onChange={v => onAdjustment('saturation', v)} onReset={() => onAdjustment('saturation', 0)} onCommit={onAdjustmentCommit} />
        <Slider label="色温度（暖かさ）" value={adj.warmth} min={-100} max={100}
          onChange={v => onAdjustment('warmth', v)} onReset={() => onAdjustment('warmth', 0)} onCommit={onAdjustmentCommit} />
        <Slider label="露出" value={adj.exposure} min={-2} max={2} step={0.05}
          onChange={v => onAdjustment('exposure', v)} onReset={() => onAdjustment('exposure', 0)} onCommit={onAdjustmentCommit} />
        <Slider label="シャドウ" value={adj.shadows} min={-100} max={100}
          onChange={v => onAdjustment('shadows', v)} onReset={() => onAdjustment('shadows', 0)} onCommit={onAdjustmentCommit} />
        <Slider label="ハイライト" value={adj.highlights} min={-100} max={100}
          onChange={v => onAdjustment('highlights', v)} onReset={() => onAdjustment('highlights', 0)} onCommit={onAdjustmentCommit} />
        <Slider label="クラリティ" value={adj.clarity} min={0} max={100}
          onChange={v => onAdjustment('clarity', v)} onReset={() => onAdjustment('clarity', 0)} onCommit={onAdjustmentCommit} />
        <Slider label="シャープネス" value={adj.sharpness} min={0} max={100}
          onChange={v => onAdjustment('sharpness', v)} onReset={() => onAdjustment('sharpness', 0)} onCommit={onAdjustmentCommit} />
        <Slider label="ビネット" value={adj.vignette} min={0} max={100}
          onChange={v => onAdjustment('vignette', v)} onReset={() => onAdjustment('vignette', 0)} onCommit={onAdjustmentCommit} />
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
          onChange={v => onFace('smallFace', v)} onReset={() => onFace('smallFace', 0)} onCommit={onFaceCommit} />
        <Slider label="エラ削り" value={face.slimJaw} min={0} max={100}
          onChange={v => onFace('slimJaw', v)} onReset={() => onFace('slimJaw', 0)} onCommit={onFaceCommit} />
        <Slider label="顎の長さ" value={face.chinLength} min={-50} max={50}
          onChange={v => onFace('chinLength', v)} onReset={() => onFace('chinLength', 0)} onCommit={onFaceCommit} />
        <Slider label="フェイスライン整え" value={face.jawlineSmooth} min={0} max={100}
          onChange={v => onFace('jawlineSmooth', v)} onReset={() => onFace('jawlineSmooth', 0)} onCommit={onFaceCommit} />

        <div className="text-[10px] text-gray-500 mb-1 mt-2 font-medium">頭・生え際</div>
        <Slider label="頭の大きさ" value={face.headSize} min={-50} max={50}
          onChange={v => onFace('headSize', v)} onReset={() => onFace('headSize', 0)} onCommit={onFaceCommit} />
        <Slider label="生え際の高さ" value={face.hairlineHeight} min={-50} max={50}
          onChange={v => onFace('hairlineHeight', v)} onReset={() => onFace('hairlineHeight', 0)} onCommit={onFaceCommit} />

        <div className="text-[10px] text-gray-500 mb-1 mt-2 font-medium">目</div>
        <Slider label="目の大きさ" value={face.eyeSize} min={0} max={100}
          onChange={v => onFace('eyeSize', v)} onReset={() => onFace('eyeSize', 0)} onCommit={onFaceCommit} />
        <Slider label="目の横幅" value={face.eyeWidth} min={-50} max={50}
          onChange={v => onFace('eyeWidth', v)} onReset={() => onFace('eyeWidth', 0)} onCommit={onFaceCommit} />
        <Slider label="目の縦幅" value={face.eyeVertical} min={-50} max={50}
          onChange={v => onFace('eyeVertical', v)} onReset={() => onFace('eyeVertical', 0)} onCommit={onFaceCommit} />
        <Slider label="目の高さ" value={face.eyeHeight} min={-50} max={50}
          onChange={v => onFace('eyeHeight', v)} onReset={() => onFace('eyeHeight', 0)} onCommit={onFaceCommit} />
        <Slider label="目と目の距離" value={face.eyeSpacing} min={-50} max={50}
          onChange={v => onFace('eyeSpacing', v)} onReset={() => onFace('eyeSpacing', 0)} onCommit={onFaceCommit} />
        <Slider label="上瞼の膨らみ" value={face.eyeUpperBulge} min={0} max={100}
          onChange={v => onFace('eyeUpperBulge', v)} onReset={() => onFace('eyeUpperBulge', 0)} onCommit={onFaceCommit} />
        <Slider label="下瞼の拡張" value={face.eyeLowerExpand} min={0} max={100}
          onChange={v => onFace('eyeLowerExpand', v)} onReset={() => onFace('eyeLowerExpand', 0)} onCommit={onFaceCommit} />
        <Slider label="目の傾き（+つり目 / -たれ目）" value={face.eyeTilt} min={-50} max={50}
          onChange={v => onFace('eyeTilt', v)} onReset={() => onFace('eyeTilt', 0)} onCommit={onFaceCommit} />

        <div className="text-[10px] text-gray-500 mb-1 mt-2 font-medium">眉毛</div>
        <Slider label="眉毛の高さ" value={face.eyebrowHeight} min={-50} max={50}
          onChange={v => onFace('eyebrowHeight', v)} onReset={() => onFace('eyebrowHeight', 0)} onCommit={onFaceCommit} />
        <Slider label="眉毛の太さ" value={face.eyebrowThickness} min={-50} max={50}
          onChange={v => onFace('eyebrowThickness', v)} onReset={() => onFace('eyebrowThickness', 0)} onCommit={onFaceCommit} />
        <Slider label="眉毛の長さ" value={face.eyebrowLength} min={-50} max={50}
          onChange={v => onFace('eyebrowLength', v)} onReset={() => onFace('eyebrowLength', 0)} onCommit={onFaceCommit} />
        <Slider label="眉尻の長さ" value={face.eyebrowTailLength} min={-50} max={50}
          onChange={v => onFace('eyebrowTailLength', v)} onReset={() => onFace('eyebrowTailLength', 0)} onCommit={onFaceCommit} />
        <Slider label="眉頭の長さ" value={face.eyebrowHeadLength} min={-50} max={50}
          onChange={v => onFace('eyebrowHeadLength', v)} onReset={() => onFace('eyebrowHeadLength', 0)} onCommit={onFaceCommit} />
        <Slider label="眉毛の傾き" value={face.eyebrowTilt} min={-50} max={50}
          onChange={v => onFace('eyebrowTilt', v)} onReset={() => onFace('eyebrowTilt', 0)} onCommit={onFaceCommit} />
        <Slider label="眉山の高さ" value={face.eyebrowPeakHeight} min={-50} max={50}
          onChange={v => onFace('eyebrowPeakHeight', v)} onReset={() => onFace('eyebrowPeakHeight', 0)} onCommit={onFaceCommit} />

        <div className="text-[10px] text-gray-500 mb-1 mt-2 font-medium">鼻</div>
        <Slider label="鼻翼幅" value={face.noseSlim} min={0} max={100}
          onChange={v => onFace('noseSlim', v)} onReset={() => onFace('noseSlim', 0)} onCommit={onFaceCommit} />
        <Slider label="鼻先の上下" value={face.noseTip} min={-50} max={50}
          onChange={v => onFace('noseTip', v)} onReset={() => onFace('noseTip', 0)} onCommit={onFaceCommit} />
        <Slider label="鼻根の太さ" value={face.noseRootWidth} min={-50} max={50}
          onChange={v => onFace('noseRootWidth', v)} onReset={() => onFace('noseRootWidth', 0)} onCommit={onFaceCommit} />
        <Slider label="鼻筋の太さ" value={face.noseBridgeWidth} min={-50} max={50}
          onChange={v => onFace('noseBridgeWidth', v)} onReset={() => onFace('noseBridgeWidth', 0)} onCommit={onFaceCommit} />
        <Slider label="鼻先の太さ" value={face.noseTipWidth} min={-50} max={50}
          onChange={v => onFace('noseTipWidth', v)} onReset={() => onFace('noseTipWidth', 0)} onCommit={onFaceCommit} />

        <div className="text-[10px] text-gray-500 mb-1 mt-2 font-medium">唇・口</div>
        <Slider label="唇の厚み" value={face.lipThickness} min={-50} max={50}
          onChange={v => onFace('lipThickness', v)} onReset={() => onFace('lipThickness', 0)} onCommit={onFaceCommit} />
        <Slider label="口角" value={face.mouthCorner} min={-50} max={50}
          onChange={v => onFace('mouthCorner', v)} onReset={() => onFace('mouthCorner', 0)} onCommit={onFaceCommit} />
        <Slider label="口の横幅" value={face.mouthWidth} min={-50} max={50}
          onChange={v => onFace('mouthWidth', v)} onReset={() => onFace('mouthWidth', 0)} onCommit={onFaceCommit} />
        <Slider label="口の高さ" value={face.mouthHeight} min={-50} max={50}
          onChange={v => onFace('mouthHeight', v)} onReset={() => onFace('mouthHeight', 0)} onCommit={onFaceCommit} />
        <Slider label="口の左右移動" value={face.mouthShift} min={-50} max={50}
          onChange={v => onFace('mouthShift', v)} onReset={() => onFace('mouthShift', 0)} onCommit={onFaceCommit} />
        <Slider label="M字リップ" value={face.mLip} min={0} max={100}
          onChange={v => onFace('mLip', v)} onReset={() => onFace('mLip', 0)} onCommit={onFaceCommit} />

        <div className="text-[10px] text-gray-500 mb-1 mt-2 font-medium">中顔面</div>
        <Slider label="中顔面短縮" value={face.midFaceShorten} min={0} max={100}
          onChange={v => onFace('midFaceShorten', v)} onReset={() => onFace('midFaceShorten', 0)} onCommit={onFaceCommit} />
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
        <Slider label="テクスチャ保持" value={liq.texturePreservation} min={0} max={100}
          onChange={v => onLiquify('texturePreservation', v)}
          onReset={() => onLiquify('texturePreservation', 0)} />
        <div className="text-[10px] text-gray-500 mb-2 -mt-1">
          網目や格子柄の崩れを抑えます（0=無効、100=最大）
        </div>
        <button
          onClick={onResetLiquify}
          className="w-full mt-1 py-1 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-400 rounded transition-colors"
        >
          ゆがみをリセット
        </button>
      </Section>

      {/* === BODY === */}
      <Section title="ボディ加工" icon="👤" defaultOpen={false}>
        <div className="text-[11px] text-gray-400 mb-2">
          各部位をクリックで設置 → スライダーで調整
        </div>

        {/* Chest */}
        <div className="mb-3">
          <div className="text-[10px] text-gray-500 mb-1 font-medium">胸</div>
          <div className="flex gap-1 mb-1.5">
            <button
              onClick={() => onBodyAnchorPlace('chest')}
              className={`text-[10px] px-2 py-1 rounded flex-1 transition-colors ${
                state.activeTool === 'placeChest'
                  ? 'bg-yellow-600 text-white'
                  : bodyAnchors.chest
                    ? 'bg-green-800 text-green-200 hover:bg-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {state.activeTool === 'placeChest' ? '▶ クリックで設置中…' : bodyAnchors.chest ? '✓ 胸 設置済' : '+ 胸を設置'}
            </button>
            {bodyAnchors.chest && (
              <button
                onClick={() => onBodyAnchorDelete('chest')}
                className="text-[10px] px-2 py-1 rounded bg-[#2a2a2a] text-gray-400 hover:bg-red-900 hover:text-red-300 transition-colors"
              >
                削除
              </button>
            )}
          </div>
          <Slider label="胸の大きさ" value={bodyAdj.chestSize} min={-50} max={50}
            onChange={v => onBodyAdj('chestSize', v)}
            onReset={() => onBodyAdj('chestSize', 0)}
            onCommit={onBodyAdjCommit}
          />
        </div>

        {/* Thighs */}
        <div className="mb-1">
          <div className="text-[10px] text-gray-500 mb-1 font-medium">太もも</div>
          <div className="flex gap-1 mb-1.5">
            <button
              onClick={() => onBodyAnchorPlace('leftThigh')}
              className={`text-[10px] px-2 py-1 rounded flex-1 transition-colors ${
                state.activeTool === 'placeLeftThigh'
                  ? 'bg-yellow-600 text-white'
                  : bodyAnchors.leftThigh
                    ? 'bg-blue-800 text-blue-200 hover:bg-blue-700'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {state.activeTool === 'placeLeftThigh' ? '▶ 設置中…' : bodyAnchors.leftThigh ? '✓ 左もも' : '+ 左もも'}
            </button>
            {bodyAnchors.leftThigh && (
              <button
                onClick={() => onBodyAnchorDelete('leftThigh')}
                className="text-[10px] px-1.5 py-1 rounded bg-[#2a2a2a] text-gray-400 hover:bg-red-900 hover:text-red-300 transition-colors"
              >
                ✕
              </button>
            )}
            <button
              onClick={() => onBodyAnchorPlace('rightThigh')}
              className={`text-[10px] px-2 py-1 rounded flex-1 transition-colors ${
                state.activeTool === 'placeRightThigh'
                  ? 'bg-yellow-600 text-white'
                  : bodyAnchors.rightThigh
                    ? 'bg-green-800 text-green-200 hover:bg-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {state.activeTool === 'placeRightThigh' ? '▶ 設置中…' : bodyAnchors.rightThigh ? '✓ 右もも' : '+ 右もも'}
            </button>
            {bodyAnchors.rightThigh && (
              <button
                onClick={() => onBodyAnchorDelete('rightThigh')}
                className="text-[10px] px-1.5 py-1 rounded bg-[#2a2a2a] text-gray-400 hover:bg-red-900 hover:text-red-300 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          <Slider label="太もも（まとめて）" value={bodyAdj.thighSize} min={-50} max={50}
            onChange={v => onBodyAdj('thighSize', v)}
            onReset={() => onBodyAdj('thighSize', 0)}
            onCommit={onBodyAdjCommit}
          />
          <Slider label="左もも（独立）" value={bodyAdj.leftThighSize} min={-50} max={50}
            onChange={v => onBodyAdj('leftThighSize', v)}
            onReset={() => onBodyAdj('leftThighSize', 0)}
            onCommit={onBodyAdjCommit}
          />
          <Slider label="右もも（独立）" value={bodyAdj.rightThighSize} min={-50} max={50}
            onChange={v => onBodyAdj('rightThighSize', v)}
            onReset={() => onBodyAdj('rightThighSize', 0)}
            onCommit={onBodyAdjCommit}
          />
        </div>
        <button
          onClick={onResetBodyAdj}
          className="w-full mt-1 py-1 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-400 rounded transition-colors"
        >
          ボディをリセット
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
