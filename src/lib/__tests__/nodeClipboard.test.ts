import { describe, expect, it } from "vitest";
import type { StackNodeType, StickyNodeType } from "@/types/board";
import { materializeNodes, snapshotNodes } from "../nodeClipboard";

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

describe("snapshotNodes", () => {
  it("見つからない id は null を返す", () => {
    expect(snapshotNodes([sticky("a", 0, 0)], "ghost")).toBeNull();
  });

  it("実行時状態を持ち込まず、data は深いコピーになる", () => {
    const original = { ...sticky("a", 5, 5), selected: true, measured: { width: 250 } };
    const snap = snapshotNodes([original], "a")!;
    expect(snap[0]).not.toHaveProperty("selected");
    expect(snap[0]).not.toHaveProperty("measured");
    original.data.text = "書き換え";
    expect(snap[0]!.data).toMatchObject({ text: "メモ" });
  });

  it("スタックは子を含めて先頭が root の並びで返す", () => {
    const nodes = [stack("st"), sticky("a", 8, 40, "st"), sticky("b", 8, 170, "st")];
    const snap = snapshotNodes(nodes, "st")!;
    expect(snap.map((n) => n.id)).toEqual(["st", "a", "b"]);
    expect(snap[0]).toMatchObject({ width: 266, height: 300 });
  });
});

describe("materializeNodes", () => {
  it("先頭を指定位置に置き、id を再採番し、root の parentId を外す", () => {
    const snap = snapshotNodes([sticky("a", 8, 40, "st")], "a")!;
    const pasted = materializeNodes(snap, { x: 300, y: 400 });
    expect(pasted).toHaveLength(1);
    expect(pasted[0]!.id).not.toBe("a");
    expect(pasted[0]!.position).toEqual({ x: 300, y: 400 });
    expect(pasted[0]!.parentId).toBeUndefined();
  });

  it("子は親相対位置のまま新しい親 id に付け替える", () => {
    const nodes = [stack("st"), sticky("a", 8, 40, "st")];
    const pasted = materializeNodes(snapshotNodes(nodes, "st")!, { x: 0, y: 0 });
    const [root, child] = pasted;
    expect(child!.parentId).toBe(root!.id);
    expect(root!.id).not.toBe("st");
    expect(child!.position).toEqual({ x: 8, y: 40 });
  });

  it("同じスナップショットからの複数回の貼り付けは毎回独立した id になる", () => {
    const snap = snapshotNodes([sticky("a", 0, 0)], "a")!;
    const first = materializeNodes(snap, { x: 0, y: 0 });
    const second = materializeNodes(snap, { x: 10, y: 10 });
    expect(first[0]!.id).not.toBe(second[0]!.id);
  });
});
