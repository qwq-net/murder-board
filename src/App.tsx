import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Board } from '@/components/board/Board';
import { Toolbar } from '@/components/board/Toolbar';
import { useBoardStore } from '@/store';

export function App() {
  const loaded = useBoardStore((s) => s.loaded);
  const init = useBoardStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (!loaded) {
    return <div className="flex h-dvh items-center justify-center text-zinc-500">読み込み中...</div>;
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col">
        <Toolbar />
        <Board />
      </div>
    </ReactFlowProvider>
  );
}
