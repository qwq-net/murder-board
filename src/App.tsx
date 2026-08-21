import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState } from "react";
import { Board } from "@/components/board/Board";
import { SearchOverlay } from "@/components/board/SearchOverlay";
import { Toolbar } from "@/components/board/Toolbar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { useTheme } from "@/lib/theme";
import { useBoardStore } from "@/store";

export function App() {
  const loaded = useBoardStore((s) => s.loaded);
  const init = useBoardStore((s) => s.init);
  const { theme, setTheme } = useTheme();
  // 検索の開閉はストアが持つ。本文中の検索リンクが文言入りで開けるようにするため
  const searchSeed = useBoardStore((s) => s.searchSeed);
  const openSearch = useBoardStore((s) => s.openSearch);
  const closeSearch = useBoardStore((s) => s.closeSearch);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        openSearch("");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [openSearch]);

  if (!loaded) {
    return (
      <div className="flex h-dvh items-center justify-center text-text-muted">読み込み中...</div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col">
        <Toolbar onOpenSearch={() => openSearch("")} onOpenSettings={() => setSettingsOpen(true)} />
        <Board theme={theme} />
      </div>
      {searchSeed !== null && <SearchOverlay initialQuery={searchSeed} onClose={closeSearch} />}
      {settingsOpen && (
        <SettingsModal theme={theme} onSetTheme={setTheme} onClose={() => setSettingsOpen(false)} />
      )}
    </ReactFlowProvider>
  );
}
