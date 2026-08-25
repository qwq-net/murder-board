import { useReactFlow } from "@xyflow/react";
import { useEffect, type RefObject } from "react";
import { duplicateSelection, materializeNodes, snapshotSelection } from "@/lib/nodeClipboard";
import { useBoardStore } from "@/store";
import type { BoardNode } from "@/types/board";

// キーボードショートカットを抑止すべき「テキスト入力中」かを判定する
export const isTypingTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

// 盤面の Ctrl/Cmd 系ショートカットをウィンドウへ張るフック。テキスト入力中は
// ブラウザ標準の編集操作を優先していずれも発動しない。
// Z は Undo、Shift 併用で Redo。C/X は選択中のノード全部をスナップショットして
// setClipboard へ渡し、X はさらに削除する。V は clipboard を mousePos の指す
// 最後のカーソル画面座標へ貼り付ける。clipboard が null なら V は何もしない。
// D は選択中のノードを元の位置から少し右下へずらして複製する。クリップボードは変えない。
// 使われ方: Board が 1 回だけ呼ぶ前提。ReactFlowProvider 配下でしか使えない。
export function useBoardShortcuts(
  clipboard: BoardNode[] | null,
  setClipboard: (nodes: BoardNode[]) => void,
  mousePos: RefObject<{ x: number; y: number }>,
) {
  const addNodes = useBoardStore((s) => s.addNodes);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const { screenToFlowPosition } = useReactFlow();

  // Ctrl/Cmd+Z で Undo、Shift 併用で Redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      const temporal = useBoardStore.temporal.getState();
      if (e.shiftKey) {
        if (temporal.futureStates.length === 0) return;
        temporal.redo();
        useBoardStore.getState().logOp("やり直す");
      } else {
        if (temporal.pastStates.length === 0) return;
        temporal.undo();
        useBoardStore.getState().logOp("元に戻す");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ctrl/Cmd+C・X・V・D のコピー・切り取り・貼り付け・複製。
  // 切り取りはコピーと同じスナップショットを取ってから削除する
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "x" && key !== "v" && key !== "d") return;

      if (key === "v") {
        if (!clipboard) return;
        e.preventDefault();
        addNodes(materializeNodes(clipboard, screenToFlowPosition(mousePos.current)));
        return;
      }

      const current = useBoardStore.getState().nodes;
      const selectedIds = new Set(current.filter((n) => n.selected).map((n) => n.id));

      if (key === "d") {
        // 未選択でもブラウザのブックマークダイアログを開かせない
        e.preventDefault();
        const dup = duplicateSelection(current, selectedIds);
        if (dup) addNodes(dup.nodes, dup.label);
        return;
      }

      if (selectedIds.size === 0) return;
      e.preventDefault();
      setClipboard(snapshotSelection(current, selectedIds));
      if (key === "x") {
        onNodesChange([...selectedIds].map((id) => ({ type: "remove" as const, id })));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clipboard, setClipboard, addNodes, onNodesChange, screenToFlowPosition, mousePos]);
}
