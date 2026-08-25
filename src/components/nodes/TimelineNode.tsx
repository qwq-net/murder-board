import type { NodeProps } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { StyledText } from "@/components/nodes/StyledText";
import {
  AddRowButton,
  CommitInput,
  NODE_TEXT_SELECTOR,
  NodeRow,
  requestTextEdit,
} from "@/components/nodes/CommitInput";
import { PanelNodeShell } from "@/components/nodes/PanelNodeShell";
import { autoCompleteTime, sortTimelineEntries } from "@/lib/timeParser";
import { useBoardStore } from "@/store";
import type { TimelineEntry, TimelineNodeType } from "@/types/board";

// タイムライン付箋。行は「時刻 + 出来事」で、時刻の確定時に自動補完・昇順ソートされる。
// 確定のタイミングは blur。時刻を解釈できない行は末尾に並ぶ。空欄や自由記述がこれにあたる。
// 時刻の Enter は確定に続けて同じ行の出来事の編集へ移る。
// 出来事の Enter 確定は末尾に空行を足してその時刻の編集を始め、時刻・出来事とも
// 空のままフォーカスが行の外へ出た行は自動で消える。
// 並びは時刻ソートで決まるため、行の手動並び替えは持たない。
// 配色は --node-accent 変数 1 本で決まり、data.color があれば付箋カラー、
// 無ければタイムライン既定色になる。
export function TimelineNode({ id, data, selected }: NodeProps<TimelineNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  // 追加直後の行だけマウント時から編集で始めるための印
  const [newRowId, setNewRowId] = useState<string | null>(null);

  const commitEntry = (entryId: string, patch: Partial<Omit<TimelineEntry, "id">>) =>
    updateNodeData(id, "timeline", {
      entries: sortTimelineEntries(
        data.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
      ),
    });

  // Enter 確定を 1 回の更新で反映する。出来事を確定してソートしつつ末尾へ空行を足し、
  // その時刻の編集を始める。空の確定では足さず false を返し、既定の確定処理に任せる
  const commitAndAddNext = (entryId: string, text: string) => {
    if (text === "") return false;
    const rowId = nanoid();
    setNewRowId(rowId);
    updateNodeData(id, "timeline", {
      entries: [
        ...sortTimelineEntries(data.entries.map((e) => (e.id === entryId ? { ...e, text } : e))),
        { id: rowId, time: "", text: "" },
      ],
    });
    return true;
  };

  const addRow = () => {
    const rowId = nanoid();
    setNewRowId(rowId);
    updateNodeData(id, "timeline", {
      entries: [...data.entries, { id: rowId, time: "", text: "" }],
    });
  };

  const removeRow = (entryId: string) =>
    updateNodeData(id, "timeline", { entries: data.entries.filter((e) => e.id !== entryId) });

  return (
    <PanelNodeShell
      kind="timeline"
      selected={selected}
      color={data.color}
      title={data.title}
      titleEnterToBody={data.entries.every((e) => e.time === "" && e.text === "")}
      onTitleEnterFallback={addRow}
      onTitleCommit={(title) => updateNodeData(id, "timeline", { title })}
      onColorPick={(color) => updateNodeData(id, "timeline", { color })}
    >
      <div className="p-1">
        {data.entries.map((entry) => (
          <NodeRow key={entry.id} onRemove={() => removeRow(entry.id)}>
            <CommitInput
              className="w-12 shrink-0 self-start bg-transparent text-center font-mono text-xs leading-5 text-text-muted outline-none"
              value={entry.time}
              placeholder="--:--"
              normalize={autoCompleteTime}
              defaultEditing={entry.id === newRowId}
              onCommit={(time) => commitEntry(entry.id, { time })}
              onEnter={(time, el) => {
                // 時刻を確定し、同じ行の出来事の編集へ続ける。ソートで行が動いても
                // DOM 要素は同一なので、移動後の行にそのまま効く
                const textEl = el
                  .closest("[data-node-row]")
                  ?.querySelectorAll(NODE_TEXT_SELECTOR)[1];
                if (!textEl) return false;
                if (time !== entry.time) commitEntry(entry.id, { time });
                requestTextEdit(textEl);
                return true;
              }}
              onEmptyExit={() => {
                if (entry.text === "") removeRow(entry.id);
              }}
            />
            <CommitInput
              className="min-w-0 flex-1 border-l-[3px] border-(--node-accent)/45 bg-transparent pl-1.5 text-sm outline-none"
              value={entry.text}
              placeholder="出来事"
              renderText={(text) => <StyledText text={text} />}
              onCommit={(text) => commitEntry(entry.id, { text })}
              onEnter={(text) => commitAndAddNext(entry.id, text)}
              onEmptyExit={() => {
                if (entry.time === "") removeRow(entry.id);
              }}
            />
          </NodeRow>
        ))}
        <AddRowButton className="text-(--node-accent)" onClick={addRow} />
      </div>
    </PanelNodeShell>
  );
}
