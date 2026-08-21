import type { NodeProps } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { StyledText } from "@/components/nodes/StyledText";
import {
  AddRowButton,
  ColorPalette,
  CommitInput,
  NodeRow,
  NodeShell,
  nodeAccentStyle,
  useNodeWidth,
} from "@/components/nodes/NodeShell";
import { useBoardStore } from "@/store";
import type { ListNodeType } from "@/types/board";

// リスト付箋。プレーンテキスト行の追加・削除ができ、並び順は登録順のまま。
// 行の確定は blur。タイムライン付箋と違い、時刻もソートも持たない。
// 枠・ヘッダ・縦線・追加ボタンの配色は --node-accent 変数 1 本で決まり、
// data.color があれば付箋カラー、無ければリスト既定色になる。
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

  const accent = data.color
    ? `var(--sticky-${data.color}-accent)`
    : "var(--color-panel-list-accent)";
  const width = useNodeWidth("list");

  return (
    <NodeShell
      selected={selected}
      frameClassName="border-(--node-accent)/40 bg-bg-panel"
      frameStyle={{ ...nodeAccentStyle(accent), width }}
      headerClassName="bg-(--node-accent)/15"
      title={data.title}
      titlePlaceholder="リスト"
      onTitleCommit={(title) => updateNodeData(id, "list", { title })}
    >
      {selected && (
        <ColorPalette
          color={data.color}
          defaultSwatch="var(--color-panel-list-accent)"
          onPick={(color) => updateNodeData(id, "list", { color })}
        />
      )}
      <div className="p-1">
        {data.entries.map((entry) => (
          <NodeRow
            key={entry.id}
            className="pl-2 before:absolute before:top-1 before:bottom-1 before:left-0.5 before:w-[3px] before:rounded-sm before:bg-(--node-accent)/45"
            onRemove={() => removeRow(entry.id)}
          >
            <CommitInput
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={entry.text}
              placeholder="項目"
              defaultEditing={entry.id === newRowId}
              renderText={(text) => <StyledText text={text} />}
              onCommit={(text) => commitEntry(entry.id, text)}
            />
          </NodeRow>
        ))}
        <AddRowButton className="text-(--node-accent)" onClick={addRow} />
      </div>
    </NodeShell>
  );
}
