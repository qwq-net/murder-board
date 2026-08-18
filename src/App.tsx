import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState } from "react";
import { Board } from "@/components/board/Board";
import { SearchOverlay } from "@/components/board/SearchOverlay";
import { Toolbar } from "@/components/board/Toolbar";
import { useTheme } from "@/lib/theme";
import { useBoardStore } from "@/store";

export function App() {
  const loaded = useBoardStore((s) => s.loaded);
  const init = useBoardStore((s) => s.init);
  const { theme, toggle } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  // Ctrl/Cmd+F でブラウザ検索の代わりにメモ検索を開く。入力欄フォーカス中も対象。
  // IME 変換中は e.key が "Process" になるため物理キーの e.code でも判定し、
  // 途中の要素に stopPropagation されても届くよう capture 段階で受ける
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "f" || e.code === "KeyF")) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  if (!loaded) {
    return (
      <div className="flex h-dvh items-center justify-center text-text-muted">読み込み中...</div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col">
        <Toolbar theme={theme} onToggleTheme={toggle} onOpenSearch={() => setSearchOpen(true)} />
        <Board theme={theme} />
      </div>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </ReactFlowProvider>
  );
}
