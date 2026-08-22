import { describe, expect, it } from "vitest";
import { NODE_KIND_LABELS, type BoardNode } from "@/types/board";
import { buildDemoSession, DEMO_VERSION } from "../demoSession";
import { parseImport, serializeExport } from "../exportImport";

// 行 ID は parseImport が再採番するため、ID を除いた内容で一致を確認するための整形
const dataWithoutIds = (data: BoardNode["data"]): string =>
  JSON.stringify(data, (key, value) => (key === "id" ? undefined : value));

describe("buildDemoSession", () => {
  it("全ノード種別を含む", () => {
    const session = buildDemoSession();

    expect(session.isDemo).toBe(true);
    expect(session.demoVersion).toBe(DEMO_VERSION);

    const kinds = new Set(session.nodes.map((n) => n.type));
    expect(kinds).toEqual(new Set(Object.keys(NODE_KIND_LABELS)));
  });

  it("roundtrip: エクスポート形式を経由しても欠落しない", () => {
    const session = buildDemoSession();
    const imported = parseImport(serializeExport(session));

    expect(imported.name).toBe(session.name);
    // エクスポート経由の複製にはデモの印が付かず、起動時の置き換え対象にならない
    expect(imported.isDemo).toBeUndefined();
    expect(imported.nodes).toHaveLength(session.nodes.length);

    // parseImport はスタックを配列の先頭へ寄せるため、ノードの並びは無視してソート比較する
    expect(imported.nodes.map((n) => dataWithoutIds(n.data)).toSorted()).toEqual(
      session.nodes.map((n) => dataWithoutIds(n.data)).toSorted(),
    );
  });
});
