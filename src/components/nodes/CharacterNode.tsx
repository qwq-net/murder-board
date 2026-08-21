import type { NodeProps } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useState } from "react";
import {
  AddRowButton,
  CommitInput,
  NodeRow,
  NodeShell,
  useNodeWidth,
} from "@/components/nodes/NodeShell";
import { useBoardStore } from "@/store";
import { STICKY_COLORS, type CharacterEntry, type CharacterNodeType } from "@/types/board";

// 付箋 6 色の中で次の色を返す。末尾の次は先頭に戻る
const nextColor = (c: CharacterEntry["color"]) =>
  STICKY_COLORS[(STICKY_COLORS.indexOf(c) + 1) % STICKY_COLORS.length]!;

// 登場人物メモ。リスト付箋の各行に識別色ドットが付いた形で、ドットのクリックで色が循環する。
// 行の追加時は前の行の次の色を割り当て、隣り合う行の色が自然にずれるようにする。
export function CharacterNode({ id, data, selected }: NodeProps<CharacterNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  // 追加直後の行だけマウント時から編集で始めるための印
  const [newRowId, setNewRowId] = useState<string | null>(null);

  const patchEntry = (entryId: string, patch: Partial<CharacterEntry>) =>
    updateNodeData(id, "character", {
      entries: data.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
    });

  const addRow = () => {
    const last = data.entries[data.entries.length - 1];
    const rowId = nanoid();
    setNewRowId(rowId);
    updateNodeData(id, "character", {
      entries: [
        ...data.entries,
        { id: rowId, text: "", color: last ? nextColor(last.color) : "yellow" },
      ],
    });
  };

  const removeRow = (entryId: string) =>
    updateNodeData(id, "character", { entries: data.entries.filter((e) => e.id !== entryId) });

  const width = useNodeWidth("character");

  return (
    <NodeShell
      selected={selected}
      frameClassName="border-panel-character-accent/40 bg-bg-panel"
      frameStyle={{ width }}
      headerClassName="bg-panel-character-accent/15"
      title={data.title}
      titlePlaceholder="登場人物"
      onTitleCommit={(title) => updateNodeData(id, "character", { title })}
    >
      <div className="p-1">
        {data.entries.map((entry) => (
          <NodeRow key={entry.id} onRemove={() => removeRow(entry.id)}>
            <button
              type="button"
              title="クリックで色を変更"
              aria-label={`色: ${entry.color}`}
              className="nodrag h-3.5 w-3.5 shrink-0 cursor-pointer rounded-full"
              style={{ background: `var(--sticky-${entry.color}-accent)` }}
              onClick={() => patchEntry(entry.id, { color: nextColor(entry.color) })}
            />
            <CommitInput
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={entry.text}
              placeholder="名前"
              defaultEditing={entry.id === newRowId}
              onCommit={(text) => patchEntry(entry.id, { text })}
            />
          </NodeRow>
        ))}
        <AddRowButton className="text-panel-character-accent" onClick={addRow} />
      </div>
    </NodeShell>
  );
}
