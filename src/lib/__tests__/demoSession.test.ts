import { describe, expect, it } from "vitest";
import type { BoardNode } from "@/types/board";
import { buildDemoSession, DEMO_VERSION } from "../demoSession";
import { parseImport, serializeExport } from "../exportImport";

describe("buildDemoSession", () => {
  it("全ノード種別を含み、エッジはすべて実在ノードを結ぶ", () => {
    const session = buildDemoSession();

    expect(session.isDemo).toBe(true);
    expect(session.demoVersion).toBe(DEMO_VERSION);

    const kinds = new Set(session.nodes.map((n) => n.type));
    expect(kinds).toEqual(new Set(["sticky", "timeline", "list", "character"]));

    const nodeIds = new Set(session.nodes.map((n) => n.id));
    for (const edge of session.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });

  it("roundtrip: エクスポート形式を経由しても欠落しない", () => {
    const session = buildDemoSession();
    const imported = parseImport(serializeExport(session));

    expect(imported.name).toBe(session.name);
    // エクスポート経由の複製にはデモの印が付かず、起動時の置き換え対象にならない
    expect(imported.isDemo).toBeUndefined();
    expect(imported.nodes).toHaveLength(session.nodes.length);
    // parseImport は壊れたエッジを黙って捨てるため、本数一致がデータの健全性の裏付けになる
    expect(imported.edges).toHaveLength(session.edges.length);

    // 行 ID は parseImport が再採番するため、ID を除いた内容で一致を確認する
    const dataWithoutIds = (data: BoardNode["data"]): string =>
      JSON.stringify(data, (key, value) => (key === "id" ? undefined : value));
    expect(imported.nodes.map((n) => dataWithoutIds(n.data))).toEqual(
      session.nodes.map((n) => dataWithoutIds(n.data)),
    );
  });
});
