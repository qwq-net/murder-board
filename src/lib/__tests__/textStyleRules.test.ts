import { describe, expect, it } from "vitest";
import { splitByRules } from "../textStyleRules";

const rule = (key: string, id = key) => ({ key, id });

describe("splitByRules", () => {
  it("ルールが無ければ全体を 1 区間で返す", () => {
    expect(splitByRules("執事が怪しい", [])).toEqual([{ text: "執事が怪しい" }]);
  });

  it("空テキストは 1 区間で返す", () => {
    expect(splitByRules("", [rule("執事")])).toEqual([{ text: "" }]);
  });

  it("一致部分に rule が付き、結合すると元のテキストに戻る", () => {
    const runs = splitByRules("犯人は執事だ", [rule("執事")]);
    expect(runs).toEqual([
      { text: "犯人は" },
      { text: "執事", rule: rule("執事") },
      { text: "だ" },
    ]);
    expect(runs.map((r) => r.text).join("")).toBe("犯人は執事だ");
  });

  it("同じ key の複数回の出現をすべて拾う", () => {
    const runs = splitByRules("執事と執事", [rule("執事")]);
    expect(runs.filter((r) => r.rule !== undefined)).toHaveLength(2);
  });

  it("同じ位置では長い key が勝つ", () => {
    const runs = splitByRules("執事の証言は怪しい", [rule("執事"), rule("執事の証言")]);
    expect(runs[0]).toEqual({ text: "執事の証言", rule: rule("執事の証言") });
  });

  it("同長の key は rules で先の方が勝つ", () => {
    const runs = splitByRules("執事", [rule("執事", "a"), rule("執事", "b")]);
    expect(runs[0]!.rule).toEqual(rule("執事", "a"));
  });

  it("空の key は無視する", () => {
    expect(splitByRules("執事", [rule("")])).toEqual([{ text: "執事" }]);
  });

  it("先頭・末尾の一致も区間になる", () => {
    expect(splitByRules("執事が探偵", [rule("執事"), rule("探偵")])).toEqual([
      { text: "執事", rule: rule("執事") },
      { text: "が" },
      { text: "探偵", rule: rule("探偵") },
    ]);
  });
});
