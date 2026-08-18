import { describe, expect, it } from "vitest";
import { parseTheme } from "@/lib/theme";

describe("parseTheme", () => {
  it("有効な値はそのまま返す", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("auto")).toBe("auto");
  });

  it("null や不正値は dark にフォールバックする", () => {
    expect(parseTheme(null)).toBe("dark");
    expect(parseTheme("")).toBe("dark");
    expect(parseTheme("purple")).toBe("dark");
  });
});
