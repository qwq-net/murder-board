import type { Edge, Node } from '@xyflow/react';

export const STICKY_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'gray'] as const;
export type StickyColor = (typeof STICKY_COLORS)[number];

// 付箋ノードの中身。title/text は空文字を許す。作成直後は空で、付箋側が自動的に編集状態になる
export type StickyData = { title: string; text: string; color: StickyColor };

// タイムラインの 1 行。time は "HH:MM" を想定するが自由入力を許し、不正な時刻の行は末尾に並ぶ
export type TimelineEntry = { id: string; time: string; text: string };
export type TimelineData = { title: string; entries: TimelineEntry[] };

// リストメモの 1 行。text は作成直後の空行のような空文字を許す。並び順は登録順のまま
export type ListEntry = { id: string; text: string };
export type ListData = { title: string; entries: ListEntry[] };

export type StickyNodeType = Node<StickyData, 'sticky'>;
export type TimelineNodeType = Node<TimelineData, 'timeline'>;
export type ListNodeType = Node<ListData, 'list'>;
export type BoardNode = StickyNodeType | TimelineNodeType | ListNodeType;
export type BoardNodeKind = NonNullable<BoardNode['type']>;
export type BoardEdge = Edge;

// 1 セッション = IndexedDB の 1 レコード。nodes/edges を正規化せず丸ごと持つ
export type Session = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: BoardNode[];
  edges: BoardEdge[];
};

export type SessionMeta = Omit<Session, 'nodes' | 'edges'>;
