import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

// 全ノード種別共通の外枠。枠・タイトルヘッダ・接続ハンドル 4 方向・選択リングを持つ。
// 幅や配色は frameClassName / frameStyle / headerClassName / headerStyle で種別ごとに与える。
// 枠は relative なので、children 内の absolute 配置はこの枠を基準にできる。
// タイトルは blur で確定し、変更があったときだけ onTitleCommit が呼ばれる。
// 使われ方: 各ノードコンポーネントが body だけを children として渡す前提。
// 新しいノード種別を追加するときはこのシェルに body を載せる。
export function NodeShell({
  selected,
  frameClassName,
  frameStyle,
  headerClassName = "",
  headerStyle,
  title,
  titlePlaceholder,
  onTitleCommit,
  children,
}: {
  selected: NodeProps["selected"];
  frameClassName: string;
  frameStyle?: CSSProperties;
  headerClassName?: string;
  headerStyle?: CSSProperties;
  title: string;
  titlePlaceholder: string;
  onTitleCommit: (title: string) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative rounded-sm border shadow-md ${frameClassName} ${
        selected ? "ring-2 ring-accent" : ""
      }`}
      style={frameStyle}
    >
      <div className={`rounded-t-sm px-2 py-1 ${headerClassName}`} style={headerStyle}>
        <CommitInput
          className="w-full bg-transparent text-sm font-bold text-text-primary outline-none"
          value={title}
          placeholder={titlePlaceholder}
          onCommit={onTitleCommit}
        />
      </div>
      {children}
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}

// ダブルクリックで編集に入るテキスト。通常は表示テキストで、その領域はノードの
// ドラッグや選択にそのまま使える。編集中は blur / Enter で確定して表示に戻り、
// onCommit は確定値が value と異なるときだけ呼ばれる。normalize を渡すと blur 時に
// 入力値へ適用し、表示・確定値ともその結果になる。value が空なら placeholder を
// 薄く表示する。defaultEditing はマウント直後から編集で始めたいとき（行の追加直後
// など）に渡す。マウント時にだけ効き、以降の変化は無視される。
export function CommitInput({
  value,
  onCommit,
  normalize,
  defaultEditing = false,
  className = "",
  placeholder,
  ...rest
}: {
  value: string;
  onCommit: (value: string) => void;
  normalize?: (value: string) => string;
  defaultEditing?: boolean;
  className?: string;
  placeholder?: string;
} & Omit<
  ComponentPropsWithoutRef<"input">,
  "value" | "onChange" | "onBlur" | "onKeyDown" | "className" | "placeholder"
>) {
  const [editing, setEditing] = useState(defaultEditing);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

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
        className={`truncate ${className}`}
        onDoubleClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || <span className="text-text-muted opacity-60">{placeholder}</span>}
      </div>
    );
  }
  return (
    <input
      {...rest}
      ref={inputRef}
      className={`nodrag ${className}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const committed = normalize ? normalize(draft) : draft;
        setDraft(committed);
        setEditing(false);
        if (committed !== value) onCommit(committed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

// timeline / list 共通の 1 行。children に入力欄を並べ、hover 時だけ削除ボタンを見せる。
export function NodeRow({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  return (
    <div className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-bg-hover">
      {children}
      <button
        type="button"
        aria-label="行を削除"
        className="nodrag invisible shrink-0 cursor-pointer px-1 text-xs text-text-muted group-hover:visible hover:text-danger"
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
