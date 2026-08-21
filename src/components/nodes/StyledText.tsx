import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { splitByRules } from "@/lib/textStyleRules";
import { useBoardStore } from "@/store";
import type { StickyColor } from "@/types/board";

// 本文装飾のルール。character は登場人物名の色付き強調、link はキーワードの検索リンク
type StyleRule =
  | { key: string; kind: "character"; color: StickyColor }
  | { key: string; kind: "link" };

// 全登場人物メモの行と全キーワードメモの行を装飾ルールへ平坦化して購読する。
// プリミティブ列にするのは useShallow の比較を効かせるためで、名前・言葉の変更以外の
// ノード更新（移動など）では購読側を再レンダーさせない。空文字の行は含まない。
// 同じ言葉が人物名とキーワードの両方にあるときは人物の色付けが勝つ。
const useStyleRules = (): StyleRule[] => {
  const encoded = useBoardStore(
    useShallow((s) =>
      s.nodes.flatMap((n) =>
        n.type === "character"
          ? n.data.entries.filter((e) => e.text !== "").map((e) => `${e.color}:${e.text}`)
          : n.type === "keyword"
            ? n.data.entries.filter((e) => e.text !== "").map((e) => `link:${e.text}`)
            : [],
      ),
    ),
  );
  return useMemo(
    () =>
      encoded
        .map((pair): StyleRule => {
          // 言葉側に ":" が含まれても壊れないよう、区切りは先頭の 1 つだけを見る
          const sep = pair.indexOf(":");
          const head = pair.slice(0, sep);
          const key = pair.slice(sep + 1);
          if (head === "link") return { key, kind: "link" };
          // SAFETY: encoded の要素は上の selector が `${StickyColor}:` か "link:" で組み立てている
          return { key, kind: "character", color: head as StickyColor };
        })
        // splitByRules は同長の一致で先のルールを採るため、人物を前に置いて優先させる
        .sort((a, b) => Number(a.kind === "link") - Number(b.kind === "link")),
    [encoded],
  );
};

// 登場人物メモの名前とキーワードメモの言葉を本文中で装飾して表示する。
// 名前はその人物の識別色の太字、言葉はクリックでその文言入りの検索を開くリンクになる。
// 一致の規則は splitByRules に従う。編集用ではなく表示専用で、text が空なら何も描画しない。
// 使われ方: 通常メモ・リスト・タイムラインの本文の表示モードから呼ばれる前提。
export function StyledText({ text }: { text: string }) {
  const rules = useStyleRules();
  const openSearch = useBoardStore((s) => s.openSearch);
  const runs = useMemo(() => splitByRules(text, rules), [text, rules]);
  return runs.map((run, i) => {
    if (run.rule?.kind === "character") {
      return (
        <span
          key={i}
          className="font-semibold"
          style={{ color: `var(--sticky-${run.rule.color}-accent)` }}
        >
          {run.text}
        </span>
      );
    }
    if (run.rule?.kind === "link") {
      return (
        <button
          key={i}
          type="button"
          title={`「${run.text}」を検索`}
          className="nodrag cursor-pointer font-medium text-accent underline decoration-dashed underline-offset-2"
          onClick={(e) => {
            // 親ノードのクリック選択やダブルクリック編集へ渡さない
            e.stopPropagation();
            openSearch(run.text);
          }}
        >
          {run.text}
        </button>
      );
    }
    return <span key={i}>{run.text}</span>;
  });
}
