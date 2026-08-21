import {
  Background,
  BackgroundVariant,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { ClipboardPaste, Copy, Trash2, Ungroup, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { BoardControls } from "@/components/board/BoardControls";
import { ActionLogNode } from "@/components/nodes/ActionLogNode";
import { CharacterNode } from "@/components/nodes/CharacterNode";
import { KeywordNode } from "@/components/nodes/KeywordNode";
import { ListNode } from "@/components/nodes/ListNode";
import { KIND_ICONS } from "@/components/nodes/NodeShell";
import { StackNode } from "@/components/nodes/StackNode";
import { StickyNode } from "@/components/nodes/StickyNode";
import { TimelineNode } from "@/components/nodes/TimelineNode";
import { materializeNodes, snapshotSelection } from "@/lib/nodeClipboard";
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

// コンテキストメニューの 1 項目。アイコン + ラベルの横並びで、danger は削除系の赤文字
function MenuItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-bg-hover ${
        danger ? "text-danger" : ""
      }`}
      onClick={onClick}
    >
      <Icon size={14} className="shrink-0 opacity-70" />
      {label}
    </button>
  );
}

export function Board({ theme }: { theme: Theme }) {
  const nodes = useBoardStore((s) => s.nodes);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const onNodeDragStop = useBoardStore((s) => s.onNodeDragStop);
  const addNode = useBoardStore((s) => s.addNode);
  const addNodes = useBoardStore((s) => s.addNodes);
  const dissolveStack = useBoardStore((s) => s.dissolveStack);
  const { screenToFlowPosition } = useReactFlow();
  // 右クリックメニューの表示位置。画面座標で持ち、null なら非表示。
  // nodeId があればノード用メニュー、無ければペイン用の追加メニューになる
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  // コピーしたノードのスナップショット。セッションを切り替えても揮発するだけで害はない
  const [clipboard, setClipboard] = useState<BoardNode[] | null>(null);
  // Ctrl+V の貼り付け先に使う最後のカーソル画面座標。初期値は画面中央
  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
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

  // Ctrl/Cmd+C・X・V のコピー・切り取り・貼り付け。テキスト入力中はブラウザ標準の
  // 編集操作を優先して発動しない。対象は選択中のノード全部で、貼り付け先は
  // 最後のカーソル位置。切り取りはコピーと同じスナップショットを取ってから削除する
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "x" && key !== "v") return;

      if (key === "v") {
        if (!clipboard) return;
        e.preventDefault();
        addNodes(materializeNodes(clipboard, screenToFlowPosition(mousePos.current)));
        return;
      }

      const current = useBoardStore.getState().nodes;
      const selectedIds = new Set(current.filter((n) => n.selected).map((n) => n.id));
      if (selectedIds.size === 0) return;
      e.preventDefault();
      setClipboard(snapshotSelection(current, selectedIds));
      if (key === "x") {
        onNodesChange([...selectedIds].map((id) => ({ type: "remove" as const, id })));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clipboard, addNodes, onNodesChange, screenToFlowPosition]);

  // ノードの無いペイン部分のダブルクリックで付箋を追加
  const onDoubleClick = (e: ReactMouseEvent) => {
    if (!(e.target instanceof Element) || !e.target.classList.contains("react-flow__pane")) return;
    addNode("sticky", screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  const onPaneContextMenu = (e: ReactMouseEvent | globalThis.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  // ノードの右クリック。左クリック同様に対象だけを選択状態にしてからメニューを開く
  const onNodeContextMenu = (e: ReactMouseEvent, node: BoardNode) => {
    e.preventDefault();
    onNodesChange(
      nodes
        .filter((n) => n.selected || n.id === node.id)
        .map((n) => ({ id: n.id, type: "select" as const, selected: n.id === node.id })),
    );
    setMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  };

  const addFromMenu = (kind: BoardNodeKind) => {
    if (!menu) return;
    addNode(kind, screenToFlowPosition(menu));
    setMenu(null);
  };

  const pasteFromMenu = () => {
    if (!menu || !clipboard) return;
    addNodes(materializeNodes(clipboard, screenToFlowPosition(menu)));
    setMenu(null);
  };

  const copyFromMenu = (nodeId: string) => {
    setClipboard(snapshotSelection(nodes, new Set([nodeId])));
    setMenu(null);
  };

  const deleteFromMenu = (nodeId: string) => {
    onNodesChange([{ type: "remove", id: nodeId }]);
    setMenu(null);
  };

  const dissolveFromMenu = (nodeId: string) => {
    dissolveStack(nodeId);
    setMenu(null);
  };

  // メニューの対象ノード。nodeId が残っていてもノードが消えていれば null 扱い
  const menuTarget =
    menu?.nodeId !== undefined ? nodes.find((n) => n.id === menu.nodeId) : undefined;

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
      {menu && (
        <div
          className="fixed z-50 min-w-40 rounded border border-border-default bg-bg-elevated py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.nodeId === undefined ? (
            <>
              {clipboard !== null && (
                <>
                  <MenuItem icon={ClipboardPaste} label="貼り付け" onClick={pasteFromMenu} />
                  <div className="my-1 border-t border-border-subtle" />
                </>
              )}
              {MENU_GROUPS.map((group, gi) => (
                <div key={group[0]}>
                  {gi > 0 && <div className="my-1 border-t border-border-subtle" />}
                  {group.map((kind) => (
                    <MenuItem
                      key={kind}
                      icon={KIND_ICONS[kind]}
                      label={NODE_KIND_LABELS[kind]}
                      onClick={() => addFromMenu(kind)}
                    />
                  ))}
                </div>
              ))}
            </>
          ) : (
            menuTarget && (
              <>
                <MenuItem icon={Copy} label="コピー" onClick={() => copyFromMenu(menuTarget.id)} />
                {menuTarget.type === "stack" && (
                  <MenuItem
                    icon={Ungroup}
                    label="スタックを解除"
                    onClick={() => dissolveFromMenu(menuTarget.id)}
                  />
                )}
                <div className="my-1 border-t border-border-subtle" />
                <MenuItem
                  icon={Trash2}
                  label="削除"
                  danger
                  onClick={() => deleteFromMenu(menuTarget.id)}
                />
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
