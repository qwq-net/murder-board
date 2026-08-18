import type { NodeProps } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { AddRowButton, CommitInput, NodeRow, NodeShell } from "@/components/nodes/NodeShell";
import { useBoardStore } from "@/store";
import type { ListNodeType } from "@/types/board";

// リスト付箋。プレーンテキスト行の追加・削除ができ、並び順は登録順のまま。
// 行の確定は blur。タイムライン付箋と違い、時刻もソートも持たない。
export function ListNode({ id, data, selected }: NodeProps<ListNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  // 追加直後の行だけマウント時から編集で始めるための印
  const [newRowId, setNewRowId] = useState<string | null>(null);

  const commitEntry = (entryId: string, text: string) =>
    updateNodeData(id, "list", {
      entries: data.entries.map((e) => (e.id === entryId ? { ...e, text } : e)),
    });

  const addRow = () => {
    const rowId = nanoid();
    setNewRowId(rowId);
    updateNodeData(id, "list", { entries: [...data.entries, { id: rowId, text: "" }] });
  };

  const removeRow = (entryId: string) =>
    updateNodeData(id, "list", { entries: data.entries.filter((e) => e.id !== entryId) });

  return (
    <NodeShell
      selected={selected}
      frameClassName="w-72 border-panel-list-accent/40 bg-bg-panel"
      headerClassName="bg-panel-list-accent/15"
      title={data.title}
      titlePlaceholder="リスト"
      onTitleCommit={(title) => updateNodeData(id, "list", { title })}
    >
      <div className="p-1">
        {data.entries.map((entry) => (
          <NodeRow key={entry.id} onRemove={() => removeRow(entry.id)}>
            <CommitInput
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={entry.text}
              placeholder="項目"
              defaultEditing={entry.id === newRowId}
              onCommit={(text) => commitEntry(entry.id, text)}
            />
          </NodeRow>
        ))}
        <AddRowButton className="text-panel-list-accent" onClick={addRow} />
      </div>
    </NodeShell>
  );
}
