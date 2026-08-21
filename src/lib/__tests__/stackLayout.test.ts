import { describe, expect, it } from "vitest";
import type { NodeChange } from "@xyflow/react";
import {
  applyStackDrop,
  applyStackDrops,
  relayoutOnDimensionChanges,
  relayoutStack,
  STACK_EMPTY_H,
  STACK_EMPTY_W,
  STACK_GAP,
  STACK_HEADER_H,
  STACK_PAD,
} from "@/lib/stackLayout";
import type { BoardNode } from "@/types/board";

function stack(
  id: string,
  position: { x: number; y: number },
  size?: { width: number; height: number },
): BoardNode {
  return { id, type: "stack", position, ...size, data: { title: "" } };
}

function sticky(
  id: string,
  position: { x: number; y: number },
  opts: { parentId?: string; measured?: { width: number; height: number } } = {},
): BoardNode {
  return {
    id,
    type: "sticky",
    position,
    ...opts,
    data: { title: "", text: "", color: "yellow" },
  };
}

const byId = (nodes: BoardNode[], id: string) => nodes.find((n) => n.id === id)!;

describe("relayoutStack", () => {
  it("子を相対 y の昇順に縦へ詰め直す", () => {
    const nodes = [
      stack("st", { x: 0, y: 0 }),
      sticky("b", { x: 30, y: 500 }, { parentId: "st", measured: { width: 100, height: 50 } }),
      sticky("a", { x: 30, y: 100 }, { parentId: "st", measured: { width: 100, height: 40 } }),
    ];
    const result = relayoutStack(nodes, "st");
    expect(byId(result, "a").position).toEqual({ x: STACK_PAD, y: STACK_HEADER_H + STACK_PAD });
    expect(byId(result, "b").position).toEqual({
      x: STACK_PAD,
      y: STACK_HEADER_H + STACK_PAD + 40 + STACK_GAP,
    });
  });

  it("スタックのサイズが最大子幅と子の合計高さになる", () => {
    const nodes = [
      stack("st", { x: 0, y: 0 }),
      sticky("a", { x: 0, y: 0 }, { parentId: "st", measured: { width: 120, height: 40 } }),
      sticky("b", { x: 0, y: 1 }, { parentId: "st", measured: { width: 200, height: 50 } }),
    ];
    const st = byId(relayoutStack(nodes, "st"), "st");
    expect(st.width).toBe(200 + STACK_PAD * 2);
    expect(st.height).toBe(STACK_HEADER_H + STACK_PAD + 40 + STACK_GAP + 50 + STACK_PAD);
  });

  it("未計測の子はフォールバック寸法で扱う", () => {
    const nodes = [stack("st", { x: 0, y: 0 }), sticky("a", { x: 0, y: 0 }, { parentId: "st" })];
    const st = byId(relayoutStack(nodes, "st"), "st");
    expect(st.width).toBeGreaterThan(STACK_PAD * 2);
    expect(st.height).toBeGreaterThan(STACK_HEADER_H + STACK_PAD * 2);
  });

  it("子が無ければ既定の空サイズになる", () => {
    const nodes = [stack("st", { x: 0, y: 0 }, { width: 999, height: 999 })];
    const st = byId(relayoutStack(nodes, "st"), "st");
    expect(st.width).toBe(STACK_EMPTY_W);
    expect(st.height).toBe(STACK_EMPTY_H);
  });

  it("位置・サイズに変化のないノードは同一参照のまま返す", () => {
    const outsider = sticky("out", { x: 900, y: 900 });
    const nodes = [
      stack("st", { x: 0, y: 0 }, { width: STACK_EMPTY_W, height: STACK_EMPTY_H }),
      outsider,
    ];
    const result = relayoutStack(nodes, "st");
    expect(byId(result, "out")).toBe(outsider);
    expect(byId(result, "st")).toBe(nodes[0]);
  });

  it("stackId がスタックでなければ nodes をそのまま返す", () => {
    const nodes = [sticky("a", { x: 0, y: 0 })];
    expect(relayoutStack(nodes, "a")).toBe(nodes);
  });
});

describe("applyStackDrop", () => {
  it("スタックに重ねた通常ノードが子になり相対座標へ変わる", () => {
    const nodes = [
      stack("st", { x: 100, y: 100 }, { width: 200, height: 300 }),
      sticky("a", { x: 150, y: 150 }, { measured: { width: 100, height: 50 } }),
    ];
    const result = applyStackDrop(nodes, "a")!;
    const a = byId(result, "a");
    expect(a.parentId).toBe("st");
    expect(a.position.x).toBe(STACK_PAD);
    // 親相対の詰め直し後の座標になる
    expect(a.position.y).toBe(STACK_HEADER_H + STACK_PAD);
    // 親が先の制約: 子は配列でスタックより後ろ
    expect(result.indexOf(byId(result, "st"))).toBeLessThan(result.indexOf(a));
  });

  it("子を外へ出すと parentId が外れ絶対座標へ戻り、元スタックが詰め直る", () => {
    const nodes = [
      stack("st", { x: 100, y: 100 }, { width: 200, height: 300 }),
      sticky("a", { x: 900, y: 900 }, { parentId: "st", measured: { width: 100, height: 50 } }),
      sticky(
        "b",
        { x: STACK_PAD, y: 500 },
        { parentId: "st", measured: { width: 100, height: 50 } },
      ),
    ];
    const result = applyStackDrop(nodes, "a")!;
    const a = byId(result, "a");
    expect(a.parentId).toBeUndefined();
    expect(a.position).toEqual({ x: 1000, y: 1000 });
    // 残った子 b は先頭位置へ詰め直る
    expect(byId(result, "b").position.y).toBe(STACK_HEADER_H + STACK_PAD);
  });

  it("同じスタック内へのドロップは y に応じて並び直る", () => {
    const y1 = STACK_HEADER_H + STACK_PAD;
    const nodes = [
      stack("st", { x: 0, y: 0 }, { width: 200, height: 300 }),
      sticky(
        "a",
        { x: STACK_PAD, y: y1 },
        { parentId: "st", measured: { width: 100, height: 50 } },
      ),
      sticky(
        "b",
        { x: STACK_PAD, y: y1 + 50 + STACK_GAP },
        { parentId: "st", measured: { width: 100, height: 50 } },
      ),
    ];
    // a を b より下へドロップした状態にする
    const dragged = nodes.map((n) =>
      n.id === "a" ? { ...n, position: { x: STACK_PAD, y: y1 + 200 } } : n,
    );
    const result = applyStackDrop(dragged, "a")!;
    expect(byId(result, "b").position.y).toBe(y1);
    expect(byId(result, "a").position.y).toBe(y1 + 50 + STACK_GAP);
  });

  it("スタック外の通常ノードの移動は null を返す", () => {
    const nodes = [
      stack("st", { x: 0, y: 0 }, { width: 200, height: 300 }),
      sticky("a", { x: 900, y: 900 }, { measured: { width: 100, height: 50 } }),
    ];
    expect(applyStackDrop(nodes, "a")).toBeNull();
  });

  it("スタック自身のドラッグは null を返す", () => {
    const nodes = [
      stack("st", { x: 0, y: 0 }, { width: 200, height: 300 }),
      stack("st2", { x: 10, y: 10 }),
    ];
    expect(applyStackDrop(nodes, "st2")).toBeNull();
  });
});

describe("applyStackDrops", () => {
  it("ドロップした複数ノードがまとめてスタックの子になる", () => {
    const nodes = [
      stack("st", { x: 0, y: 0 }, { width: 200, height: 300 }),
      sticky("a", { x: 10, y: 50 }, { measured: { width: 100, height: 50 } }),
      sticky("b", { x: 10, y: 120 }, { measured: { width: 100, height: 50 } }),
    ];
    const result = applyStackDrops(nodes, ["a", "b"])!;
    expect(byId(result, "a").parentId).toBe("st");
    expect(byId(result, "b").parentId).toBe("st");
    expect(byId(result, "a").position.y).toBeLessThan(byId(result, "b").position.y);
  });

  it("いずれのノードにも変更が無ければ null を返す", () => {
    const nodes = [
      stack("st", { x: 0, y: 0 }, { width: 200, height: 300 }),
      sticky("a", { x: 900, y: 900 }, { measured: { width: 100, height: 50 } }),
      sticky("b", { x: 900, y: 990 }, { measured: { width: 100, height: 50 } }),
    ];
    expect(applyStackDrops(nodes, ["a", "b"])).toBeNull();
  });
});

describe("relayoutOnDimensionChanges", () => {
  const dims = (id: string): NodeChange<BoardNode> => ({
    id,
    type: "dimensions",
    dimensions: { width: 100, height: 90 },
  });

  it("サイズが変わった子を持つスタックを詰め直す", () => {
    const y1 = STACK_HEADER_H + STACK_PAD;
    const nodes = [
      stack("st", { x: 0, y: 0 }),
      // a が 50 → 90 に伸びた直後で、b の位置がまだ古い前提
      sticky(
        "a",
        { x: STACK_PAD, y: y1 },
        { parentId: "st", measured: { width: 100, height: 90 } },
      ),
      sticky(
        "b",
        { x: STACK_PAD, y: y1 + 50 + STACK_GAP },
        { parentId: "st", measured: { width: 100, height: 50 } },
      ),
    ];
    const result = relayoutOnDimensionChanges(nodes, [dims("a")]);
    expect(byId(result, "b").position.y).toBe(y1 + 90 + STACK_GAP);
  });

  it("スタックの子が絡まないサイズ変化なら nodes をそのまま返す", () => {
    const nodes = [stack("st", { x: 0, y: 0 }), sticky("a", { x: 900, y: 900 })];
    expect(relayoutOnDimensionChanges(nodes, [dims("a")])).toBe(nodes);
  });

  it("サイズ変化以外の change は無視する", () => {
    const nodes = [
      stack("st", { x: 0, y: 0 }),
      sticky("a", { x: 999, y: 999 }, { parentId: "st" }),
    ];
    const change: NodeChange<BoardNode> = { id: "a", type: "select", selected: true };
    expect(relayoutOnDimensionChanges(nodes, [change])).toBe(nodes);
  });
});
