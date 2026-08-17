import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
import { Board } from "@/components/board/Board";
import { Toolbar } from "@/components/board/Toolbar";
import { useTheme } from "@/lib/theme";
import { useBoardStore } from "@/store";

export function App() {
  const loaded = useBoardStore((s) => s.loaded);
  const init = useBoardStore((s) => s.init);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    void init();
  }, [init]);

  if (!loaded) {
    return (
      <div className="flex h-dvh items-center justify-center text-text-muted">読み込み中...</div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col">
        <Toolbar theme={theme} onToggleTheme={toggle} />
        <Board theme={theme} />
      </div>
    </ReactFlowProvider>
  );
}
