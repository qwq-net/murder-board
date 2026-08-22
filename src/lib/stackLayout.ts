/**
 * スタックノードの整列・所属判定ロジック（純関数・UI 非依存）。
 *
 * 順番は順番専用のデータではなく、子ノードの親相対 y 座標の昇順そのもので表す。
 * 挿入・離脱のたびにここで y を詰め直すことで、同期すべき状態を増やさない。
 */
import type { NodeChange } from "@xyflow/react";
import { DEFAULT_NODE_WIDTHS } from "@/lib/nodeWidths";
import type { BoardNode } from "@/types/board";

export const STACK_PAD = 8;
export const STACK_GAP = 8;
export const STACK_HEADER_H = 32;
export const STACK_EMPTY_H = 96;
const FALLBACK_CHILD_W = 192;
const FALLBACK_CHILD_H = 80;

// 空スタックの横幅。通常メモ 1 枚が入ったスタックと同じ幅に見せるための計算で、
// stickyWidth には通常メモの横幅設定を渡す
export const stackEmptyWidth = (stickyWidth: number): number => stickyWidth + STACK_PAD * 2;

// 横幅設定に手が届かない文脈で使う空スタック幅の既定値
export const STACK_EMPTY_W = stackEmptyWidth(DEFAULT_NODE_WIDTHS.sticky);

// 指定スタックの子を相対 y の昇順に縦一列へ詰め直し、スタック自体の width/height を
// 子の実測サイズから再計算した新しい nodes 配列を返す。実測の無い子はフォールバック
// 寸法で扱う。子が無ければ幅 emptyWidth・高さ既定の空サイズになる。位置・サイズに
// 変化のないノードは同一参照のまま返し、stackId がスタックを指していなければ
// nodes をそのまま返す。
export function relayoutStack(
  nodes: BoardNode[],
  stackId: string,
  emptyWidth: number = STACK_EMPTY_W,
): BoardNode[] {
  const stack = nodes.find((n) => n.id === stackId);
  if (stack?.type !== "stack") return nodes;

  const children = nodes
    .filter((n) => n.parentId === stackId)
    .toSorted((a, b) => a.position.y - b.position.y);

  let y = STACK_HEADER_H + STACK_PAD;
  let maxW = 0;
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of children) {
    positions.set(child.id, { x: STACK_PAD, y });
    y += (child.measured?.height ?? FALLBACK_CHILD_H) + STACK_GAP;
    maxW = Math.max(maxW, child.measured?.width ?? FALLBACK_CHILD_W);
  }

  const width = children.length === 0 ? emptyWidth : maxW + STACK_PAD * 2;
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

// 1 ノード分のドロップ解決。abs は絶対座標、from は元の親、to は所属先のスタック。
// to と from が同じなら同一スタック内の並び直しを意味する
type DropOp = { id: string; abs: { x: number; y: number }; from?: string; to?: string };

// ドロップ時点の配置に対して、ノードの所属先を「中心点がスタック矩形に入っていれば
// 所属、いなければ非所属」で解決する。所属に変化も並び直しも無ければ null
function resolveDrop(nodes: BoardNode[], nodeId: string): DropOp | null {
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

  if (!target && !oldParent) return null;
  return { id: nodeId, abs, from: oldParent?.id, to: target?.id };
}

// ドラッグ終了した複数ノードのスタック所属を「ドロップ後にスタックへ重なっていれば所属、
// いなければ非所属」の一本のルールで解決した nodes を返す。判定は全ノード分を
// ドロップ時点の配置に対して行う。先に適用するとスタックの詰め直しで矩形が変わり、
// 後続ノードの判定がずれるため。所属時は座標を親相対へ変換して配列末尾へ移し
// （React Flow の「親は子より前」の制約を満たすため）、離脱時は絶対座標へ戻す。
// 関係するスタックは最後にまとめて詰め直す。どのノードにも変更が無ければ null を返す。
// 使われ方: store の onNodeDragStop からドラッグされた選択ノード全件で呼ばれる前提。
// emptyWidth は空になったスタックの幅で、relayoutStack へそのまま渡る。
export function applyStackDrops(
  nodes: BoardNode[],
  ids: string[],
  emptyWidth: number = STACK_EMPTY_W,
): BoardNode[] | null {
  const ops = ids.map((id) => resolveDrop(nodes, id)).filter((op) => op !== null);
  if (ops.length === 0) return null;

  let next = nodes;
  const affected = new Set<string>();
  for (const op of ops) {
    const current = next.find((n) => n.id === op.id)!;
    if (op.to !== undefined) {
      const target = next.find((n) => n.id === op.to)!;
      const attached: BoardNode = {
        ...current,
        parentId: op.to,
        position: { x: op.abs.x - target.position.x, y: op.abs.y - target.position.y },
      };
      next = [...next.filter((n) => n.id !== op.id), attached];
    } else {
      const { parentId: _parentId, ...detached } = current;
      // SAFETY: current から parentId を除き position を差し替えただけで、type と data の
      // 対応は崩れていない。rest 分解でユニオンの判別が落ちるのを戻すだけの表明
      next = next.map((n) =>
        n.id === op.id ? ({ ...detached, position: op.abs } as BoardNode) : n,
      );
    }
    if (op.from !== undefined) affected.add(op.from);
    if (op.to !== undefined) affected.add(op.to);
  }
  for (const stackId of affected) next = relayoutStack(next, stackId, emptyWidth);
  return next;
}

// changes にスタックの子のサイズ変化（type: "dimensions"）が含まれていたら、その親
// スタックを詰め直した nodes を返す。テキストの折り返しなどで子の高さが変わっても、
// ドラッグを待たずに重なりを解消するためのもの。対象が無ければ nodes をそのまま返す。
// 使われ方: store の onNodesChange で applyNodeChanges の適用後に毎回呼ばれる前提。
// 詰め直しで変化が無ければ同一参照が返るため、続けて呼ばれても発散しない。
// emptyWidth は空になったスタックの幅で、relayoutStack へそのまま渡る。
export function relayoutOnDimensionChanges(
  nodes: BoardNode[],
  changes: NodeChange<BoardNode>[],
  emptyWidth: number = STACK_EMPTY_W,
): BoardNode[] {
  const parents = new Set<string>();
  for (const c of changes) {
    if (c.type !== "dimensions") continue;
    const parentId = nodes.find((n) => n.id === c.id)?.parentId;
    if (parentId !== undefined) parents.add(parentId);
  }
  let next = nodes;
  for (const stackId of parents) next = relayoutStack(next, stackId, emptyWidth);
  return next;
}
