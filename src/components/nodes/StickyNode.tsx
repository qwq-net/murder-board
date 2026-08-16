import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { useBoardStore } from '@/store';
import { STICKY_COLORS, type BoardNode, type StickyColor } from '@/types/board';

const NOTE_CLASSES: Record<StickyColor, string> = {
  yellow: 'bg-amber-100 border-amber-300',
  pink: 'bg-pink-100 border-pink-300',
  blue: 'bg-sky-100 border-sky-300',
  green: 'bg-emerald-100 border-emerald-300',
  purple: 'bg-violet-100 border-violet-300',
  gray: 'bg-zinc-100 border-zinc-300',
};

const DOT_CLASSES: Record<StickyColor, string> = {
  yellow: 'bg-amber-300',
  pink: 'bg-pink-300',
  blue: 'bg-sky-300',
  green: 'bg-emerald-300',
  purple: 'bg-violet-300',
  gray: 'bg-zinc-300',
};

// 付箋ノード。空テキストで生成された直後は編集状態で始まる。
// 表示中はダブルクリックで編集、blur / Escape で確定。選択中は色パレットを上部に出す。
export function StickyNode({ id, data, selected }: NodeProps<BoardNode>) {
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
      className={`relative w-48 rounded-sm border shadow-md ${NOTE_CLASSES[data.color]} ${
        selected ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      {selected && !editing && (
        <div className="absolute -top-7 left-0 flex gap-1 rounded bg-white/90 p-1 shadow">
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`色: ${c}`}
              className={`h-4 w-4 cursor-pointer rounded-full ${DOT_CLASSES[c]} ${
                c === data.color ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => updateStickyData(id, { color: c })}
            />
          ))}
        </div>
      )}
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
          {data.text || <span className="text-black/30">ダブルクリックで編集</span>}
        </div>
      )}
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}
