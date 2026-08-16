import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';
import { autoCompleteTime, sortTimelineEntries } from '@/lib/timeParser';
import { nanoid } from 'nanoid';
import { useBoardStore } from '@/store';
import type { TimelineEntry, TimelineNodeType } from '@/types/board';

// タイムライン付箋。行は「時刻 + 出来事」で、時刻の確定（blur）時に自動補完・昇順ソートされる。
// 時刻を解釈できない行（空欄・自由記述）は末尾に並ぶ。レイアウトは仮。
export function TimelineNode({ id, data, selected }: NodeProps<TimelineNodeType>) {
  const updateTimelineData = useBoardStore((s) => s.updateTimelineData);

  const commitEntry = (entryId: string, patch: Partial<Omit<TimelineEntry, 'id'>>) => {
    updateTimelineData(id, {
      entries: sortTimelineEntries(
        data.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
      ),
    });
  };

  const addRow = () =>
    updateTimelineData(id, { entries: [...data.entries, { id: nanoid(), time: '', text: '' }] });

  const removeRow = (entryId: string) =>
    updateTimelineData(id, { entries: data.entries.filter((e) => e.id !== entryId) });

  return (
    <div
      className={`w-72 rounded-sm border border-indigo-300 bg-white shadow-md ${
        selected ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="rounded-t-sm bg-indigo-100 px-2 py-1">
        <input
          className="nodrag w-full bg-transparent text-sm font-bold text-indigo-900 outline-none"
          defaultValue={data.title}
          placeholder="タイムライン"
          onBlur={(e) => {
            if (e.target.value !== data.title) updateTimelineData(id, { title: e.target.value });
          }}
        />
      </div>
      <div className="p-1">
        {data.entries.map((entry) => (
          <TimelineRow key={entry.id} entry={entry} onCommit={commitEntry} onRemove={removeRow} />
        ))}
        <button
          type="button"
          className="nodrag w-full cursor-pointer rounded px-2 py-0.5 text-left text-xs text-indigo-400 hover:bg-indigo-50"
          onClick={addRow}
        >
          ＋ 行を追加
        </button>
      </div>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}

function TimelineRow({
  entry,
  onCommit,
  onRemove,
}: {
  entry: TimelineEntry;
  onCommit: (entryId: string, patch: Partial<Omit<TimelineEntry, 'id'>>) => void;
  onRemove: (entryId: string) => void;
}) {
  const [time, setTime] = useState(entry.time);
  const [text, setText] = useState(entry.text);

  const commitTime = () => {
    const completed = autoCompleteTime(time);
    setTime(completed);
    if (completed !== entry.time) onCommit(entry.id, { time: completed });
  };

  return (
    <div className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-zinc-50">
      <input
        className="nodrag w-12 shrink-0 bg-transparent text-center font-mono text-xs text-zinc-600 outline-none"
        value={time}
        placeholder="21:00"
        onChange={(e) => setTime(e.target.value)}
        onBlur={commitTime}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <input
        className="nodrag min-w-0 flex-1 bg-transparent text-sm outline-none"
        value={text}
        placeholder="出来事"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== entry.text) onCommit(entry.id, { text });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <button
        type="button"
        aria-label="行を削除"
        className="nodrag invisible shrink-0 cursor-pointer px-1 text-xs text-zinc-400 group-hover:visible hover:text-red-500"
        onClick={() => onRemove(entry.id)}
      >
        ×
      </button>
    </div>
  );
}
