/**
 * スタックノードの整列・所属判定ロジック（純関数・UI 非依存）。
 *
 * 順番は順番専用のデータではなく、子ノードの親相対 y 座標の昇順そのもので表す。
 * 挿入・離脱のたびにここで y を詰め直すことで、同期すべき状態を増やさない。
 */
import type { BoardEdge, BoardNode } from "@/types/board";

export const STACK_PAD = 8;
export const STACK_GAP = 8;
export const STACK_HEADER_H = 32;
export const STACK_EMPTY_W = 208;
export const STACK_EMPTY_H = 96;
const FALLBACK_CHILD_W = 192;
const FALLBACK_CHILD_H = 80;

// 指定スタックの子を相対 y の昇順に縦一列へ詰め直し、スタック自体の width/height を
// 子の実測サイズから再計算した新しい nodes 配列を返す。実測の無い子はフォールバック
// 寸法で扱う。子が無ければ既定の空サイズになる。位置・サイズに変化のないノードは
// 同一参照のまま返し、stackId がスタックを指していなければ nodes をそのまま返す。
export function relayoutStack(nodes: BoardNode[], stackId: string): BoardNode[] {
  const stack = nodes.find((n) => n.id === stackId);
  if (stack?.type !== "stack") return nodes;

  const children = nodes
    .filter((n) => n.parentId === stackId)
    .sort((a, b) => a.position.y - b.position.y);

  let y = STACK_HEADER_H + STACK_PAD;
  let maxW = 0;
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of children) {
    positions.set(child.id, { x: STACK_PAD, y });
    y += (child.measured?.height ?? FALLBACK_CHILD_H) + STACK_GAP;
    maxW = Math.max(maxW, child.measured?.width ?? FALLBACK_CHILD_W);
  }

  const width = children.length === 0 ? STACK_EMPTY_W : maxW + STACK_PAD * 2;
  const height = children.length === 0 ? STACK_EMPTY_H : y - STACK_GAP + STACK_PAD;

  return nodes.map((n) => {
    if (n.id === stackId) {
      return n.width === width && n.height === height ? n : { ...n, width, height };
    }
    const p = positions.get(n.id);
    if (!p || (n.position.x === p.x && n.position.y === p.y)) return n;
    return { ...n, position: p };
  });
}

// ドラッグ終了したノードのスタック所属を「ドロップ後にスタックへ重なっていれば所属、
// いなければ非所属」の一本のルールで解決した nodes を返す。重なり判定はノード中心点が
// スタック矩形に入っているか。所属時は座標を親相対へ変換して配列末尾へ移し（React Flow の
// 「親は子より前」の制約を満たすため）、離脱時は絶対座標へ戻す。関係するスタックは
// 詰め直す。所属の変わらないスタック外の移動やスタック自身のドラッグでは null を返す。
// 使われ方: store の onNodeDragStop から毎ドラッグ終了時に呼ばれる前提。
export function applyStackDrop(nodes: BoardNode[], nodeId: string): BoardNode[] | null {
  const current = nodes.find((n) => n.id === nodeId);
  if (!current || current.type === "stack") return null;

  const oldParent = current.parentId ? nodes.find((n) => n.id === current.parentId) : undefined;
  const abs = oldParent
    ? { x: oldParent.position.x + current.position.x, y: oldParent.position.y + current.position.y }
    : current.position;
  const center = {
    x: abs.x + (current.measured?.width ?? FALLBACK_CHILD_W) / 2,
    y: abs.y + (current.measured?.height ?? FALLBACK_CHILD_H) / 2,
  };
  const target = nodes.find(
    (n) =>
      n.type === "stack" &&
      center.x >= n.position.x &&
      center.x <= n.position.x + (n.width ?? STACK_EMPTY_W) &&
      center.y >= n.position.y &&
      center.y <= n.position.y + (n.height ?? STACK_EMPTY_H),
  );

  if (target) {
    const attached: BoardNode = {
      ...current,
      parentId: target.id,
      position: { x: abs.x - target.position.x, y: abs.y - target.position.y },
    };
    let next: BoardNode[] = [...nodes.filter((n) => n.id !== nodeId), attached];
    next = relayoutStack(next, target.id);
    if (oldParent && oldParent.id !== target.id) next = relayoutStack(next, oldParent.id);
    return next;
  }

  if (!oldParent) return null;
  const { parentId: _parentId, ...detached } = current;
  // SAFETY: current から parentId を除き position を差し替えただけで、type と data の
  // 対応は崩れていない。rest 分解でユニオンの判別が落ちるのを戻すだけの表明
  const next = nodes.map((n) =>
    n.id === nodeId ? ({ ...detached, position: abs } as BoardNode) : n,
  );
  return relayoutStack(next, oldParent.id);
}

// 子ノードに付いた線を親スタックへ付け替えた表示用の edges を返す。id とハンドルは
// 元のまま保つため、表示上の線への削除・選択は元の線にそのまま効く。同じスタック内の
// 子同士を結ぶ線は自己ループになるため表示から除く（データとしては残り、離脱で再び現れる）。
// 子が絡まない線は同一参照のまま返し、子が 1 つも無ければ edges をそのまま返す。
// 使われ方: Board が描画のたびに store の edges から導出する前提。store の edges は変更しない。
export function delegateEdgesToStacks(nodes: BoardNode[], edges: BoardEdge[]): BoardEdge[] {
  const parentOf = new Map<string, string>();
  for (const n of nodes) {
    if (n.parentId) parentOf.set(n.id, n.parentId);
  }
  if (parentOf.size === 0) return edges;

  const result: BoardEdge[] = [];
  for (const edge of edges) {
    const source = parentOf.get(edge.source) ?? edge.source;
    const target = parentOf.get(edge.target) ?? edge.target;
    if (source === edge.source && target === edge.target) {
      result.push(edge);
    } else if (source !== target) {
      result.push({ ...edge, source, target });
    }
  }
  return result;
}
