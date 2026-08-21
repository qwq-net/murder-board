import {
  Background,
  Controls,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ActionLogNode } from "@/components/nodes/ActionLogNode";
import { CharacterNode } from "@/components/nodes/CharacterNode";
import { KeywordNode } from "@/components/nodes/KeywordNode";
import { ListNode } from "@/components/nodes/ListNode";
import { KIND_ICONS } from "@/components/nodes/NodeShell";
import { StackNode } from "@/components/nodes/StackNode";
import { StickyNode } from "@/components/nodes/StickyNode";
import { TimelineNode } from "@/components/nodes/TimelineNode";
import type { Theme } from "@/lib/theme";
import { useBoardStore } from "@/store";
import { NODE_KIND_LABELS, type BoardNode, type BoardNodeKind } from "@/types/board";

const nodeTypes: NodeTypes = {
  sticky: StickyNode,
  timeline: TimelineNode,
  list: ListNode,
  keyword: KeywordNode,
  character: CharacterNode,
  actionlog: ActionLogNode,
  stack: StackNode,
};

// 右クリックメニューの並び。役割の近さでグループ化し、グループ間に区切り線を挟む。
// 「単体メモとその入れ物 / 行を積む記録系 / 他ノードの装飾に効く登録系」の 3 グループ
const MENU_GROUPS: BoardNodeKind[][] = [
  ["sticky", "stack"],
  ["list", "timeline", "actionlog"],
  ["character", "keyword"],
];

// キーボードショートカットを抑止すべき「テキスト入力中」かを判定する
const isTypingTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export function Board({ theme }: { theme: Theme }) {
  const nodes = useBoardStore((s) => s.nodes);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const onNodeDragStop = useBoardStore((s) => s.onNodeDragStop);
  const addNode = useBoardStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();
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
      <ReactFlow<BoardNode>
        nodes={nodes}
        onNodesChange={onNodesChange}
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
          {MENU_GROUPS.map((group, gi) => (
            <div key={group[0]}>
              {gi > 0 && <div className="my-1 border-t border-border-subtle" />}
              {group.map((kind) => {
                const Icon = KIND_ICONS[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-bg-hover"
                    onClick={() => addFromMenu(kind)}
                  >
                    <Icon size={14} className="shrink-0 opacity-70" />
                    {NODE_KIND_LABELS[kind]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
