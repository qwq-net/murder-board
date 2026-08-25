import type { NodeProps } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { AddRowButton, CommitInput, NodeRow } from "@/components/nodes/CommitInput";
import { PanelNodeShell } from "@/components/nodes/PanelNodeShell";
import { StyledText } from "@/components/nodes/StyledText";
import { moveItem } from "@/lib/moveItem";
import { useBoardStore } from "@/store";
import type { KeywordNodeType } from "@/types/board";

// キーワード付箋。操作は行の Enter 連鎖・空行の自動削除を含めリスト付箋と同じで、
// 登録された言葉が本文中で検索リンクになる。
// リンク化は StyledText 側の仕事。自ノードの行は plainLinks で色付けだけにし、
// 下線とクリックの検索は付けない。登録の場では一覧性と編集のしやすさを優先するため。
// 配色は --node-accent 変数 1 本で決まり、data.color があれば付箋カラー、
// 無ければキーワード既定色になる。
export function KeywordNode({ id, data, selected }: NodeProps<KeywordNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  // 追加直後の行だけマウント時から編集で始めるための印
  const [newRowId, setNewRowId] = useState<string | null>(null);

  const commitEntry = (entryId: string, text: string) =>
    updateNodeData(id, "keyword", {
      entries: data.entries.map((e) => (e.id === entryId ? { ...e, text } : e)),
    });

  // Enter 確定を 1 回の更新で反映する。テキストを確定しつつ直後へ空行を挿入して
  // 編集を始める。空の確定では挿入せず false を返し、既定の確定処理に任せる
  const commitAndAddNext = (entryId: string, text: string) => {
    if (text === "") return false;
    const rowId = nanoid();
    setNewRowId(rowId);
    updateNodeData(id, "keyword", {
      entries: data.entries.flatMap((e) =>
        e.id === entryId
          ? [
              { ...e, text },
              { id: rowId, text: "" },
            ]
          : [e],
      ),
    });
    return true;
  };

  const addRow = () => {
    const rowId = nanoid();
    setNewRowId(rowId);
    updateNodeData(id, "keyword", { entries: [...data.entries, { id: rowId, text: "" }] });
  };

  const removeRow = (entryId: string) =>
    updateNodeData(id, "keyword", { entries: data.entries.filter((e) => e.id !== entryId) });

  const moveRow = (from: number, to: number) =>
    updateNodeData(id, "keyword", { entries: moveItem(data.entries, from, to) });

  return (
    <PanelNodeShell
      kind="keyword"
      selected={selected}
      color={data.color}
      title={data.title}
      titleEnterToBody={data.entries.every((e) => e.text === "")}
      onTitleEnterFallback={addRow}
      onTitleCommit={(title) => updateNodeData(id, "keyword", { title })}
      onColorPick={(color) => updateNodeData(id, "keyword", { color })}
    >
      <div className="p-1">
        {data.entries.map((entry, i) => (
          <NodeRow
            key={entry.id}
            className="pl-2 before:absolute before:top-1 before:bottom-1 before:left-0.5 before:w-[3px] before:rounded-sm before:bg-(--node-accent)/45"
            onRemove={() => removeRow(entry.id)}
            reorder={{ group: id, index: i, onMove: moveRow }}
          >
            <CommitInput
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={entry.text}
              placeholder="言葉"
              defaultEditing={entry.id === newRowId}
              renderText={(text) => <StyledText text={text} plainLinks />}
              onCommit={(text) => commitEntry(entry.id, text)}
              onEnter={(text) => commitAndAddNext(entry.id, text)}
              onEmptyExit={() => removeRow(entry.id)}
            />
          </NodeRow>
        ))}
        <AddRowButton className="text-(--node-accent)" onClick={addRow} />
      </div>
    </PanelNodeShell>
  );
}
