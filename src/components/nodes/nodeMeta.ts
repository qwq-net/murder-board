import {
  ArrowLeftRight,
  Clock,
  Layers,
  Link,
  List,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { DEFAULT_NODE_WIDTHS, type WidthKind } from "@/lib/nodeWidths";
import { useBoardStore } from "@/store";
import type { BoardNodeKind } from "@/types/board";

// ノード種別を示すアイコン。ツールバーと同じ lucide を使い、
// ノードヘッダと Board の右クリックメニューで共用する
export const KIND_ICONS = {
  sticky: StickyNote,
  timeline: Clock,
  list: List,
  keyword: Link,
  character: Users,
  actionlog: ArrowLeftRight,
  stack: Layers,
} satisfies Record<BoardNodeKind, LucideIcon>;

// ノード枠に使う横幅。設定があればその値、無ければ種別ごとの既定値を返す。
// 使われ方: 各ノードコンポーネントが frameStyle の width としてそのまま渡す前提
export const useNodeWidth = (kind: WidthKind): number =>
  useBoardStore((s) => s.nodeWidths[kind] ?? DEFAULT_NODE_WIDTHS[kind]);

// ノード配色を 1 本で決める --node-accent 変数を frameStyle として与えるためのスタイル。
// accent には CSS の色値を渡す。var() 参照のままでよい。
export const nodeAccentStyle = (accent: string) =>
  // SAFETY: カスタムプロパティは実行時のインラインスタイルとして有効だが、
  // CSSProperties がキーとして許さないためだけの表明
  ({ "--node-accent": accent }) as CSSProperties;
