import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { DEFAULT_NODE_WIDTH, type WidthKind } from "@/lib/nodeWidths";
import { useBoardStore } from "@/store";
import { STICKY_COLORS, type StickyColor } from "@/types/board";

// ノード枠に使う横幅。設定があればその値、無ければタイムライン基準の既定値を返す。
// 使われ方: 各ノードコンポーネントが frameStyle の width としてそのまま渡す前提
export const useNodeWidth = (kind: WidthKind): number =>
  useBoardStore((s) => s.nodeWidths[kind] ?? DEFAULT_NODE_WIDTH);

// 全ノード種別共通の外枠。枠・タイトルヘッダ・接続ハンドル 4 方向・選択リングを持つ。
// 幅や配色は frameClassName / frameStyle / headerClassName / headerStyle で種別ごとに与える。
// 枠は relative なので、children 内の absolute 配置はこの枠を基準にできる。
// タイトルは blur で確定し、変更があったときだけ onTitleCommit が呼ばれる。
// タイトルは既定で折り返して全文表示する。titleSingleLine はヘッダの高さを固定したい
// ノード（スタック）だけが渡し、1 行に省略する。
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
  titleSingleLine,
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
  titleSingleLine?: boolean;
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
          singleLine={titleSingleLine}
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
// 表示は既定で折り返して全文を見せる。singleLine を渡したときだけ 1 行に省略する。
// 編集中も表示と同じ折り返しで全文が見えるよう textarea を使うが、値は 1 行の
// テキストとして扱う。Enter は改行せず確定し、ペースト等で入った改行は空白に潰す。
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
  ...rest
}: {
  value: string;
  onCommit: (value: string) => void;
  normalize?: (value: string) => string;
  defaultEditing?: boolean;
  singleLine?: boolean;
  className?: string;
  placeholder?: string;
  renderText?: (text: string) => ReactNode;
} & Omit<
  ComponentPropsWithoutRef<"textarea">,
  "value" | "onChange" | "onBlur" | "onKeyDown" | "className" | "placeholder" | "rows"
>) {
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
      {...rest}
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

// ノード配色を 1 本で決める --node-accent 変数を frameStyle として与えるためのスタイル。
// accent には CSS の色値を渡す。var() 参照のままでよい。
export const nodeAccentStyle = (accent: string) =>
  // SAFETY: カスタムプロパティは実行時のインラインスタイルとして有効だが、
  // CSSProperties がキーとして許さないためだけの表明
  ({ "--node-accent": accent }) as CSSProperties;

// ノード上部に浮かべる色パレット。選択中のノードだけが描画する前提。
// スワッチのクリックで onPick に色を渡す。defaultSwatch を渡すと先頭に「既定色へ戻す」
// スワッチが付き、そのクリックでは onPick(undefined) が呼ばれる。付箋のように既定色の
// 概念が無いノードは defaultSwatch を渡さないことで undefined が来ないことを保証できる。
export function ColorPalette({
  color,
  defaultSwatch,
  onPick,
}: {
  color: StickyColor | undefined;
  defaultSwatch?: string;
  onPick: (color: StickyColor | undefined) => void;
}) {
  const swatch = (label: string, current: boolean, bg: string, pick: StickyColor | undefined) => (
    <button
      key={label}
      type="button"
      aria-label={`色: ${label}`}
      className={`h-4 w-4 cursor-pointer rounded-full ${current ? "ring-2 ring-accent" : ""}`}
      style={{ background: bg }}
      onClick={() => onPick(pick)}
    />
  );
  return (
    <div className="absolute -top-7 left-0 flex gap-1 rounded bg-bg-elevated/90 p-1 shadow">
      {defaultSwatch !== undefined && swatch("既定", color === undefined, defaultSwatch, undefined)}
      {STICKY_COLORS.map((c) => swatch(c, c === color, `var(--sticky-${c}-accent)`, c))}
    </div>
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
