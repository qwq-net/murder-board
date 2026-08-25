import { describe, expect, it } from "vitest";
import { moveItem } from "@/lib/moveItem";

describe("moveItem", () => {
  it("後方へ移すと対象行の位置に収まる", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("前方へ移すと対象行の位置に収まる", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("同じ位置への移動は並びを変えない", () => {
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("from が範囲外なら元の内容のまま返す", () => {
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("元の配列を変えない", () => {
    const src = ["a", "b", "c"];
    moveItem(src, 0, 2);
    expect(src).toEqual(["a", "b", "c"]);
  });
});
