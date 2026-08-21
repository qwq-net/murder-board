/**
 * 検索オーバーレイのノード検索・ハイライトロジック（純関数・UI 非依存）。
 *
 * murder-memo の entrySearch / searchHighlight を本リポジトリのノード構造へ移植したもの。
 * 検索対象はタイトルと本文行で、スペース区切りの複数キーワード AND で絞り込む。
 */
import type { BoardNode, BoardNodeKind } from "@/types/board";

/** 1 件のヒット。title / body はハイライト表示用に平坦化済みのテキスト。 */
export interface SearchMatch {
  node: BoardNode;
  title: string;
  /** 本文行を改行結合したテキスト。timeline は「時刻 テキスト」形式の行になる */
  body: string;
}

export interface SearchResultGroup {
  kind: BoardNodeKind;
  matches: SearchMatch[];
}

export interface HighlightSegment {
  text: string;
  /** この区間がキーワード一致部分（mark 対象）か */
  highlighted: boolean;
}

/** マッチ周辺の切り出し幅。前後の文字数 */
const CONTEXT_RADIUS = 50;
/** 本文にキーワードが無いときに表示する冒頭の文字数 */
const SNIPPET_FALLBACK_LEN = 120;

/** クエリ文字列をスペース区切りの小文字キーワード配列に分解する。空白のみなら空配列。 */
export function tokenizeQuery(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

// ノードの本文をスニペット・検索用の複数行テキストに平坦化する
function nodeBody(node: BoardNode): string {
  switch (node.type) {
    case "sticky":
      return node.data.text;
    case "timeline":
      return node.data.entries.map((e) => `${e.time} ${e.text}`.trim()).join("\n");
    case "list":
    case "keyword":
    case "character":
      return node.data.entries.map((e) => e.text).join("\n");
    case "actionlog":
      return node.data.entries.map((e) => `${e.from} ▶ ${e.to} ${e.text}`.trim()).join("\n");
    case "stack":
      return "";
  }
}

/**
 * ノードを検索して order の種別順にグループ化した配列を返す。
 * すべてのキーワードがタイトルまたは本文のどこかに一致するノードのみヒットし、
 * 大文字小文字は区別しない。キーワードが無ければ空配列（呼び手は「未検索」として扱える）。
 * 全体で maxResults 件に達したら残りは打ち切る。ヒット 0 件の種別グループは含まれない。
 */
export function searchNodes(
  query: string,
  nodes: BoardNode[],
  order: BoardNodeKind[],
  maxResults: number,
): SearchResultGroup[] {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) return [];

  let count = 0;
  const groups: SearchResultGroup[] = [];

  for (const kind of order) {
    if (count >= maxResults) break;
    const matches: SearchMatch[] = [];

    for (const node of nodes) {
      if (count >= maxResults) break;
      if (node.type !== kind) continue;

      const title = node.data.title;
      const body = nodeBody(node);
      const haystack = `${title}\n${body}`.toLowerCase();
      if (!terms.every((t) => haystack.includes(t))) continue;

      matches.push({ node, title, body });
      count++;
    }

    if (matches.length > 0) groups.push({ kind, matches });
  }

  return groups;
}

/**
 * テキスト中の全キーワード出現箇所をハイライト区間としてセグメント化する。
 * 重なり・隣接する一致区間はマージしてから返す（二重 mark を防ぐ）。
 * 一致が無ければ全体を非ハイライトの 1 セグメントで返し、text が空なら空配列。
 */
export function highlightSegments(text: string, terms: string[]): HighlightSegment[] {
  const lower = text.toLowerCase();

  const ranges: [number, number][] = [];
  for (const t of terms) {
    if (!t) continue;
    let i = lower.indexOf(t);
    while (i !== -1) {
      ranges.push([i, i + t.length]);
      i = lower.indexOf(t, i + t.length);
    }
  }
  if (ranges.length === 0) return text ? [{ text, highlighted: false }] : [];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) {
      last[1] = Math.max(last[1], r[1]);
    } else {
      merged.push([r[0], r[1]]);
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), highlighted: false });
    segments.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlighted: false });
  return segments;
}

/**
 * 最初のマッチ周辺 ±50 文字を切り出し、キーワードをハイライトしたスニペットを返す。
 * 切り落とした側には「…」セグメントを付ける。本文にどのキーワードも現れない
 * （タイトルのみで一致した）場合は冒頭 120 文字をハイライト無しで返し、content が空なら空配列。
 */
export function buildSnippetSegments(content: string, terms: string[]): HighlightSegment[] {
  const lower = content.toLowerCase();

  let firstIdx = -1;
  let firstLen = 0;
  for (const t of terms) {
    if (!t) continue;
    const i = lower.indexOf(t);
    if (i !== -1 && (firstIdx === -1 || i < firstIdx)) {
      firstIdx = i;
      firstLen = t.length;
    }
  }

  if (firstIdx === -1) {
    const head = content.slice(0, SNIPPET_FALLBACK_LEN);
    return head ? [{ text: head, highlighted: false }] : [];
  }

  const start = Math.max(0, firstIdx - CONTEXT_RADIUS);
  const end = Math.min(content.length, firstIdx + firstLen + CONTEXT_RADIUS);
  const slice = content.slice(start, end);

  const segments: HighlightSegment[] = [];
  if (start > 0) segments.push({ text: "…", highlighted: false });
  segments.push(...highlightSegments(slice, terms));
  if (end < content.length) segments.push({ text: "…", highlighted: false });
  return segments;
}
