import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type EdgeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { StickyNode } from '@/components/nodes/StickyNode';
import { TimelineNode } from '@/components/nodes/TimelineNode';
import type { Theme } from '@/lib/theme';
import { useBoardStore } from '@/store';
import type { BoardEdge, BoardNode, BoardNodeKind } from '@/types/board';

const nodeTypes: NodeTypes = { sticky: StickyNode, timeline: TimelineNode };

const MENU_ITEMS: { kind: BoardNodeKind; label: string }[] = [
  { kind: 'sticky', label: '通常メモ' },
  { kind: 'timeline', label: 'タイムラインメモ' },
];

export function Board({ theme }: { theme: Theme }) {
  const nodes = useBoardStore((s) => s.nodes);
  const edges = useBoardStore((s) => s.edges);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const onEdgesChange = useBoardStore((s) => s.onEdgesChange);
  const onConnect = useBoardStore((s) => s.onConnect);
  const addNode = useBoardStore((s) => s.addNode);
  const updateEdgeLabel = useBoardStore((s) => s.updateEdgeLabel);
  const { screenToFlowPosition } = useReactFlow();
  // 右クリックメニューの表示位置（画面座標）。null なら非表示
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Ctrl/Cmd+Z で Undo、Shift 併用で Redo。入力欄へのタイプは対象外
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      const temporal = useBoardStore.temporal.getState();
      if (e.shiftKey) temporal.redo();
      else temporal.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 何もない場所（ペイン）のダブルクリックで付箋を追加
  const onDoubleClick = (e: ReactMouseEvent) => {
    if (!(e.target as Element).classList.contains('react-flow__pane')) return;
    addNode('sticky', screenToFlowPosition({ x: e.clientX, y: e.clientY }));
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

  const onEdgeDoubleClick: EdgeMouseHandler<BoardEdge> = (_, edge) => {
    const label = window.prompt('つながりのラベル', typeof edge.label === 'string' ? edge.label : '');
    if (label !== null) updateEdgeLabel(edge.id, label);
  };

  return (
    <div className="relative min-h-0 flex-1" onDoubleClick={onDoubleClick}>
      <ReactFlow<BoardNode, BoardEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => setMenu(null)}
        onMoveStart={() => setMenu(null)}
        nodeTypes={nodeTypes}
        colorMode={theme === 'auto' ? 'system' : theme}
        deleteKeyCode={['Backspace', 'Delete']}
        zoomOnDoubleClick={false}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      {menu && (
        <div
          className="fixed z-50 min-w-40 rounded border border-border-default bg-bg-elevated py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          {MENU_ITEMS.map(({ kind, label }) => (
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
