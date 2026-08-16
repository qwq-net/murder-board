import type { NodeProps } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { AddRowButton, CommitInput, NodeRow, NodeShell } from '@/components/nodes/NodeShell';
import { autoCompleteTime, sortTimelineEntries } from '@/lib/timeParser';
import { useBoardStore } from '@/store';
import type { TimelineEntry, TimelineNodeType } from '@/types/board';

// タイムライン付箋。行は「時刻 + 出来事」で、時刻の確定時に自動補完・昇順ソートされる。
// 確定のタイミングは blur。時刻を解釈できない行は末尾に並ぶ。空欄や自由記述がこれにあたる。
// レイアウトは仮。
export function TimelineNode({ id, data, selected }: NodeProps<TimelineNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);

  const commitEntry = (entryId: string, patch: Partial<Omit<TimelineEntry, 'id'>>) =>
    updateNodeData(id, 'timeline', {
      entries: sortTimelineEntries(
        data.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
      ),
    });

  const addRow = () =>
    updateNodeData(id, 'timeline', { entries: [...data.entries, { id: nanoid(), time: '', text: '' }] });

  const removeRow = (entryId: string) =>
    updateNodeData(id, 'timeline', { entries: data.entries.filter((e) => e.id !== entryId) });

  return (
    <NodeShell
      selected={selected}
      frameClassName="w-72 border-panel-timeline-accent/40 bg-bg-panel"
      headerClassName="bg-panel-timeline-accent/15"
      title={data.title}
      titlePlaceholder="タイムライン"
      onTitleCommit={(title) => updateNodeData(id, 'timeline', { title })}
    >
      <div className="p-1">
        {data.entries.map((entry) => (
          <NodeRow key={entry.id} onRemove={() => removeRow(entry.id)}>
            <CommitInput
              className="nodrag w-12 shrink-0 bg-transparent text-center font-mono text-xs text-text-muted outline-none"
              value={entry.time}
              placeholder="21:00"
              normalize={autoCompleteTime}
              onCommit={(time) => commitEntry(entry.id, { time })}
            />
            <CommitInput
              className="nodrag min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={entry.text}
              placeholder="出来事"
              onCommit={(text) => commitEntry(entry.id, { text })}
            />
          </NodeRow>
        ))}
        <AddRowButton className="text-panel-timeline-accent" onClick={addRow} />
      </div>
    </NodeShell>
  );
}
