import type { NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { StyledText } from "@/components/nodes/StyledText";
import { ColorPalette, NodeShell, useNodeWidth } from "@/components/nodes/NodeShell";
import { useBoardStore } from "@/store";
import { type StickyColor, type StickyNodeType } from "@/types/board";

// 付箋カラーは index.css の --sticky-* 変数で定義され、テーマに応じて値が切り替わる。
// クラスマップではなく CSS 変数参照にすることで、テーマ切替時のロジック変更を不要にする。
const noteStyle = (c: StickyColor) => ({
  background: `var(--sticky-${c}-bg)`,
  borderColor: `var(--sticky-${c}-border)`,
});

// 付箋ノード。空テキストで生成された直後は編集状態で始まる。
// 表示中はダブルクリックで編集、blur / Escape で確定。選択中は色パレットを上部に出す。
export function StickyNode({ id, data, selected }: NodeProps<StickyNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  const [editing, setEditing] = useState(data.text === "");
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
    if (draft !== data.text) updateNodeData(id, "sticky", { text: draft });
  };

  const width = useNodeWidth("sticky");

  return (
    <NodeShell
      selected={selected}
      frameClassName="text-text-primary"
      frameStyle={{ ...noteStyle(data.color), width }}
      headerStyle={{ background: `var(--sticky-${data.color}-header)` }}
      title={data.title}
      titlePlaceholder="メモ"
      onTitleCommit={(title) => updateNodeData(id, "sticky", { title })}
    >
      {selected && !editing && (
        <ColorPalette
          color={data.color}
          onPick={(color) => color && updateNodeData(id, "sticky", { color })}
        />
      )}
      {editing ? (
        <textarea
          ref={taRef}
          className="nodrag block field-sizing-content min-h-24 w-full resize-none bg-transparent p-2 text-sm outline-none"
          value={draft}
          placeholder="メモを入力..."
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") commit();
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
          {data.text ? (
            <StyledText text={data.text} />
          ) : (
            <span className="text-text-muted opacity-60">ダブルクリックで編集</span>
          )}
        </div>
      )}
    </NodeShell>
  );
}
