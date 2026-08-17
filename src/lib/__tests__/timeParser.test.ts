import { describe, expect, it } from "vitest";
import {
  autoCompleteTime,
  normalizeTimeInput,
  parseEventTime,
  sortTimelineEntries,
} from "../timeParser";

describe("normalizeTimeInput", () => {
  it("全角数字・コロンを半角にする", () => {
    expect(normalizeTimeInput("１３：００")).toBe("13:00");
    expect(normalizeTimeInput("12:30")).toBe("12:30");
  });
});

describe("autoCompleteTime", () => {
  it("コロンなし数字を HH:MM に補完する", () => {
    expect(autoCompleteTime("1300")).toBe("13:00");
    expect(autoCompleteTime("130")).toBe("1:30");
    expect(autoCompleteTime("9")).toBe("9:00");
  });
  it("コロンあり・数字以外はそのまま返す", () => {
    expect(autoCompleteTime("13:00")).toBe("13:00");
    expect(autoCompleteTime("夜中")).toBe("夜中");
    expect(autoCompleteTime("")).toBe("");
  });
});

describe("parseEventTime", () => {
  it("HH:MM を分換算にする", () => {
    expect(parseEventTime("12:30")).toBe(750);
    expect(parseEventTime("0:00")).toBe(0);
    expect(parseEventTime("23:59")).toBe(1439);
  });
  it("不正な形式・範囲外は undefined", () => {
    expect(parseEventTime("")).toBeUndefined();
    expect(parseEventTime("24:00")).toBeUndefined();
    expect(parseEventTime("12:5")).toBeUndefined();
    expect(parseEventTime("深夜")).toBeUndefined();
  });
});

describe("sortTimelineEntries", () => {
  it("時刻昇順に並べ、解釈できない行は元の順序のまま末尾に置く", () => {
    const entries = [
      { id: "a", time: "21:00", text: "A" },
      { id: "b", time: "不明", text: "B" },
      { id: "c", time: "9:30", text: "C" },
      { id: "d", time: "", text: "D" },
    ];
    expect(sortTimelineEntries(entries).map((e) => e.id)).toEqual(["c", "a", "b", "d"]);
  });
});
