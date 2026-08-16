import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';
import { nanoid } from 'nanoid';
import { useBoardStore } from '@/store';
import type { ListEntry, ListNodeType } from '@/types/board';

// リスト付箋。プレーンテキスト行の追加・削除ができ、並び順は登録順のまま。
// 行の確定は blur。タイムライン付箋と違い、時刻もソートも持たない。
export function ListNode({ id, data, selected }: NodeProps<ListNodeType>) {
  const updateListData = useBoardStore((s) => s.updateListData);

  const commitEntry = (entryId: string, text: string) =>
    updateListData(id, {
      entries: data.entries.map((e) => (e.id === entryId ? { ...e, text } : e)),
    });

  const addRow = () =>
    updateListData(id, { entries: [...data.entries, { id: nanoid(), text: '' }] });

  const removeRow = (entryId: string) =>
    updateListData(id, { entries: data.entries.filter((e) => e.id !== entryId) });

  return (
    <div
      className={`w-72 rounded-sm border border-panel-list-accent/40 bg-bg-panel shadow-md ${
        selected ? 'ring-2 ring-accent' : ''
      }`}
    >
      <div className="rounded-t-sm bg-panel-list-accent/15 px-2 py-1">
        <input
          className="nodrag w-full bg-transparent text-sm font-bold text-text-primary outline-none"
          defaultValue={data.title}
          placeholder="リスト"
          onBlur={(e) => {
            if (e.target.value !== data.title) updateListData(id, { title: e.target.value });
          }}
        />
      </div>
      <div className="p-1">
        {data.entries.map((entry) => (
          <ListRow key={entry.id} entry={entry} onCommit={commitEntry} onRemove={removeRow} />
        ))}
        <button
          type="button"
          className="nodrag w-full cursor-pointer rounded px-2 py-0.5 text-left text-xs text-panel-list-accent hover:bg-bg-hover"
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

function ListRow({
  entry,
  onCommit,
  onRemove,
}: {
  entry: ListEntry;
  onCommit: (entryId: string, text: string) => void;
  onRemove: (entryId: string) => void;
}) {
  const [text, setText] = useState(entry.text);

  return (
    <div className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-bg-hover">
      <input
        className="nodrag min-w-0 flex-1 bg-transparent text-sm outline-none"
        value={text}
        placeholder="項目"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== entry.text) onCommit(entry.id, text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <button
        type="button"
        aria-label="行を削除"
        className="nodrag invisible shrink-0 cursor-pointer px-1 text-xs text-text-muted group-hover:visible hover:text-danger"
        onClick={() => onRemove(entry.id)}
      >
        ×
      </button>
    </div>
  );
}
