import {
  Background,
  Controls,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { CharacterNode } from "@/components/nodes/CharacterNode";
import { KeywordNode } from "@/components/nodes/KeywordNode";
import { ListNode } from "@/components/nodes/ListNode";
import { StackNode } from "@/components/nodes/StackNode";
import { StickyNode } from "@/components/nodes/StickyNode";
import { TimelineNode } from "@/components/nodes/TimelineNode";
import { delegateEdgesToStacks } from "@/lib/stackLayout";
import type { Theme } from "@/lib/theme";
import { useBoardStore } from "@/store";
import {
  NODE_KIND_LABELS,
  type BoardEdge,
  type BoardNode,
  type BoardNodeKind,
} from "@/types/board";

const nodeTypes: NodeTypes = {
  sticky: StickyNode,
  timeline: TimelineNode,
  list: ListNode,
  keyword: KeywordNode,
  character: CharacterNode,
  stack: StackNode,
};

// SAFETY: NODE_KIND_LABELS のキーは BoardNodeKind の全種別。Object.entries が
// キーを string へ落とすのを戻すだけの表明
const MENU_ITEMS = Object.entries(NODE_KIND_LABELS) as [BoardNodeKind, string][];

// キーボードショートカットを抑止すべき「テキスト入力中」かを判定する
const isTypingTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export function Board({ theme }: { theme: Theme }) {
  const nodes = useBoardStore((s) => s.nodes);
  const edges = useBoardStore((s) => s.edges);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const onEdgesChange = useBoardStore((s) => s.onEdgesChange);
  const onConnect = useBoardStore((s) => s.onConnect);
  const onNodeDragStop = useBoardStore((s) => s.onNodeDragStop);
  const addNode = useBoardStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();
  // スタック内の子に付いた線は、表示上だけ親スタックへ付け替える。store の edges は元のまま
  const displayEdges = useMemo(() => delegateEdgesToStacks(nodes, edges), [nodes, edges]);
  // 右クリックメニューの表示位置。画面座標で持ち、null なら非表示
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Space 押下中のパン専用モード。ノードの移動・選択を止めることで、
  // ノード上からでもドラッグが React Flow のビューポートパンに落ちる
  const [spacePanning, setSpacePanning] = useState(false);

  // Space 長押しでパンモードに入る。テキスト入力中は空白入力を優先して発動しない。
  // keyup の取りこぼしに備え、ウィンドウの blur でも必ず解除する
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      setSpacePanning(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePanning(false);
    };
    const onBlur = () => setSpacePanning(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Ctrl/Cmd+Z で Undo、Shift 併用で Redo。入力欄へのタイプは対象外
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      const temporal = useBoardStore.temporal.getState();
      if (e.shiftKey) temporal.redo();
      else temporal.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ノードの無いペイン部分のダブルクリックで付箋を追加
  const onDoubleClick = (e: ReactMouseEvent) => {
    if (!(e.target instanceof Element) || !e.target.classList.contains("react-flow__pane")) return;
    addNode("sticky", screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  const onPaneContextMenu = (e: ReactMouseEvent | globalThis.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const addFromMenu = (kind: BoardNodeKind) => {
    if (!menu) return;
    addNode(kind, screenToFlowPosition(menu));
    setMenu(null);
  };

  return (
    <div className="relative min-h-0 flex-1" onDoubleClick={onDoubleClick}>
      <ReactFlow<BoardNode, BoardEdge>
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={(_, _node, dragged) => onNodeDragStop(dragged)}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => setMenu(null)}
        onMoveStart={() => setMenu(null)}
        onSelectionStart={() => setMenu(null)}
        nodeTypes={nodeTypes}
        colorMode={theme === "auto" ? "system" : theme}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        zoomOnDoubleClick={false}
        className={spacePanning ? "space-panning" : undefined}
        nodesDraggable={!spacePanning}
        elementsSelectable={!spacePanning}
        selectionOnDrag={!spacePanning}
        selectionMode={SelectionMode.Partial}
        panOnDrag={spacePanning ? true : [1]}
      >
        <Background />
        <Controls />
      </ReactFlow>
      {menu && (
        <div
          className="fixed z-50 min-w-40 rounded border border-border-default bg-bg-elevated py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          {MENU_ITEMS.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className="block w-full cursor-pointer px-3 py-1.5 text-left text-sm hover:bg-bg-hover"
              onClick={() => addFromMenu(kind)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
