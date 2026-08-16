import type { Edge, Node } from '@xyflow/react';

export const STICKY_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'gray'] as const;
export type StickyColor = (typeof STICKY_COLORS)[number];

// 付箋ノードの中身。text は空文字を許す（作成直後は空で、付箋側が自動的に編集状態になる）
export type StickyData = { text: string; color: StickyColor };

export type BoardNode = Node<StickyData, 'sticky'>;
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
