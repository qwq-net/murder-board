import { z } from "zod";

// ノード種別ごとのデフォルト横幅設定。localStorage に永続化するアプリ設定で、
// セッションデータには含めない。スタックは子のサイズから自動計算されるため対象外。

// 横幅を設定できるノード種別。並びは設定画面の表示順
export const WIDTH_KINDS = ["sticky", "timeline", "list", "keyword", "character"] as const;
export type WidthKind = (typeof WIDTH_KINDS)[number];

// 設定値。キーが無い種別は DEFAULT_NODE_WIDTH で描画される
export type NodeWidths = Partial<Record<WidthKind, number>>;

// タイムラインノードの従来幅 w-72 相当を全種別の基準にする
export const DEFAULT_NODE_WIDTH = 288;
export const MIN_NODE_WIDTH = 160;
export const MAX_NODE_WIDTH = 800;

export const NODE_WIDTHS_KEY = "murder-memo2-node-widths";

// 横幅を設定可能な範囲へ丸める。整数化もここで行う
export function clampNodeWidth(width: number): number {
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.round(width)));
}

// 種別 1 つ分の値。数値なら範囲へ丸め、数値でない・欠落なら未設定に落とす
const widthValueSchema = z.number().transform(clampNodeWidth).optional().catch(undefined);

const nodeWidthsSchema = z
  .object({
    sticky: widthValueSchema,
    timeline: widthValueSchema,
    list: widthValueSchema,
    keyword: widthValueSchema,
    character: widthValueSchema,
  } satisfies Record<WidthKind, typeof widthValueSchema>)
  .catch({});

// localStorage から横幅設定を読む。壊れた JSON・数値でない値は黙って未設定に落とし、
// 範囲外の値は丸めて、常に安全な NodeWidths を返す
export function loadNodeWidths(): NodeWidths {
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(NODE_WIDTHS_KEY) ?? "{}");
  } catch {
    return {};
  }
  return nodeWidthsSchema.parse(raw);
}

export function saveNodeWidths(widths: NodeWidths): void {
  localStorage.setItem(NODE_WIDTHS_KEY, JSON.stringify(widths));
}
