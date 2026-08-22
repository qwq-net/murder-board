import { useNodeId, type NodeProps } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
import { CommitInput } from "@/components/nodes/CommitInput";
import { KIND_ICONS } from "@/components/nodes/nodeMeta";
import { useBoardStore } from "@/store";

// 全ノード種別共通の外枠。枠・タイトルヘッダ・選択リングを持ち、ヘッダのタイトル左には
// 自ノードの種別アイコンが付く。種別は store から id で引く。
// 幅や配色は frameClassName / frameStyle / headerClassName / headerStyle で種別ごとに与える。
// 枠は relative なので、children 内の absolute 配置はこの枠を基準にできる。
// タイトルは blur で確定し、変更があったときだけ onTitleCommit が呼ばれる。
// 既定で折り返して全文表示し、ヘッダの高さを固定したいノードだけが titleSingleLine で
// 1 行に省略する。
// 選択リングは親スタックも選択中なら表示しない。スタックごと選んだときにスタックだけを
// 光らせる見た目上の抑制で、選択状態そのものは変えない。
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
  const id = useNodeId();
  const parentSelected = useBoardStore((s) => {
    const parentId = s.nodes.find((n) => n.id === id)?.parentId;
    return parentId !== undefined && s.nodes.some((n) => n.id === parentId && n.selected === true);
  });
  const kind = useBoardStore((s) => s.nodes.find((n) => n.id === id)?.type);
  const Icon = kind !== undefined ? KIND_ICONS[kind] : null;
  return (
    <div
      className={`relative rounded-sm border shadow-md ${frameClassName} ${
        selected && !parentSelected ? "ring-2 ring-accent" : ""
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
          onCommit={onTitleCommit}
        />
      </div>
      {children}
    </div>
  );
}
