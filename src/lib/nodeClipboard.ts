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

// ids のノードをコピー用スナップショットにする。スタックが含まれるときは子も付いてきて、
// 常に親が子より前に並ぶ。親も ids に含まれる子は親側に含まれるため重複しない。
// ids が 1 つも実在しなければ空配列。
// 使われ方: 右クリックメニューのコピーと Ctrl+C/X から呼ばれ、戻り値がそのまま
// クリップボードとして保持される前提
export function snapshotSelection(nodes: BoardNode[], ids: ReadonlySet<string>): BoardNode[] {
  const result: BoardNode[] = [];
  for (const n of nodes) {
    if (!ids.has(n.id)) continue;
    if (n.parentId !== undefined && ids.has(n.parentId)) continue;
    result.push(strip(n));
    if (n.type === "stack") {
      for (const child of nodes) {
        if (child.parentId === n.id) result.push(strip(child));
      }
    }
  }
  return result;
}

// ids のノード群の盤面上の絶対位置でのバウンディング左上を返す。スタックの子は
// 親の位置を足して絶対化する。ids が 1 つも実在しなければ null。
// 「元の位置から少しずらして複製する」ときの配置計算に使う
export function selectionAnchor(
  nodes: BoardNode[],
  ids: ReadonlySet<string>,
): { x: number; y: number } | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const points = nodes
    .filter((n) => ids.has(n.id))
    .map((n) => {
      const parent = n.parentId !== undefined ? byId.get(n.parentId) : undefined;
      return {
        x: n.position.x + (parent?.position.x ?? 0),
        y: n.position.y + (parent?.position.y ?? 0),
      };
    });
  if (points.length === 0) return null;
  return { x: Math.min(...points.map((p) => p.x)), y: Math.min(...points.map((p) => p.y)) };
}

// スナップショットのトップレベル群のバウンディング左上。materializeNodes が
// position へ合わせる基準点
function snapshotAnchor(snapshot: BoardNode[]): { x: number; y: number } | null {
  const snapIds = new Set(snapshot.map((n) => n.id));
  const roots = snapshot.filter((n) => n.parentId === undefined || !snapIds.has(n.parentId));
  if (roots.length === 0) return null;
  return {
    x: Math.min(...roots.map((r) => r.position.x)),
    y: Math.min(...roots.map((r) => r.position.y)),
  };
}

// スナップショットを貼り付け用の新ノード列にする。トップレベルのノード群の
// バウンディング左上が position に来るよう相対配置を保って移動し、スタックの子は
// 親相対の位置のまま新しい親 id へ付け替える。親を伴わない子は独立ノードになる。
// ノード id はすべて再採番する。行 id は再採番しない。重複しても使われ方に影響しないため。
// 同じスナップショットで何度呼んでも、そのたびに独立したノード列を返す
export function materializeNodes(
  snapshot: BoardNode[],
  position: { x: number; y: number },
): BoardNode[] {
  const snapIds = new Set(snapshot.map((n) => n.id));
  const anchor = snapshotAnchor(snapshot);
  if (anchor === null) return [];
  const idMap = new Map(snapshot.map((n) => [n.id, nanoid()]));
  return snapshot.map((n) => {
    const { parentId, ...rest } = strip(n);
    if (parentId !== undefined && snapIds.has(parentId)) {
      return { ...rest, id: idMap.get(n.id)!, parentId: idMap.get(parentId)! };
    }
    return {
      ...rest,
      id: idMap.get(n.id)!,
      position: {
        x: position.x + n.position.x - anchor.x,
        y: position.y + n.position.y - anchor.y,
      },
    };
  });
}
