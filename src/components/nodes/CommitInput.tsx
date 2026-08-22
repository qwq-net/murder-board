import { useEffect, useRef, useState, type ReactNode } from "react";

// ダブルクリックで編集に入るテキスト。通常は表示テキストで、その領域はノードの
// ドラッグや選択にそのまま使える。編集中は blur / Enter で確定して表示に戻り、
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
  defaultEditing = false,
  singleLine = false,
  className = "",
  placeholder,
  renderText,
}: {
  value: string;
  onCommit: (value: string) => void;
  normalize?: (value: string) => string;
  defaultEditing?: boolean;
  singleLine?: boolean;
  className?: string;
  placeholder?: string;
  renderText?: (text: string) => ReactNode;
}) {
  const [editing, setEditing] = useState(defaultEditing);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (el && document.activeElement !== el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  if (!editing) {
    return (
      <div
        className={`${singleLine ? "truncate" : "break-words"} ${className}`}
        onDoubleClick={() => {
          setDraft(value);
          setEditing(true);
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
      className={`nodrag field-sizing-content resize-none break-words ${className}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, " "))}
      onBlur={() => {
        const committed = normalize ? normalize(draft) : draft;
        setDraft(committed);
        setEditing(false);
        if (committed !== value) onCommit(committed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

// timeline / list 共通の 1 行。children に入力欄を並べ、hover 時だけ削除ボタンを見せる。
// 削除ボタンは absolute で右端に重ね、非表示時に幅を取らせない。行の左右余白を対称に
// 保つためで、hover 時は行のホバー背景と同じ色を敷いてテキストの上に浮く。
// className はノード種別ごとの装飾の追加用。行の div は relative なので、
// before 疑似要素などの absolute 配置は行を基準にできる。
export function NodeRow({
  onRemove,
  className = "",
  children,
}: {
  onRemove: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`group relative flex items-center gap-1 rounded px-1 py-0.5 hover:bg-bg-hover ${className}`}
    >
      {children}
      <button
        type="button"
        aria-label="行を削除"
        className="nodrag invisible absolute top-1/2 right-0.5 -translate-y-1/2 cursor-pointer rounded bg-bg-hover px-1 text-xs text-text-muted group-hover:visible hover:text-danger"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

// 行リスト末尾の「＋ 行を追加」ボタン。文字色は className でノード種別のアクセントを与える。
export function AddRowButton({ className, onClick }: { className: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`nodrag w-full cursor-pointer rounded px-2 py-0.5 text-left text-xs hover:bg-bg-hover ${className}`}
      onClick={onClick}
    >
      ＋ 行を追加
    </button>
  );
}
