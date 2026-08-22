import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useBoardStore } from "@/store";
import type { StickyColor } from "@/types/board";

// 全登場人物メモの空でない行を { name, color } の列として購読する。
// 並びはノード順・行順のままで、同名の重複も残す。重複の解決は呼び手が行う。
// プリミティブ列にエンコードするのは useShallow の比較を効かせるためで、
// 名前・色の変更以外のノード更新（移動など）では購読側を再レンダーさせない。
export const useCharacterEntries = (): { name: string; color: StickyColor }[] => {
  const encoded = useBoardStore(
    useShallow((s) =>
      s.nodes.flatMap((n) =>
        n.type === "character"
          ? n.data.entries.filter((e) => e.text !== "").map((e) => `${e.color}:${e.text}`)
          : [],
      ),
    ),
  );
  return useMemo(
    () =>
      encoded.map((pair) => {
        // 名前側に ":" が含まれても壊れないよう、区切りは先頭の 1 つだけを見る
        const sep = pair.indexOf(":");
        // SAFETY: encoded の要素は上の selector が `${StickyColor}:` 形式で組み立てている
        return { name: pair.slice(sep + 1), color: pair.slice(0, sep) as StickyColor };
      }),
    [encoded],
  );
};
