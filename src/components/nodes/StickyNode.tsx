import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { useBoardStore } from '@/store';
import { STICKY_COLORS, type StickyColor, type StickyNodeType } from '@/types/board';

// 付箋カラーは index.css の --sticky-* 変数で定義され、テーマに応じて値が切り替わる。
// クラスマップではなく CSS 変数参照にすることで、テーマ切替時のロジック変更を不要にする。
const noteStyle = (c: StickyColor) => ({
  background: `var(--sticky-${c}-bg)`,
  borderColor: `var(--sticky-${c}-border)`,
});

// 付箋ノード。空テキストで生成された直後は編集状態で始まる。
// 表示中はダブルクリックで編集、blur / Escape で確定。選択中は色パレットを上部に出す。
export function StickyNode({ id, data, selected }: NodeProps<StickyNodeType>) {
  const updateStickyData = useBoardStore((s) => s.updateStickyData);
  const [editing, setEditing] = useState(data.text === '');
  const [draft, setDraft] = useState(data.text);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // React Flow は計測前のノードを visibility:hidden で描画するため autoFocus が効かない。
  // 表示されてフォーカスが通るまで数フレーム再試行する
  useEffect(() => {
    if (!editing) return;
    let tries = 0;
    const timer = setInterval(() => {
      const el = taRef.current;
      if (el && document.activeElement !== el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
      if (++tries >= 10 || document.activeElement === taRef.current) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== data.text) updateStickyData(id, { text: draft });
  };

  return (
    <div
      className={`relative w-48 rounded-sm border text-text-primary shadow-md ${
        selected ? 'ring-2 ring-accent' : ''
      }`}
      style={noteStyle(data.color)}
    >
      {selected && !editing && (
        <div className="absolute -top-7 left-0 flex gap-1 rounded bg-bg-elevated/90 p-1 shadow">
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`色: ${c}`}
              className={`h-4 w-4 cursor-pointer rounded-full ${
                c === data.color ? 'ring-2 ring-accent' : ''
              }`}
              style={{ background: `var(--sticky-${c}-accent)` }}
              onClick={() => updateStickyData(id, { color: c })}
            />
          ))}
        </div>
      )}
      <div
        className="rounded-t-sm px-2 py-1"
        style={{ background: `var(--sticky-${data.color}-header)` }}
      >
        <input
          className="nodrag w-full bg-transparent text-sm font-bold outline-none"
          defaultValue={data.title}
          placeholder="タイトル"
          onBlur={(e) => {
            if (e.target.value !== data.title) updateStickyData(id, { title: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </div>
      {editing ? (
        <textarea
          ref={taRef}
          className="nodrag block h-24 w-full resize-none bg-transparent p-2 text-sm outline-none"
          value={draft}
          placeholder="メモを入力..."
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') commit();
          }}
        />
      ) : (
        <div
          className="min-h-12 p-2 text-sm break-words whitespace-pre-wrap"
          onDoubleClick={() => {
            setDraft(data.text);
            setEditing(true);
          }}
        >
          {data.text || <span className="text-text-muted opacity-60">ダブルクリックで編集</span>}
        </div>
      )}
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}
