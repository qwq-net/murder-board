import type { NodeProps } from "@xyflow/react";
import { ColorPalette } from "@/components/nodes/ColorPalette";
import { nodeAccentStyle } from "@/components/nodes/nodeMeta";
import { NodeShell } from "@/components/nodes/NodeShell";
import { useBoardStore } from "@/store";
import type { StackNodeType } from "@/types/board";

// スタックノード。本文を持たない入れ物で、サイズは stackLayout が node.width/height で
// 管理するため、枠は h-full/w-full でラッパーに追従させる。子が無いときだけ
// ドロップを促すプレースホルダを表示する。子ノード自体は React Flow が親相対で描画する。
// data.color があれば枠とヘッダを付箋カラーで彩色し、無ければ無彩色の既定枠のまま。
export function StackNode({ id, data, selected }: NodeProps<StackNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  const hasChildren = useBoardStore((s) => s.nodes.some((n) => n.parentId === id));
  return (
    <NodeShell
      selected={selected}
      frameClassName={`h-full w-full border-dashed bg-bg-elevated/60 ${
        data.color ? "border-(--node-accent)/50" : "border-border-default"
      }`}
      frameStyle={data.color ? nodeAccentStyle(`var(--sticky-${data.color}-accent)`) : undefined}
      headerClassName={data.color ? "bg-(--node-accent)/15" : "bg-bg-hover"}
      title={data.title}
      titlePlaceholder="メモスタック"
      titleSingleLine
      onTitleCommit={(title) => updateNodeData(id, "stack", { title })}
    >
      {selected && (
        <ColorPalette
          color={data.color}
          defaultSwatch="var(--color-border-default)"
          onPick={(color) => updateNodeData(id, "stack", { color })}
        />
      )}
      {!hasChildren && (
        <div className="flex h-14 items-center justify-center text-xs text-text-muted">
          ここにメモをドロップ
        </div>
      )}
    </NodeShell>
  );
}
