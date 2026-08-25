import type { NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { StyledText } from "@/components/nodes/StyledText";
import { ColorPalette } from "@/components/nodes/ColorPalette";
import { TEXT_EDIT_EVENT } from "@/components/nodes/CommitInput";
import { useNodeWidth } from "@/components/nodes/nodeMeta";
import { NodeShell } from "@/components/nodes/NodeShell";
import { useBoardStore } from "@/store";
import { DEFAULT_NODE_COLORS, type StickyColor, type StickyNodeType } from "@/types/board";

// 付箋カラーは index.css の --sticky-* 変数で定義され、テーマに応じて値が切り替わる。
// クラスマップではなく CSS 変数参照にすることで、テーマ切替時のロジック変更を不要にする。
const noteStyle = (c: StickyColor) => ({
  background: `var(--sticky-${c}-bg)`,
  borderColor: `var(--sticky-${c}-border)`,
});

// 付箋ノード。空テキストで生成された直後は編集状態で始まる。
// 表示中はダブルクリックかフォーカス中の Enter で編集に入り、タイトルの Enter からも
// 編集開始の連鎖を受ける。編集中は blur / Escape / Enter で確定し、改行は Shift+Enter。
// 選択中は色パレットを上部に出す。
export function StickyNode({ id, data, selected }: NodeProps<StickyNodeType>) {
  const updateNodeData = useBoardStore((s) => s.updateNodeData);
  const [editing, setEditing] = useState(data.text === "");
  const [draft, setDraft] = useState(data.text);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  // Enter / Escape 確定でだけ立てる印。blur 確定ではフォーカスを奪い返さない
  const refocusRef = useRef(false);

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

  // キー操作の確定後に表示へフォーカスを戻し、Tab 巡回を途切れさせない
  useEffect(() => {
    if (editing || !refocusRef.current) return;
    refocusRef.current = false;
    displayRef.current?.focus();
  }, [editing]);

  const startEditing = () => {
    setDraft(data.text);
    setEditing(true);
  };

  // タイトル Enter の連鎖で届く編集開始要求を表示中だけ受ける。
  // 最新の data.text を閉じるため毎レンダーで張り直す
  useEffect(() => {
    const el = displayRef.current;
    if (!el) return;
    el.addEventListener(TEXT_EDIT_EVENT, startEditing);
    return () => el.removeEventListener(TEXT_EDIT_EVENT, startEditing);
  });

  const commit = () => {
    setEditing(false);
    if (draft !== data.text) updateNodeData(id, "sticky", { text: draft });
  };

  const width = useNodeWidth("sticky");
  const color = data.color ?? DEFAULT_NODE_COLORS.sticky;

  return (
    <NodeShell
      selected={selected}
      frameClassName="text-text-primary"
      frameStyle={{ ...noteStyle(color), width }}
      headerStyle={{ background: `var(--sticky-${color}-header)` }}
      title={data.title}
      titlePlaceholder="メモ"
      onTitleCommit={(title) => updateNodeData(id, "sticky", { title })}
    >
      {selected && !editing && (
        <ColorPalette
          color={color}
          onPick={(picked) => picked && updateNodeData(id, "sticky", { color: picked })}
        />
      )}
      {editing ? (
        <textarea
          ref={taRef}
          data-node-text
          className="nodrag block field-sizing-content min-h-24 w-full resize-none bg-transparent p-2 text-sm outline-none"
          value={draft}
          placeholder="メモを入力..."
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // IME の変換確定 Enter やキャンセル Escape で本文全体を確定させない
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
              e.preventDefault();
              refocusRef.current = true;
              commit();
            }
          }}
        />
      ) : (
        <div
          ref={displayRef}
          tabIndex={0}
          data-node-text
          className="nokey min-h-12 rounded-sm p-2 text-sm break-words whitespace-pre-wrap outline-none focus-visible:ring-1 focus-visible:ring-accent"
          onDoubleClick={startEditing}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            startEditing();
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
