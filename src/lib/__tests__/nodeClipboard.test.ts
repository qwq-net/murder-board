import { describe, expect, it } from "vitest";
import type { StackNodeType, StickyNodeType } from "@/types/board";
import { duplicateSelection, materializeNodes, snapshotSelection } from "../nodeClipboard";

const sticky = (id: string, x: number, y: number, parentId?: string): StickyNodeType => ({
  id,
  type: "sticky",
  position: { x, y },
  ...(parentId !== undefined && { parentId }),
  data: { title: "", text: "メモ", color: "yellow" },
});

const stack = (id: string): StackNodeType => ({
  id,
  type: "stack",
  position: { x: 100, y: 200 },
  width: 266,
  height: 300,
  data: { title: "まとめ" },
});

describe("snapshotSelection", () => {
  it("実在しない id だけなら空配列を返す", () => {
    expect(snapshotSelection([sticky("a", 0, 0)], new Set(["ghost"]))).toEqual([]);
  });

  it("実行時状態を持ち込まず、data は深いコピーになる", () => {
    const original = { ...sticky("a", 5, 5), selected: true, measured: { width: 250 } };
    const snap = snapshotSelection([original], new Set(["a"]));
    expect(snap[0]).not.toHaveProperty("selected");
    expect(snap[0]).not.toHaveProperty("measured");
    original.data.text = "書き換え";
    expect(snap[0]!.data).toMatchObject({ text: "メモ" });
  });

  it("親を伴わない子は位置を絶対座標へ直し parentId を落とす", () => {
    const nodes = [stack("st"), sticky("a", 8, 40, "st")];
    const snap = snapshotSelection(nodes, new Set(["a"]));
    expect(snap[0]!.position).toEqual({ x: 108, y: 240 });
    expect(snap[0]!.parentId).toBeUndefined();
  });

  it("スタックは子を含めて親が先の並びで返し、選択済みの子は重複しない", () => {
    const nodes = [stack("st"), sticky("a", 8, 40, "st"), sticky("b", 8, 170, "st")];
    const snap = snapshotSelection(nodes, new Set(["st", "a"]));
    expect(snap.map((n) => n.id)).toEqual(["st", "a", "b"]);
    expect(snap[0]).toMatchObject({ width: 266, height: 300 });
  });
});

describe("materializeNodes", () => {
  it("単体は指定位置に置き、id を再採番し、親を伴わない子の parentId を外す", () => {
    const snap = snapshotSelection([sticky("a", 8, 40, "st")], new Set(["a"]));
    const pasted = materializeNodes(snap, { x: 300, y: 400 });
    expect(pasted).toHaveLength(1);
    expect(pasted[0]!.id).not.toBe("a");
    expect(pasted[0]!.position).toEqual({ x: 300, y: 400 });
    expect(pasted[0]!.parentId).toBeUndefined();
  });

  it("スタックの子は親相対位置のまま新しい親 id に付け替える", () => {
    const nodes = [stack("st"), sticky("a", 8, 40, "st")];
    const pasted = materializeNodes(snapshotSelection(nodes, new Set(["st"])), { x: 0, y: 0 });
    const [root, child] = pasted;
    expect(child!.parentId).toBe(root!.id);
    expect(root!.id).not.toBe("st");
    expect(child!.position).toEqual({ x: 8, y: 40 });
  });

  it("複数ノードはバウンディング左上を指定位置に合わせ、相対配置を保つ", () => {
    const nodes = [sticky("a", 100, 100), sticky("b", 160, 40)];
    const pasted = materializeNodes(snapshotSelection(nodes, new Set(["a", "b"])), {
      x: 500,
      y: 500,
    });
    expect(pasted.map((n) => n.position)).toEqual([
      { x: 500, y: 560 },
      { x: 560, y: 500 },
    ]);
  });

  it("同じスナップショットからの複数回の貼り付けは毎回独立した id になる", () => {
    const snap = snapshotSelection([sticky("a", 0, 0)], new Set(["a"]));
    const first = materializeNodes(snap, { x: 0, y: 0 });
    const second = materializeNodes(snap, { x: 10, y: 10 });
    expect(first[0]!.id).not.toBe(second[0]!.id);
  });
});

describe("duplicateSelection", () => {
  it("スタックの子とトップレベルを混ぜても盤面上の相対配置を保って右下 24px にずらす", () => {
    const nodes = [stack("st"), sticky("a", 8, 40, "st"), sticky("b", 0, 0)];
    const dup = duplicateSelection(nodes, new Set(["a", "b"]));
    expect(dup!.label).toBe("2件を複製");
    expect(dup!.nodes.map((n) => n.position)).toEqual([
      { x: 132, y: 264 },
      { x: 24, y: 24 },
    ]);
  });

  it("実在しない id だけなら null を返す", () => {
    expect(duplicateSelection([sticky("a", 0, 0)], new Set(["ghost"]))).toBeNull();
  });
});
