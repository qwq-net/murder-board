import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCharacterEntries } from "@/components/nodes/useCharacterEntries";
import { splitByRules } from "@/lib/textStyleRules";
import { useBoardStore } from "@/store";
import type { StickyColor } from "@/types/board";

// 本文装飾のルール。character は登場人物名の色付き強調、link はキーワードの検索リンク
type StyleRule =
  | { key: string; kind: "character"; color: StickyColor }
  | { key: string; kind: "link" };

// 全登場人物メモの行と全キーワードメモの行を装飾ルールへ平坦化して購読する。
// 空文字の行は含まない。言葉の変更以外のノード更新（移動など）では再レンダーさせない。
// splitByRules は同長の一致で先のルールを採るため、人物を前に置き、
// 同じ言葉が人物名とキーワードの両方にあるときは人物の色付けが勝つようにする。
const useStyleRules = (): StyleRule[] => {
  const characters = useCharacterEntries();
  const keywords = useBoardStore(
    useShallow((s) =>
      s.nodes.flatMap((n) =>
        n.type === "keyword" ? n.data.entries.filter((e) => e.text !== "").map((e) => e.text) : [],
      ),
    ),
  );
  return useMemo(
    () => [
      ...characters.map((c): StyleRule => ({ key: c.name, kind: "character", color: c.color })),
      ...keywords.map((key): StyleRule => ({ key, kind: "link" })),
    ],
    [characters, keywords],
  );
};

// 登場人物メモの名前とキーワードメモの言葉を本文中で装飾して表示する。
// 名前はその人物の識別色の太字、言葉はクリックでその文言入りの検索を開くリンクになる。
// plainLinks を渡すと言葉は色付けだけになり、下線とクリックの検索は付かない。
// キーワードメモ自身の行のような、リンクにしたくない場所向け。
// 一致の規則は splitByRules に従う。編集用ではなく表示専用で、text が空なら何も描画しない。
// 使われ方: 各ノードの本文の表示モードから呼ばれる前提。
export function StyledText({ text, plainLinks = false }: { text: string; plainLinks?: boolean }) {
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
    if (run.rule?.kind === "link" && plainLinks) {
      return (
        <span key={i} className="font-medium text-accent">
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
