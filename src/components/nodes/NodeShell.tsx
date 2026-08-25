import { useNodeId, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { CommitInput, NODE_TEXT_SELECTOR, requestTextEdit } from "@/components/nodes/CommitInput";
import { KIND_ICONS } from "@/components/nodes/nodeMeta";
import { useBoardStore } from "@/store";

// 全ノード種別共通の外枠。枠・タイトルヘッダ・選択リングを持ち、ヘッダのタイトル左には
// 自ノードの種別アイコンが付く。種別は store から id で引く。
// 幅や配色は frameClassName / frameStyle / headerClassName / headerStyle で種別ごとに与える。
// 枠は relative なので、children 内の absolute 配置はこの枠を基準にできる。
// タイトルは blur で確定し、変更があったときだけ onTitleCommit が呼ばれる。
// addNode 直後のノードはタイトルの編集状態で始まる。store の newNodeId との一致で判定し、
// 貼り付けや複製、セッション読み込みでは始まらない。
// タイトルの Enter は確定に続けて最初の本文テキストの編集を開始する。本文テキストが
// 無いときは onTitleEnterFallback があればそれを呼ぶ。行の自動追加用。titleEnterToBody を
// 偽にすると連鎖もフォールバックも起きず確定だけになる。
// Tab / Shift+Tab はノード内のテキスト要素だけを巡回し、ノードの外や色パレット等の
// ボタンへは移らない。
// 既定で折り返して全文表示し、ヘッダの高さを固定したいノードだけが titleSingleLine で
// 1 行に省略する。
// 選択リングは親スタックも選択中なら表示しない。スタックごと選んだときにスタックだけを
// 光らせる見た目上の抑制で、選択状態そのものは変えない。
// 枠内のテキストがキーボードフォーカスや編集を持つ間も選択リングを消し、
// フォーカス枠が二重に見えないようにする。こちらも選択状態そのものは変えない。
// 使われ方: 各ノードコンポーネントが body だけを children として渡す前提。
export function NodeShell({
  selected,
  frameClassName,
  frameStyle,
  headerClassName = "",
  headerStyle,
  title,
  titlePlaceholder,
  titleSingleLine,
  titleEnterToBody = true,
  onTitleEnterFallback,
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
  titleEnterToBody?: boolean;
  onTitleEnterFallback?: () => void;
  onTitleCommit: (title: string) => void;
  children: ReactNode;
}) {
  const id = useNodeId();
  const parentSelected = useBoardStore((s) => {
    const parentId = s.nodes.find((n) => n.id === id)?.parentId;
    return parentId !== undefined && s.nodes.some((n) => n.id === parentId && n.selected === true);
  });
  const kind = useBoardStore((s) => s.nodes.find((n) => n.id === id)?.type);
  const Icon = kind !== undefined ? KIND_ICONS[kind] : null;
  const isNew = useBoardStore((s) => s.newNodeId === id);
  const frameRef = useRef<HTMLDivElement>(null);

  // 編集開始の印は一度消費したら消す。Undo/Redo やセッション往復での再マウント時に
  // タイトル編集が再発火してフォーカスを奪わないようにする
  useEffect(() => {
    if (isNew) useBoardStore.getState().clearNewNode();
  }, [isNew]);

  // 枠内のテキスト要素を DOM 順で返す。ヘッダが先頭にあるため先頭は常にタイトル
  const textTargets = () =>
    Array.from(frameRef.current?.querySelectorAll<HTMLElement>(NODE_TEXT_SELECTOR) ?? []);

  // タイトルの Enter で確定値を反映してから最初の本文テキストの編集を開始する。
  // 本文テキストが無ければ onTitleEnterFallback に委ねる。
  // 連鎖しなかったら false を返し、確定とフォーカスはタイトル側の既定動作に任せる
  const advanceToBody = (committed: string) => {
    if (!titleEnterToBody) return false;
    const target = textTargets()[1];
    if (!target && !onTitleEnterFallback) return false;
    if (committed !== title) onTitleCommit(committed);
    if (target) requestTextEdit(target);
    else onTitleEnterFallback?.();
    return true;
  };

  // Tab のフォーカス移動をノード内のテキスト要素の巡回に閉じ込める。
  // 端では反対側へ折り返し、テキスト以外から押されたときは端のテキストへ入る
  const cycleTextFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const texts = textTargets();
    if (texts.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const current = e.target instanceof Element ? e.target.closest(NODE_TEXT_SELECTOR) : null;
    const i = texts.findIndex((t) => t === current);
    const next =
      i < 0
        ? texts[e.shiftKey ? texts.length - 1 : 0]
        : texts[(i + (e.shiftKey ? -1 : 1) + texts.length) % texts.length];
    next?.focus();
  };

  return (
    <div
      ref={frameRef}
      onKeyDown={cycleTextFocus}
      className={`relative rounded-sm border shadow-md ${frameClassName} ${
        selected && !parentSelected ? "ring-2 ring-accent has-[:focus-visible]:ring-0" : ""
      }`}
      style={frameStyle}
    >
      <div
        className={`flex items-start gap-1.5 rounded-t-sm px-2 py-1 ${headerClassName}`}
        style={headerStyle}
      >
        {Icon && <Icon size={14} className="mt-1 shrink-0 opacity-70" />}
        <CommitInput
          className="w-full bg-transparent text-sm font-bold text-text-primary outline-none"
          value={title}
          placeholder={titlePlaceholder}
          singleLine={titleSingleLine}
          defaultEditing={isNew}
          onCommit={onTitleCommit}
          onEnter={advanceToBody}
        />
      </div>
      {children}
    </div>
  );
}
