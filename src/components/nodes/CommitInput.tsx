import { GripVertical, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRetryFocus } from "@/components/nodes/useRetryFocus";

// ノード内で Tab 巡回と編集開始連鎖の対象になるテキスト要素を示すセレクタ。
// 表示・編集のどちらの状態の要素にも付く。NodeShell が枠内をこれで集めて移動先を決める。
export const NODE_TEXT_SELECTOR = "[data-node-text]";

// 表示中のテキスト要素へ編集開始を求める DOM イベント名。編集中の要素は応じない
export const TEXT_EDIT_EVENT = "node-text-edit";

// el のテキスト要素に編集開始を要求する。React ツリーの外から編集状態へ入れる唯一の経路
export const requestTextEdit = (el: Element) => el.dispatchEvent(new Event(TEXT_EDIT_EVENT));

// ダブルクリックで編集に入るテキスト。通常は表示テキストで、その領域はノードの
// ドラッグや選択にそのまま使える。表示はフォーカス可能な Tab 巡回の対象で、
// フォーカス中の Enter か requestTextEdit でも編集に入る。
// 編集中は blur / Enter で確定して表示に戻り、Enter 確定では表示へフォーカスも戻す。
// Escape は編集を破棄して表示に戻るだけで、onEmptyExit は呼ばない。破棄は行を保存する操作。
// onEnter を渡すと Enter のとき確定値と編集中の textarea 要素を添えて呼ぶ。要素は
// 同じ行の別入力へ移る連鎖の DOM 起点用。true が返ったら確定とフォーカスの後始末は
// 呼び手が引き受けた扱いになり、onCommit も表示への復帰フォーカスも行わない。
// onEmptyExit は空のまま編集を終え、フォーカスが行 data-node-row の外へ出たときに呼ぶ。
// 空行の自動削除向けで、同じ行内のボタン等をクリックした blur では呼ばない。
// onCommit は確定値が value と異なるときだけ呼ばれる。normalize を渡すと blur 時に
// 入力値へ適用し、表示・確定値ともその結果になる。value が空なら placeholder を薄く表示する。
// defaultEditing はマウント時にだけ効き、以降の変化は無視される。行の追加直後など向け。
// 値は 1 行のテキストとして扱う。Enter は改行せず確定し、ペースト等で入った改行は空白に潰す。
// 表示は既定で折り返して全文を見せる。singleLine を渡したときだけ 1 行に省略する。
// renderText は表示モードの装飾フック。空でない value の表示にだけ使われ、編集中の
// textarea とプレースホルダには効かない。
export function CommitInput({
  value,
  onCommit,
  normalize,
  onEnter,
  onEmptyExit,
  defaultEditing = false,
  singleLine = false,
  className = "",
  placeholder,
  renderText,
}: {
  value: string;
  onCommit: (value: string) => void;
  normalize?: (value: string) => string;
  onEnter?: (committed: string, el: HTMLTextAreaElement) => boolean;
  onEmptyExit?: () => void;
  defaultEditing?: boolean;
  singleLine?: boolean;
  className?: string;
  placeholder?: string;
  renderText?: (text: string) => ReactNode;
}) {
  const [editing, setEditing] = useState(defaultEditing);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  // Enter 確定でだけ立てる印。blur 確定ではフォーカスを奪い返さない
  const refocusRef = useRef(false);
  // onEnter が確定まで引き受けたとき、blur 側の二重確定を防ぐ印
  const handledRef = useRef(false);

  useRetryFocus(editing, inputRef);

  // Enter 確定後に表示要素へフォーカスを戻し、Tab 巡回を途切れさせない
  useEffect(() => {
    if (editing || !refocusRef.current) return;
    refocusRef.current = false;
    displayRef.current?.focus();
  }, [editing]);

  const startEditing = () => {
    handledRef.current = false;
    setDraft(value);
    setEditing(true);
  };

  // 外からの編集開始要求を表示中だけ受ける。最新の value を閉じるため毎レンダーで張り直す
  useEffect(() => {
    const el = displayRef.current;
    if (!el) return;
    el.addEventListener(TEXT_EDIT_EVENT, startEditing);
    return () => el.removeEventListener(TEXT_EDIT_EVENT, startEditing);
  });

  if (!editing) {
    return (
      <div
        ref={displayRef}
        tabIndex={0}
        data-node-text
        className={`nokey rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-accent ${singleLine ? "truncate" : "break-words"} ${className}`}
        onDoubleClick={startEditing}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          startEditing();
        }}
      >
        {value ? (
          (renderText?.(value) ?? value)
        ) : (
          <span className="text-text-muted opacity-60">{placeholder}</span>
        )}
      </div>
    );
  }
  return (
    <textarea
      ref={inputRef}
      rows={1}
      data-node-text
      className={`nodrag field-sizing-content resize-none break-words ${className}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, " "))}
      onBlur={(e) => {
        const committed = normalize ? normalize(draft) : draft;
        setDraft(committed);
        setEditing(false);
        if (handledRef.current) {
          handledRef.current = false;
          return;
        }
        if (committed !== value) onCommit(committed);
        const row = e.currentTarget.closest("[data-node-row]");
        const staysInRow =
          row !== null && e.relatedTarget instanceof Element && row.contains(e.relatedTarget);
        if (committed === "" && !staysInRow) onEmptyExit?.();
      }}
      onKeyDown={(e) => {
        // IME の変換確定 Enter やキャンセル Escape に反応しない
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") {
          e.preventDefault();
          // unmount では blur が発火しない前提の後始末。発火する環境でも handledRef が
          // 二重確定を防ぎ、フラグ自体は次の編集開始時にリセットされる
          handledRef.current = true;
          refocusRef.current = true;
          setDraft(value);
          setEditing(false);
          return;
        }
        if (e.key !== "Enter") return;
        e.preventDefault();
        handledRef.current =
          onEnter?.(normalize ? normalize(draft) : draft, e.currentTarget) === true;
        refocusRef.current = !handledRef.current;
        e.currentTarget.blur();
      }}
    />
  );
}

// ドラッグ中の行。HTML5 DnD はウィンドウ内で同時に 1 つしか走らないためモジュール変数で持つ。
// group はノード id で、ドロップ先が同じノードの行かの判定に使う
let rowDrag: { group: string; index: number } | null = null;

// timeline / list 共通の 1 行。children に入力欄を並べ、hover 時だけ削除ボタンを見せる。
// 削除ボタンは absolute で右端に重ね、非表示時に幅を取らせない。行の左右余白を対称に
// 保つためで、hover 時は行のホバー背景と同じ色を敷いてテキストの上に浮く。
// 行の div には data-node-row が付き、CommitInput の onEmptyExit が
// フォーカスの行内移動と行外への離脱を見分けるのに使う。
// reorder を渡すと hover 時に削除ボタンの左へ並び替えグリップが出る。同じ group の
// 行の上へのドロップだけを受け、onMove にドラッグ元と先の添字を渡す。元と同じ位置への
// ドロップでは onMove を呼ばない。ノードを跨いだドロップは受け付けない。
// 並びが自動で決まるノードは reorder を渡さない想定。
// className はノード種別ごとの装飾の追加用。行の div は relative なので、
// before 疑似要素などの absolute 配置は行を基準にできる。
export function NodeRow({
  onRemove,
  reorder,
  className = "",
  children,
}: {
  onRemove: () => void;
  reorder?: { group: string; index: number; onMove: (from: number, to: number) => void };
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-node-row
      className={`group relative flex items-center gap-1 rounded px-1 py-0.5 hover:bg-bg-hover ${className}`}
      onDragOver={(e) => {
        if (reorder && rowDrag?.group === reorder.group) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!reorder || rowDrag?.group !== reorder.group) return;
        e.preventDefault();
        if (rowDrag.index !== reorder.index) reorder.onMove(rowDrag.index, reorder.index);
        rowDrag = null;
      }}
    >
      {children}
      {reorder && (
        <button
          type="button"
          aria-label="行を並び替え"
          draggable
          onDragStart={(e) => {
            rowDrag = { group: reorder.group, index: reorder.index };
            e.dataTransfer.effectAllowed = "move";
            // Firefox はデータの無いドラッグを開始しないため空文字を積む
            e.dataTransfer.setData("text/plain", "");
          }}
          onDragEnd={() => {
            rowDrag = null;
          }}
          className="nodrag invisible absolute top-1/2 right-6 -translate-y-1/2 cursor-grab rounded bg-bg-hover p-1 text-text-muted group-hover:visible hover:text-text-primary"
        >
          <GripVertical size={14} />
        </button>
      )}
      <button
        type="button"
        aria-label="行を削除"
        className="nodrag invisible absolute top-1/2 right-0.5 -translate-y-1/2 cursor-pointer rounded bg-bg-hover p-1 text-text-muted group-hover:visible hover:text-danger"
        onClick={onRemove}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// 行リスト末尾の「行を追加」ボタン。文字色は className でノード種別のアクセントを与える。
export function AddRowButton({ className, onClick }: { className: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`nodrag flex w-full cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-left text-xs hover:bg-bg-hover ${className}`}
      onClick={onClick}
    >
      <Plus size={13} />
      行を追加
    </button>
  );
}
