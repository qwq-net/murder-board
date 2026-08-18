import type { Edge, Node } from "@xyflow/react";

export const STICKY_COLORS = ["yellow", "pink", "blue", "green", "purple", "gray"] as const;
export type StickyColor = (typeof STICKY_COLORS)[number];

// 付箋ノードの中身。title/text は空文字を許す。作成直後は空で、付箋側が自動的に編集状態になる
export type StickyData = { title: string; text: string; color: StickyColor };

// タイムラインの 1 行。time は "HH:MM" を想定するが自由入力を許し、不正な時刻の行は末尾に並ぶ
export type TimelineEntry = { id: string; time: string; text: string };
export type TimelineData = { title: string; entries: TimelineEntry[] };

// リストメモの 1 行。text は作成直後の空行のような空文字を許す。並び順は登録順のまま
export type ListEntry = { id: string; text: string };
export type ListData = { title: string; entries: ListEntry[] };

// 登場人物メモの 1 行。color がその人物の識別色で、付箋と同じ 6 色を使う
export type CharacterEntry = { id: string; text: string; color: StickyColor };
export type CharacterData = { title: string; entries: CharacterEntry[] };

export type StickyNodeType = Node<StickyData, "sticky">;
export type TimelineNodeType = Node<TimelineData, "timeline">;
export type ListNodeType = Node<ListData, "list">;
export type CharacterNodeType = Node<CharacterData, "character">;
export type BoardNode = StickyNodeType | TimelineNodeType | ListNodeType | CharacterNodeType;
export type BoardNodeKind = NonNullable<BoardNode["type"]>;

// ノード種別の表示名。キーの並びがメニュー・検索結果グループの表示順を兼ねる
export const NODE_KIND_LABELS = {
  sticky: "通常メモ",
  timeline: "タイムラインメモ",
  list: "リストメモ",
  character: "登場人物メモ",
} satisfies Record<BoardNodeKind, string>;
// label を持たせない。このアプリのつながりは線だけで表現し、テキスト付与の機能は置かない
export type BoardEdge = Omit<Edge, "label">;

// 1 セッション = IndexedDB の 1 レコード。nodes/edges を正規化せず丸ごと持つ。
// isDemo は自動生成されるデモセッションの印。demoVersion が DEMO_VERSION と
// 一致しないデモは、起動時に最新の内容へ丸ごと置き換えられる
export type Session = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDemo?: boolean;
  demoVersion?: number;
  nodes: BoardNode[];
  edges: BoardEdge[];
};

export type SessionMeta = Omit<Session, "nodes" | "edges">;
