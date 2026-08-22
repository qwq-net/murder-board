import type { NodeProps } from "@xyflow/react";
import type { ReactNode } from "react";
import { ColorPalette } from "@/components/nodes/ColorPalette";
import { nodeAccentStyle, useNodeWidth } from "@/components/nodes/nodeMeta";
import { NodeShell } from "@/components/nodes/NodeShell";
import type { WidthKind } from "@/lib/nodeWidths";
import { NODE_KIND_LABELS, type StickyColor } from "@/types/board";

// 行を積むパネル系のノード種別
type PanelKind = Exclude<WidthKind, "sticky">;

// パネル系ノード共通の外枠。NodeShell に加えて、種別から決まる定型をまとめて持つ。
// 配色は --node-accent 変数 1 本で決まり、color があれば付箋カラー、
// 無ければ種別の識別色 --color-panel-{kind}-accent になる。横幅は種別の設定値。
// タイトルのプレースホルダは種別ラベルで、選択中は上部に ColorPalette を出す。
// パレットの既定色スワッチは onColorPick に undefined を渡す。
// 使われ方: list / timeline / keyword / character / actionlog が body だけを children として渡す前提。
export function PanelNodeShell({
  kind,
  selected,
  color,
  title,
  onTitleCommit,
  onColorPick,
  children,
}: {
  kind: PanelKind;
  selected: NodeProps["selected"];
  color: StickyColor | undefined;
  title: string;
  onTitleCommit: (title: string) => void;
  onColorPick: (color: StickyColor | undefined) => void;
  children: ReactNode;
}) {
  const accent = color ? `var(--sticky-${color}-accent)` : `var(--color-panel-${kind}-accent)`;
  const width = useNodeWidth(kind);
  return (
    <NodeShell
      selected={selected}
      frameClassName="border-(--node-accent)/40 bg-bg-panel"
      frameStyle={{ ...nodeAccentStyle(accent), width }}
      headerClassName="bg-(--node-accent)/15"
      title={title}
      titlePlaceholder={NODE_KIND_LABELS[kind]}
      onTitleCommit={onTitleCommit}
    >
      {selected && (
        <ColorPalette
          color={color}
          defaultSwatch={`var(--color-panel-${kind}-accent)`}
          onPick={onColorPick}
        />
      )}
      {children}
    </NodeShell>
  );
}
