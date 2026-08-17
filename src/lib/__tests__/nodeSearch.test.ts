import { describe, expect, it } from "vitest";
import {
  buildSnippetSegments,
  highlightSegments,
  searchNodes,
  tokenizeQuery,
} from "@/lib/nodeSearch";
import type { BoardNode, BoardNodeKind } from "@/types/board";

const ORDER: BoardNodeKind[] = ["sticky", "timeline", "list", "character"];

function sticky(id: string, title: string, text: string): BoardNode {
  return { id, type: "sticky", position: { x: 0, y: 0 }, data: { title, text, color: "yellow" } };
}

function timeline(id: string, title: string, entries: { time: string; text: string }[]): BoardNode {
  return {
    id,
    type: "timeline",
    position: { x: 0, y: 0 },
    data: { title, entries: entries.map((e, i) => ({ id: `${id}-${i}`, ...e })) },
  };
}

function list(id: string, title: string, texts: string[]): BoardNode {
  return {
    id,
    type: "list",
    position: { x: 0, y: 0 },
    data: { title, entries: texts.map((text, i) => ({ id: `${id}-${i}`, text })) },
  };
}

describe("tokenizeQuery", () => {
  it("スペース区切りで小文字化して分解する", () => {
    expect(tokenizeQuery("Alibi  犯人　ナイフ")).toEqual(["alibi", "犯人", "ナイフ"]);
  });

  it("空白のみなら空配列を返す", () => {
    expect(tokenizeQuery("   ")).toEqual([]);
  });
});

describe("searchNodes", () => {
  const nodes: BoardNode[] = [
    list("l1", "証拠品", ["血の付いたナイフ", "手袋"]),
    sticky("s1", "アリバイ", "執事は 21 時に厨房にいた"),
    sticky("s2", "", "犯人はナイフを使った"),
    timeline("t1", "事件当夜", [{ time: "21:00", text: "悲鳴が聞こえた" }]),
  ];

  it("キーワードが無ければ空配列を返す", () => {
    expect(searchNodes("", nodes, ORDER, 50)).toEqual([]);
  });

  it("タイトル・本文の両方を対象に大文字小文字を区別せず一致する", () => {
    const groups = searchNodes("ありばい".toUpperCase(), nodes, ORDER, 50);
    expect(groups).toHaveLength(0);

    const byTitle = searchNodes("アリバイ", nodes, ORDER, 50);
    expect(byTitle.flatMap((g) => g.matches.map((m) => m.node.id))).toEqual(["s1"]);
  });

  it("複数キーワードは AND で絞り込む", () => {
    const groups = searchNodes("ナイフ 犯人", nodes, ORDER, 50);
    expect(groups.flatMap((g) => g.matches.map((m) => m.node.id))).toEqual(["s2"]);
  });

  it("種別を order の順にグループ化し、ヒット 0 件の種別は含めない", () => {
    const groups = searchNodes("ナイフ", nodes, ORDER, 50);
    expect(groups.map((g) => g.kind)).toEqual(["sticky", "list"]);
  });

  it("timeline の本文は時刻とテキストを含む", () => {
    const groups = searchNodes("21:00", nodes, ORDER, 50);
    expect(groups[0]?.matches[0]?.body).toBe("21:00 悲鳴が聞こえた");
  });

  it("全体で maxResults 件に達したら打ち切る", () => {
    const many = Array.from({ length: 5 }, (_, i) => sticky(`m${i}`, "", "ナイフ"));
    const groups = searchNodes("ナイフ", many, ORDER, 3);
    expect(groups[0]?.matches).toHaveLength(3);
  });
});

describe("highlightSegments", () => {
  it("一致箇所をハイライト区間として分割する", () => {
    expect(highlightSegments("abcab", ["b"])).toEqual([
      { text: "a", highlighted: false },
      { text: "b", highlighted: true },
      { text: "ca", highlighted: false },
      { text: "b", highlighted: true },
    ]);
  });

  it("重なり・隣接する一致区間はマージする", () => {
    expect(highlightSegments("abc", ["ab", "bc"])).toEqual([{ text: "abc", highlighted: true }]);
  });

  it("一致が無ければ全体を 1 セグメントで返す", () => {
    expect(highlightSegments("abc", ["x"])).toEqual([{ text: "abc", highlighted: false }]);
  });

  it("空文字なら空配列を返す", () => {
    expect(highlightSegments("", ["x"])).toEqual([]);
  });
});

describe("buildSnippetSegments", () => {
  it("マッチ周辺を切り出し、切り落とした側に … を付ける", () => {
    const content = `${"あ".repeat(100)}ナイフ${"い".repeat(100)}`;
    const segments = buildSnippetSegments(content, ["ナイフ"]);
    expect(segments[0]).toEqual({ text: "…", highlighted: false });
    expect(segments.at(-1)).toEqual({ text: "…", highlighted: false });
    expect(segments.some((s) => s.highlighted && s.text === "ナイフ")).toBe(true);
  });

  it("本文に一致が無ければ冒頭をハイライト無しで返す", () => {
    const segments = buildSnippetSegments("あ".repeat(200), ["ナイフ"]);
    expect(segments).toEqual([{ text: "あ".repeat(120), highlighted: false }]);
  });

  it("空の本文なら空配列を返す", () => {
    expect(buildSnippetSegments("", ["x"])).toEqual([]);
  });
});
