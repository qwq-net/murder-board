import type { NodeProps } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { ColorPalette } from "@/components/nodes/ColorPalette";
import { AddRowButton, CommitInput, NodeRow } from "@/components/nodes/CommitInput";
import { PanelNodeShell } from "@/components/nodes/PanelNodeShell";
import { StyledText } from "@/components/nodes/StyledText";
import { moveItem } from "@/lib/moveItem";
import { useBoardStore } from "@/store";
import {
  DEFAULT_NODE_COLORS,
  STICKY_COLORS,
  type CharacterEntry,
  type CharacterNodeType,
} from "@/types/board";

// 付箋パレットの中で次の色を返す。末尾の次は先頭に戻る
const nextColor = (c: CharacterEntry["color"]) =>
  STICKY_COLORS[(STICKY_COLORS.indexOf(c) + 1) % STICKY_COLORS.length]!;

// 登場人物メモ。リスト付箋の各行に識別色ドットが付いた形で、ドットのクリックで
// その行の上にカラーパレットが開き、任意の色を選べる。
// 行の Enter 連鎖と空行の自動削除はリスト付箋と同じ。
// 行の追加時は前の行の次の色を割り当て、隣り合う行の色が自然にずれるようにする。
// 行の名前自体にも本文と同じ装飾が効くため、登録した名前はその識別色で表示される。
export function CharacterNode({ id, data, selected }: NodeProps<CharacterNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  // 追加直後の行だけマウント時から編集で始めるための印
  const [newRowId, setNewRowId] = useState<string | null>(null);
  // 色パレットを開いている行。null なら全部閉じている
  const [paletteRowId, setPaletteRowId] = useState<string | null>(null);

  // パレットの外側クリックで閉じる。ドットのクリックは stopPropagation で先に処理される
  useEffect(() => {
    if (paletteRowId === null) return;
    const close = () => setPaletteRowId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [paletteRowId]);

  const patchEntry = (entryId: string, patch: Partial<CharacterEntry>) =>
    updateNodeData(id, "character", {
      entries: data.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
    });

  // Enter 確定を 1 回の更新で反映する。名前を確定しつつ直後へ次の色の空行を挿入して
  // 編集を始める。空の確定では挿入せず false を返し、既定の確定処理に任せる
  const commitAndAddNext = (entryId: string, text: string) => {
    if (text === "") return false;
    const rowId = nanoid();
    setNewRowId(rowId);
    updateNodeData(id, "character", {
      entries: data.entries.flatMap((e) =>
        e.id === entryId
          ? [
              { ...e, text },
              { id: rowId, text: "", color: nextColor(e.color) },
            ]
          : [e],
      ),
    });
    return true;
  };

  const addRow = () => {
    const last = data.entries[data.entries.length - 1];
    const rowId = nanoid();
    setNewRowId(rowId);
    updateNodeData(id, "character", {
      entries: [
        ...data.entries,
        {
          id: rowId,
          text: "",
          color: last ? nextColor(last.color) : DEFAULT_NODE_COLORS.character,
        },
      ],
    });
  };

  const removeRow = (entryId: string) =>
    updateNodeData(id, "character", { entries: data.entries.filter((e) => e.id !== entryId) });

  const moveRow = (from: number, to: number) =>
    updateNodeData(id, "character", { entries: moveItem(data.entries, from, to) });

  return (
    <PanelNodeShell
      kind="character"
      selected={selected}
      color={data.color}
      title={data.title}
      titleEnterToBody={data.entries.every((e) => e.text === "")}
      onTitleEnterFallback={addRow}
      onTitleCommit={(title) => updateNodeData(id, "character", { title })}
      onColorPick={(color) => updateNodeData(id, "character", { color })}
    >
      <div className="p-1">
        {data.entries.map((entry, i) => (
          <NodeRow
            key={entry.id}
            onRemove={() => removeRow(entry.id)}
            reorder={{ group: id, index: i, onMove: moveRow }}
          >
            <button
              type="button"
              title="クリックで色を選択"
              aria-label={`色: ${entry.color}`}
              className="nodrag h-3.5 w-3.5 shrink-0 cursor-pointer rounded-full"
              style={{ background: `var(--sticky-${entry.color}-accent)` }}
              onClick={(e) => {
                // 直後に window へ届くクリックでパレットが即閉じしないよう、ここで止める
                e.stopPropagation();
                setPaletteRowId(paletteRowId === entry.id ? null : entry.id);
              }}
            />
            {paletteRowId === entry.id && (
              <ColorPalette
                color={entry.color}
                position="left"
                onPick={(color) => {
                  if (color) patchEntry(entry.id, { color });
                  setPaletteRowId(null);
                }}
              />
            )}
            <CommitInput
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={entry.text}
              placeholder="名前"
              defaultEditing={entry.id === newRowId}
              renderText={(text) => <StyledText text={text} />}
              onCommit={(text) => patchEntry(entry.id, { text })}
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
