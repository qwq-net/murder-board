import { Panel, useReactFlow, useStore as useFlowStore } from "@xyflow/react";
import { Maximize, Minus, Plus, Redo2, Undo2 } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { useStore } from "zustand";
import { useBoardStore } from "@/store";

// パネル内の 1 ボタン。disabled 時は薄くしてホバーも無効にする
function ControlButton({ className = "", ...rest }: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      className={`flex h-7 min-w-7 cursor-pointer items-center justify-center rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary ${className}`}
      {...rest}
    />
  );
}

// 盤面左下の操作パネル。React Flow 既定の Controls の置き換えで、アイコンをアプリ全体と
// 同じ lucide に統一する。ズームイン・アウト、全体表示、Undo/Redo を備え、
// 中央の倍率表示はクリックで 100% に戻る。Undo/Redo は履歴が無い側を無効表示にする。
// 使われ方: ReactFlow の子として 1 つだけ置く前提。
export function BoardControls() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  // transform の第 3 要素が現在のズーム倍率
  const zoom = useFlowStore((s) => s.transform[2]);
  const canUndo = useStore(useBoardStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useBoardStore.temporal, (s) => s.futureStates.length > 0);

  return (
    <Panel
      position="bottom-left"
      className="flex items-center gap-0.5 rounded-md border border-border-default bg-bg-elevated p-1 shadow-lg"
    >
      <ControlButton title="縮小" aria-label="縮小" onClick={() => void zoomOut()}>
        <Minus size={14} />
      </ControlButton>
      <ControlButton
        title="100% に戻す"
        aria-label="ズームを 100% に戻す"
        className="px-1 font-mono text-xs tabular-nums"
        onClick={() => void zoomTo(1, { duration: 150 })}
      >
        {Math.round(zoom * 100)}%
      </ControlButton>
      <ControlButton title="拡大" aria-label="拡大" onClick={() => void zoomIn()}>
        <Plus size={14} />
      </ControlButton>
      <div className="mx-0.5 h-4 w-px bg-border-default" />
      <ControlButton
        title="全体を表示"
        aria-label="全体を表示"
        onClick={() => void fitView({ duration: 200 })}
      >
        <Maximize size={14} />
      </ControlButton>
      <div className="mx-0.5 h-4 w-px bg-border-default" />
      <ControlButton
        title="元に戻す"
        aria-label="元に戻す"
        disabled={!canUndo}
        onClick={() => useBoardStore.temporal.getState().undo()}
      >
        <Undo2 size={14} />
      </ControlButton>
      <ControlButton
        title="やり直す"
        aria-label="やり直す"
        disabled={!canRedo}
        onClick={() => useBoardStore.temporal.getState().redo()}
      >
        <Redo2 size={14} />
      </ControlButton>
    </Panel>
  );
}
