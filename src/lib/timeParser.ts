// murder-memo v1 の timeParser から normalizeTimeInput / autoCompleteTime / parseEventTime を移植。

import type { TimelineEntry } from "@/types/board";

// 全角数字・コロンを半角に変換する。"１３：００" → "13:00"
export function normalizeTimeInput(input: string): string {
  return input
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":");
}

// コロンなし数字入力を HH:MM に自動補完する。時刻入力欄の blur 時に使う。
// "1300" → "13:00", "130" → "1:30", "9" → "9:00"
// 既にコロンがある・数字 1〜4 桁でない場合は正規化のみして返す。
export function autoCompleteTime(input: string): string {
  const s = normalizeTimeInput(input).trim();
  if (!s || s.includes(":")) return s;
  if (!/^\d{1,4}$/.test(s)) return s;

  const n = s.length;
  if (n <= 2) return `${s}:00`;
  if (n === 3) return `${s[0]}:${s.slice(1)}`;
  return `${s.slice(0, 2)}:${s.slice(2)}`;
}

// HH:MM 形式の時刻文字列を分換算のソートキーにする。"12:30" → 750。
// 空文字・HH:MM 以外・24:00 のような範囲外は undefined を返し、呼び手はソート不能として扱う。
export function parseEventTime(input: string): number | undefined {
  const s = input.trim();
  if (!s) return undefined;

  const match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;

  const h = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return undefined;

  return h * 60 + m;
}

// タイムラインの行を時刻の昇順に並べ替えて返す。元配列は変更しない。
// 空欄・自由記述のような時刻を解釈できない行は末尾に、互いの元の順序を保って並ぶ。
export function sortTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort(
    (a, b) => (parseEventTime(a.time) ?? Infinity) - (parseEventTime(b.time) ?? Infinity),
  );
}
