import {
  Background,
  BackgroundVariant,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { BoardControls } from "@/components/board/BoardControls";
import { BoardMenu, type MenuState } from "@/components/board/BoardMenu";
import { OpsLog } from "@/components/board/OpsLog";
import { isTypingTarget, useBoardShortcuts } from "@/components/board/useBoardShortcuts";
import { ActionLogNode } from "@/components/nodes/ActionLogNode";
import { CharacterNode } from "@/components/nodes/CharacterNode";
import { KeywordNode } from "@/components/nodes/KeywordNode";
import { ListNode } from "@/components/nodes/ListNode";
import { StackNode } from "@/components/nodes/StackNode";
import { StickyNode } from "@/components/nodes/StickyNode";
import { TimelineNode } from "@/components/nodes/TimelineNode";
import type { Theme } from "@/lib/theme";
import { useBoardStore } from "@/store";
import type { BoardNode } from "@/types/board";

const nodeTypes: NodeTypes = {
  sticky: StickyNode,
  timeline: TimelineNode,
  list: ListNode,
  keyword: KeywordNode,
  character: CharacterNode,
  actionlog: ActionLogNode,
  stack: StackNode,
};

export function Board({ theme }: { theme: Theme }) {
  const nodes = useBoardStore((s) => s.nodes);
  const loaded = useBoardStore((s) => s.loaded);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const onNodeDragStop = useBoardStore((s) => s.onNodeDragStop);
  const addNode = useBoardStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();
  // 右クリックメニューの表示位置。null なら非表示
  const [menu, setMenu] = useState<MenuState | null>(null);
  // コピーしたノードのスナップショット。セッションを切り替えても揮発するだけで害はない
  const [clipboard, setClipboard] = useState<BoardNode[] | null>(null);
  // Ctrl+V の貼り付け先に使う最後のカーソル画面座標。初期値は画面中央
  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  // Space 押下中のパン専用モード。ノードの移動・選択を止めることで、
  // ノード上からでもドラッグが React Flow のビューポートパンに落ちる
  const [spacePanning, setSpacePanning] = useState(false);

  useBoardShortcuts(clipboard, setClipboard, mousePos);

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

  // ノードの無いペイン部分のダブルクリックで付箋を追加
  const onDoubleClick = (e: ReactMouseEvent) => {
    if (!(e.target instanceof Element) || !e.target.classList.contains("react-flow__pane")) return;
    addNode("sticky", screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  const onPaneContextMenu = (e: ReactMouseEvent | globalThis.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  // ノードの右クリック。選択済みノードの上なら複数選択を保ってメニューを選択全体に
  // 効かせ、未選択ノードの上なら左クリック同様に対象だけを選択状態にしてから開く
  const onNodeContextMenu = (e: ReactMouseEvent, node: BoardNode) => {
    e.preventDefault();
    if (node.selected !== true) {
      onNodesChange(
        nodes
          .filter((n) => n.selected || n.id === node.id)
          .map((n) => ({ id: n.id, type: "select" as const, selected: n.id === node.id })),
      );
    }
    setMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  };

  return (
    <div
      className="relative min-h-0 flex-1"
      onDoubleClick={onDoubleClick}
      onMouseMove={(e) => {
        mousePos.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <ReactFlow<BoardNode>
        nodes={nodes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, _node, dragged) => onNodeDragStop(dragged)}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={() => setMenu(null)}
        onNodeClick={() => setMenu(null)}
        onNodeDragStart={() => setMenu(null)}
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
        {/* 薄い + パターン。色は colorMode 連動の既定値に任せ、テーマ切替に追従させる */}
        <Background variant={BackgroundVariant.Dots} gap={48} size={2} />
        <BoardControls />
      </ReactFlow>
      {/* 空盤面の操作案内。操作を邪魔しないよう pointer-events は透過させる */}
      {loaded && nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-md border border-border-subtle bg-bg-elevated/80 px-4 py-3 text-sm text-text-muted">
            右クリックでメモを追加できます。ダブルクリックで付箋を置けます。
          </div>
        </div>
      )}
      <OpsLog />
      {menu && (
        <BoardMenu
          menu={menu}
          clipboard={clipboard}
          setClipboard={setClipboard}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
