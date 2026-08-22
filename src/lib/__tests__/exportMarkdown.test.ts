import { describe, expect, it } from "vitest";
import { serializeMarkdown } from "@/lib/exportMarkdown";
import type { BoardNode } from "@/types/board";

const sticky = (id: string, title: string, text: string): BoardNode => ({
  id,
  type: "sticky",
  position: { x: 0, y: 0 },
  data: { title, text },
});

describe("serializeMarkdown", () => {
  it("セッション名が見出しになり、付箋は本文がそのまま入る", () => {
    const md = serializeMarkdown("第1話", [sticky("a", "気づき", "凶器は花瓶\n指紋なし")]);
    expect(md).toBe("# 第1話\n\n## 通常メモ: 気づき\n\n凶器は花瓶\n指紋なし\n");
  });

  it("無題ノードの見出しは種別ラベルだけになる", () => {
    const md = serializeMarkdown("s", [sticky("a", "", "本文")]);
    expect(md).toContain("## 通常メモ\n");
  });

  it("行を持つ種別は 1 行 1 箇条書きで、空行は出力しない", () => {
    const nodes: BoardNode[] = [
      {
        id: "t",
        type: "timeline",
        position: { x: 0, y: 0 },
        data: {
          title: "時系列",
          entries: [
            { id: "1", time: "21:00", text: "悲鳴" },
            { id: "2", time: "", text: "" },
          ],
        },
      },
      {
        id: "al",
        type: "actionlog",
        position: { x: 0, y: 0 },
        data: { title: "", entries: [{ id: "1", from: "山田", to: "田中", text: "口論" }] },
      },
    ];
    const md = serializeMarkdown("s", nodes);
    expect(md).toContain("## タイムライン: 時系列\n\n- 21:00 悲鳴\n");
    expect(md).toContain("## 行動ログ\n\n- 山田 ▶ 田中 口論\n");
  });

  it("本文が空のノードは見出しだけになる", () => {
    const md = serializeMarkdown("s", [sticky("a", "空", "")]);
    expect(md).toBe("# s\n\n## 通常メモ: 空\n");
  });

  it("スタックの子は y 昇順で親の直後に 1 段深い見出しで並ぶ", () => {
    const nodes: BoardNode[] = [
      {
        id: "st",
        type: "stack",
        position: { x: 0, y: 0 },
        data: { title: "容疑者" },
      },
      { ...sticky("b", "下の子", "B"), parentId: "st", position: { x: 0, y: 100 } },
      sticky("z", "後続", "Z"),
      { ...sticky("a", "上の子", "A"), parentId: "st", position: { x: 0, y: 40 } },
    ];
    const md = serializeMarkdown("s", nodes);
    expect(md).toBe(
      "# s\n\n## メモスタック: 容疑者\n\n### 通常メモ: 上の子\n\nA\n\n### 通常メモ: 下の子\n\nB\n\n## 通常メモ: 後続\n\nZ\n",
    );
  });
});
