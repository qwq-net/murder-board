import { useEffect, type RefObject } from "react";
import { isTypingTarget } from "@/components/board/useBoardShortcuts";

// active になったら ref の textarea へフォーカスを移し、カーソルを末尾へ置く。
// まず同期で試み、通らなければ 16ms 間隔で最大 10 回再試行する。React Flow が計測前の
// ノードを visibility:hidden で描画しフォーカスが通らないことがあるための再試行で、
// その間にフォーカスが別のテキスト入力へ移っていたら奪い返さずに打ち切る。
// 使われ方: 編集状態へ入った直後の textarea が対象。editing フラグを active に渡す前提
export function useRetryFocus(active: boolean, ref: RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    if (!active) return;
    const tryFocus = () => {
      const el = ref.current;
      if (el === null) return false;
      if (document.activeElement !== el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
      return document.activeElement === el;
    };
    if (tryFocus()) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (document.activeElement !== ref.current && isTypingTarget(document.activeElement)) {
        clearInterval(timer);
        return;
      }
      if (tryFocus() || ++tries >= 10) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [active, ref]);
}
