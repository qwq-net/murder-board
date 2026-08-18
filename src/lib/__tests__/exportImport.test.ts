import { describe, expect, it } from "vitest";
import type { Session } from "@/types/board";
import { parseImport, serializeExport } from "../exportImport";

function fixture(): Session {
  return {
    id: "s1",
    name: "テストセッション",
    createdAt: 1,
    updatedAt: 2,
    nodes: [
      {
        id: "n1",
        type: "sticky",
        position: { x: 0, y: 0 },
        data: { title: "手がかり", text: "あ", color: "pink" },
      },
      {
        id: "n2",
        type: "sticky",
        position: { x: 100, y: 50 },
        data: { title: "", text: "い", color: "blue" },
      },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2" }],
  };
}

describe("parseImport", () => {
  it("roundtrip: 全 ID を再採番しつつ構造を保つ", () => {
    const imported = parseImport(serializeExport(fixture()), 123);
    expect(imported.name).toBe("テストセッション");
    expect(imported.id).not.toBe("s1");
    expect(imported.createdAt).toBe(123);
    expect(imported.updatedAt).toBe(123);

    expect(imported.nodes).toHaveLength(2);
    const ids = imported.nodes.map((n) => n.id);
    expect(ids).not.toContain("n1");
    expect(imported.nodes[0]!.data).toEqual({ title: "手がかり", text: "あ", color: "pink" });
    expect(imported.nodes[1]!.position).toEqual({ x: 100, y: 50 });

    expect(imported.edges).toHaveLength(1);
    const edge = imported.edges[0]!;
    expect(edge.id).not.toBe("e1");
    expect(ids).toContain(edge.source);
    expect(ids).toContain(edge.target);
  });

  it("timeline ノードは行 ID を再採番しつつ中身を保つ", () => {
    const s = fixture();
    s.nodes.push({
      id: "n3",
      type: "timeline",
      position: { x: 200, y: 200 },
      data: {
        title: "当日",
        entries: [{ id: "r1", time: "21:00", text: "悲鳴が聞こえた" }],
      },
    });
    const imported = parseImport(serializeExport(s));
    const timeline = imported.nodes.find((n) => n.type === "timeline")!;
    expect(timeline.data.title).toBe("当日");
    expect(timeline.data.entries).toHaveLength(1);
    expect(timeline.data.entries[0]!.id).not.toBe("r1");
    expect(timeline.data.entries[0]!).toMatchObject({ time: "21:00", text: "悲鳴が聞こえた" });
  });

  it("list ノードは行 ID を再採番しつつ中身を保ち、壊れた行は捨てる", () => {
    const s = fixture();
    s.nodes.push({
      id: "n4",
      type: "list",
      position: { x: 300, y: 300 },
      data: {
        title: "容疑者",
        // SAFETY: 壊れた行が捨てられることを検証するため、意図的に型を破った値を注入する
        entries: [{ id: "r1", text: "執事" }, "broken" as never],
      },
    });
    const imported = parseImport(serializeExport(s));
    const list = imported.nodes.find((n) => n.type === "list")!;
    expect(list.data.title).toBe("容疑者");
    expect(list.data.entries).toHaveLength(1);
    expect(list.data.entries[0]!.id).not.toBe("r1");
    expect(list.data.entries[0]!.text).toBe("執事");
  });

  it("character ノードは行 ID を再採番しつつ中身を保ち、未知の色は yellow に落とす", () => {
    const s = fixture();
    s.nodes.push({
      id: "n5",
      type: "character",
      position: { x: 400, y: 400 },
      data: {
        title: "プレイヤー",
        // SAFETY: 未知の色が yellow に落ちることを検証するため、意図的に型を破った値を注入する
        entries: [
          { id: "r1", text: "探偵", color: "blue" },
          { id: "r2", text: "医者", color: "neon" as never },
        ],
      },
    });
    const imported = parseImport(serializeExport(s));
    const character = imported.nodes.find((n) => n.type === "character")!;
    expect(character.data.title).toBe("プレイヤー");
    expect(character.data.entries).toHaveLength(2);
    expect(character.data.entries[0]!.id).not.toBe("r1");
    expect(character.data.entries[0]!).toMatchObject({ text: "探偵", color: "blue" });
    expect(character.data.entries[1]!).toMatchObject({ text: "医者", color: "yellow" });
  });

  it("stack ノードはサイズと子の parentId を新 ID へ引き継いで往復する", () => {
    const s = fixture();
    s.nodes.push({
      id: "n6",
      type: "stack",
      position: { x: 500, y: 500 },
      width: 216,
      height: 150,
      data: { title: "まとめ" },
    });
    s.nodes[0]!.parentId = "n6";
    const imported = parseImport(serializeExport(s));
    const stack = imported.nodes.find((n) => n.type === "stack")!;
    expect(stack.data.title).toBe("まとめ");
    expect(stack.width).toBe(216);
    expect(stack.height).toBe(150);
    const child = imported.nodes.find((n) => n.parentId !== undefined)!;
    expect(child.parentId).toBe(stack.id);
    expect(child.type).toBe("sticky");
  });

  it("存在しない親やスタック以外を指す parentId は捨て、ノード自体は残す", () => {
    const s = fixture();
    s.nodes[0]!.parentId = "ghost";
    s.nodes[1]!.parentId = "n1";
    const imported = parseImport(serializeExport(s));
    expect(imported.nodes).toHaveLength(2);
    expect(imported.nodes.every((n) => n.parentId === undefined)).toBe(true);
  });

  it("子が親より前に並んだ入力でも、出力ではスタックが先に並ぶ", () => {
    const s = fixture();
    s.nodes[0]!.parentId = "n6";
    s.nodes.push({
      id: "n6",
      type: "stack",
      position: { x: 500, y: 500 },
      data: { title: "" },
    });
    const imported = parseImport(serializeExport(s));
    const stackIndex = imported.nodes.findIndex((n) => n.type === "stack");
    const childIndex = imported.nodes.findIndex((n) => n.parentId !== undefined);
    expect(childIndex).toBeGreaterThan(stackIndex);
  });

  it("存在しないノードを参照する edge は捨てる", () => {
    const s = fixture();
    s.edges.push({ id: "e2", source: "n1", target: "ghost" });
    const imported = parseImport(serializeExport(s));
    expect(imported.edges).toHaveLength(1);
  });

  it("未知の色は yellow に落とす", () => {
    const json = serializeExport(fixture()).replace('"pink"', '"neon"');
    const imported = parseImport(json);
    expect(imported.nodes[0]!.data).toMatchObject({ color: "yellow" });
  });

  it("壊れた JSON は throw する", () => {
    expect(() => parseImport("{oops")).toThrow("JSON");
  });

  it("別アプリのファイルは throw する", () => {
    expect(() => parseImport(JSON.stringify({ app: "other", version: 1, session: {} }))).toThrow(
      "エクスポートファイル",
    );
  });

  it("ノードの必須フィールド欠落は throw する", () => {
    const broken = {
      app: "murder-memo2",
      version: 1,
      session: { name: "x", nodes: [{ id: 1 }], edges: [] },
    };
    expect(() => parseImport(JSON.stringify(broken))).toThrow("ノード");
  });
});
