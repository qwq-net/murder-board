import { nanoid } from "nanoid";
import type { BoardNode } from "@/types/board";

// ノードのコピー・貼り付けの純ロジック。クリップボードの保持は呼び手が行う。

// 保存・複製に必要なフィールドだけを写した新しいノードを返す。selected や measured の
// ような React Flow が実行時に付ける状態は持ち込まない。data は深いコピーで、
// 元ノードの後からの編集はスナップショットへ影響しない
function strip(n: BoardNode): BoardNode {
  // SAFETY: type と data は同じノードから写しているため相関は保たれる。
  // ユニオンをまたぐ再構築を TS が追えないためだけの表明
  return {
    id: n.id,
    type: n.type,
    position: { ...n.position },
    data: structuredClone(n.data),
    ...(n.width !== undefined && { width: n.width }),
    ...(n.height !== undefined && { height: n.height }),
    ...(n.parentId !== undefined && { parentId: n.parentId }),
  } as BoardNode;
}

// rootId のノードをコピー用スナップショットにする。スタックなら子も含め、
// 先頭が root・以降が子の並びで返す。rootId が見つからなければ null。
// 使われ方: 右クリックメニューの「コピー」から呼ばれ、戻り値がそのまま
// クリップボードとして保持される前提
export function snapshotNodes(nodes: BoardNode[], rootId: string): BoardNode[] | null {
  const root = nodes.find((n) => n.id === rootId);
  if (root === undefined) return null;
  return [root, ...nodes.filter((n) => n.parentId === rootId)].map(strip);
}

// スナップショットを貼り付け用の新ノード列にする。先頭ノードを position へ置いて
// parentId を外し、子は親相対の位置のまま新しい親 id へ付け替える。ノード id は
// すべて再採番する。行 id は再採番しない。ノードをまたいで重複しても使われ方に影響しないため。
// 同じスナップショットで何度呼んでも、そのたびに独立したノード列を返す
export function materializeNodes(
  snapshot: BoardNode[],
  position: { x: number; y: number },
): BoardNode[] {
  const [root, ...children] = snapshot;
  if (root === undefined) return [];
  const { parentId: _parentId, ...rootRest } = strip(root);
  const rootId = nanoid();
  return [
    { ...rootRest, id: rootId, position: { ...position } },
    ...children.map((c) => ({ ...strip(c), id: nanoid(), parentId: rootId })),
  ];
}
