import type { NodeProps } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AddRowButton, CommitInput, NodeRow } from "@/components/nodes/CommitInput";
import { PanelNodeShell } from "@/components/nodes/PanelNodeShell";
import { StyledText } from "@/components/nodes/StyledText";
import { useCharacterEntries } from "@/components/nodes/useCharacterEntries";
import { useBoardStore } from "@/store";
import type { ActionEntry, ActionLogNodeType, StickyColor } from "@/types/board";

// 選択肢になる登場人物。名前と識別色だけの表示用ビュー
type CharacterChoice = { name: string; color: StickyColor };

// 全登場人物メモの行を選択肢一覧として購読する。同名は先に登録された行だけを残す
const useCharacterChoices = (): CharacterChoice[] => {
  const entries = useCharacterEntries();
  return useMemo(() => {
    const seen = new Set<string>();
    return entries.filter((e) => !seen.has(e.name) && seen.add(e.name));
  }, [entries]);
};

// 登場人物チップ。識別色ドット + 名前の頭 2 文字で、クリックでチップの画面上の
// 矩形を onClick に渡す。ピッカーの表示位置決めに使う。ラベルは全角 2 文字分の
// 固定幅で、名前の文字数や未選択の「？」に左右されず行のレイアウトが揃う。
// 未選択（空文字）は「？」、登場人物メモに見つからない名前は無彩色ドットで示す
function CharacterChip({
  name,
  color,
  onClick,
}: {
  name: string;
  color: StickyColor | undefined;
  onClick: (anchor: DOMRect) => void;
}) {
  return (
    <button
      type="button"
      title={name === "" ? "登場人物を選択" : name}
      className="nodrag flex shrink-0 cursor-pointer items-center gap-1 self-start rounded px-1 hover:bg-bg-active"
      onClick={(e) => {
        // 直後に window へ届くクリックでピッカーが即閉じしないよう、ここで止める
        e.stopPropagation();
        onClick(e.currentTarget.getBoundingClientRect());
      }}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{
          background: color ? `var(--sticky-${color}-accent)` : "var(--color-border-strong)",
        }}
      />
      <span
        className={`inline-block w-7 truncate text-left text-sm ${name === "" ? "text-text-muted" : ""}`}
      >
        {name === "" ? "？" : [...name].slice(0, 2).join("")}
      </span>
    </button>
  );
}

// 登場人物の選択リスト。選択で onPick に名前を渡す。閉じる操作は持たず、開閉は呼び手が管理する。
// body への portal + fixed 配置で描画する前提。ノード内に置くと後続ノードの背面に隠れ、
// React Flow がホイールを奪ってスクロールもできないため、右クリックメニューと同じく
// 最前面へ出し、スクロールなしで全員を表示する
function CharacterPicker({
  choices,
  position,
  onPick,
}: {
  choices: CharacterChoice[];
  position: { x: number; y: number };
  onPick: (name: string) => void;
}) {
  return (
    <div
      className="fixed z-50 min-w-36 rounded border border-border-default bg-bg-elevated py-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      {choices.length === 0 && (
        <div className="px-2.5 py-1 text-xs text-text-muted">
          登場人物メモに名前を登録してください
        </div>
      )}
      {choices.map((c) => (
        <button
          key={c.name}
          type="button"
          className="flex w-full cursor-pointer items-center gap-1.5 px-2.5 py-1 text-left text-sm hover:bg-bg-hover"
          onClick={() => onPick(c.name)}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: `var(--sticky-${c.color}-accent)` }}
          />
          <span className="truncate">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

// どの行のどちら側のピッカーが開いているか。null なら全部閉じている。
// x/y はピッカーを出す画面座標で、開いたときのチップの直下を指す
type Picking = { rowId: string; side: "from" | "to"; x: number; y: number } | null;

// アクションログ付箋。行は「人物 ▶ 人物 ｜メモ」で、人物は登場人物メモ全体から
// クリックで選ぶ。素早い記録を想定し、行の追加もチップの選択もクリックだけで完結する。
// メモは後からダブルクリックで書ける。人物は名前で持つため、登場人物側の改名には追従しない。
// 配色は --node-accent 変数 1 本で決まり、data.color があれば付箋カラー、
// 無ければアクションログ既定色になる。
export function ActionLogNode({ id, data, selected }: NodeProps<ActionLogNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  const choices = useCharacterChoices();
  const [picking, setPicking] = useState<Picking>(null);

  // ピッカーの外側クリックで閉じる。チップ・選択肢のクリックは stopPropagation か
  // 明示的な setPicking で先に処理されるため、ここに届くのは外側のクリックだけ
  useEffect(() => {
    if (picking === null) return;
    const close = () => setPicking(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [picking]);

  const commitEntry = (entryId: string, patch: Partial<Omit<ActionEntry, "id">>) =>
    updateNodeData(id, "actionlog", {
      entries: data.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
    });

  const addRow = () =>
    updateNodeData(id, "actionlog", {
      entries: [...data.entries, { id: nanoid(), from: "", to: "", text: "" }],
    });

  const removeRow = (entryId: string) =>
    updateNodeData(id, "actionlog", { entries: data.entries.filter((e) => e.id !== entryId) });

  const colorOf = (name: string) => choices.find((c) => c.name === name)?.color;

  // チップ。クリックでそのチップの直下にピッカーを開き、開いている側の再クリックは閉じる
  const chipSlot = (entry: ActionEntry, side: "from" | "to") => (
    <CharacterChip
      name={entry[side]}
      color={colorOf(entry[side])}
      onClick={(anchor) =>
        setPicking(
          picking?.rowId === entry.id && picking.side === side
            ? null
            : { rowId: entry.id, side, x: anchor.left, y: anchor.bottom + 2 },
        )
      }
    />
  );

  return (
    <PanelNodeShell
      kind="actionlog"
      selected={selected}
      color={data.color}
      title={data.title}
      onTitleCommit={(title) => updateNodeData(id, "actionlog", { title })}
      onColorPick={(color) => updateNodeData(id, "actionlog", { color })}
    >
      <div className="p-1">
        {data.entries.map((entry) => (
          <NodeRow key={entry.id} onRemove={() => removeRow(entry.id)}>
            {chipSlot(entry, "from")}
            <span className="shrink-0 self-start text-[10px] leading-5 text-text-muted">▶</span>
            {chipSlot(entry, "to")}
            <CommitInput
              className="min-w-0 flex-1 border-l-[3px] border-(--node-accent)/45 bg-transparent pl-1.5 text-sm outline-none"
              value={entry.text}
              placeholder="メモ"
              renderText={(text) => <StyledText text={text} />}
              onCommit={(text) => commitEntry(entry.id, { text })}
            />
          </NodeRow>
        ))}
        <AddRowButton className="text-(--node-accent)" onClick={addRow} />
      </div>
      {picking !== null &&
        createPortal(
          <CharacterPicker
            choices={choices}
            position={picking}
            onPick={(name) => {
              commitEntry(picking.rowId, picking.side === "from" ? { from: name } : { to: name });
              setPicking(null);
            }}
          />,
          document.body,
        )}
    </PanelNodeShell>
  );
}
