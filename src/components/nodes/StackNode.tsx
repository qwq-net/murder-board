import type { NodeProps } from "@xyflow/react";
import { NodeShell } from "@/components/nodes/NodeShell";
import { useBoardStore } from "@/store";
import type { StackNodeType } from "@/types/board";

// スタックノード。本文を持たない入れ物で、サイズは stackLayout が node.width/height で
// 管理するため、枠は h-full/w-full でラッパーに追従させる。子が無いときだけ
// ドロップを促すプレースホルダを表示する。子ノード自体は React Flow が親相対で描画する。
export function StackNode({ id, data, selected }: NodeProps<StackNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  const hasChildren = useBoardStore((s) => s.nodes.some((n) => n.parentId === id));
  return (
    <NodeShell
      selected={selected}
      frameClassName="h-full w-full border-dashed border-border-default bg-bg-elevated/60"
      headerClassName="bg-bg-hover"
      title={data.title}
      titlePlaceholder="スタック名"
      onTitleCommit={(title) => updateNodeData(id, "stack", { title })}
    >
      {!hasChildren && (
        <div className="flex h-14 items-center justify-center text-xs text-text-muted">
          ここにメモをドロップ
        </div>
      )}
    </NodeShell>
  );
}
