import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type EdgeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import { useEffect, type MouseEvent } from 'react';
import { StickyNode } from '@/components/nodes/StickyNode';
import { useBoardStore } from '@/store';
import type { BoardEdge, BoardNode } from '@/types/board';

const nodeTypes: NodeTypes = { sticky: StickyNode };

export function Board() {
  const nodes = useBoardStore((s) => s.nodes);
  const edges = useBoardStore((s) => s.edges);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const onEdgesChange = useBoardStore((s) => s.onEdgesChange);
  const onConnect = useBoardStore((s) => s.onConnect);
  const addSticky = useBoardStore((s) => s.addSticky);
  const updateEdgeLabel = useBoardStore((s) => s.updateEdgeLabel);
  const { screenToFlowPosition } = useReactFlow();

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
  const onDoubleClick = (e: MouseEvent) => {
    if (!(e.target as Element).classList.contains('react-flow__pane')) return;
    addSticky(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  const onEdgeDoubleClick: EdgeMouseHandler<BoardEdge> = (_, edge) => {
    const label = window.prompt('つながりのラベル', typeof edge.label === 'string' ? edge.label : '');
    if (label !== null) updateEdgeLabel(edge.id, label);
  };

  return (
    <div className="min-h-0 flex-1" onDoubleClick={onDoubleClick}>
      <ReactFlow<BoardNode, BoardEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        deleteKeyCode={['Backspace', 'Delete']}
        zoomOnDoubleClick={false}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
