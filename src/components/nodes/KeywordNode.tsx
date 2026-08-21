import type { NodeProps } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useState } from "react";
import {
  AddRowButton,
  ColorPalette,
  CommitInput,
  NodeRow,
  NodeShell,
  nodeAccentStyle,
  useNodeWidth,
} from "@/components/nodes/NodeShell";
import { StyledText } from "@/components/nodes/StyledText";
import { useBoardStore } from "@/store";
import type { KeywordNodeType } from "@/types/board";

// キーワード付箋。操作はリスト付箋と同じで、登録された言葉が本文中で検索リンクになる。
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

  const addRow = () => {
    const rowId = nanoid();
    setNewRowId(rowId);
    updateNodeData(id, "keyword", { entries: [...data.entries, { id: rowId, text: "" }] });
  };

  const removeRow = (entryId: string) =>
    updateNodeData(id, "keyword", { entries: data.entries.filter((e) => e.id !== entryId) });

  const accent = data.color
    ? `var(--sticky-${data.color}-accent)`
    : "var(--color-panel-keyword-accent)";
  const width = useNodeWidth("keyword");

  return (
    <NodeShell
      selected={selected}
      frameClassName="border-(--node-accent)/40 bg-bg-panel"
      frameStyle={{ ...nodeAccentStyle(accent), width }}
      headerClassName="bg-(--node-accent)/15"
      title={data.title}
      titlePlaceholder="キーワード"
      onTitleCommit={(title) => updateNodeData(id, "keyword", { title })}
    >
      {selected && (
        <ColorPalette
          color={data.color}
          defaultSwatch="var(--color-panel-keyword-accent)"
          onPick={(color) => updateNodeData(id, "keyword", { color })}
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
              placeholder="言葉"
              defaultEditing={entry.id === newRowId}
              renderText={(text) => <StyledText text={text} plainLinks />}
              onCommit={(text) => commitEntry(entry.id, text)}
            />
          </NodeRow>
        ))}
        <AddRowButton className="text-(--node-accent)" onClick={addRow} />
      </div>
    </NodeShell>
  );
}
