import { useRef, useState } from "react";
import { parseImport, serializeExport } from "@/lib/exportImport";
import type { Theme } from "@/lib/theme";
import { useBoardStore } from "@/store";

const BUTTON_CLASS = "btn-ghost btn-sm text-sm";

const THEME_LABELS = { dark: "ダーク", light: "ライト", auto: "自動" } satisfies Record<
  Theme,
  string
>;

export function Toolbar({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const sessions = useBoardStore((s) => s.sessions);
  const currentId = useBoardStore((s) => s.currentId);
  const createSession = useBoardStore((s) => s.createSession);
  const switchSession = useBoardStore((s) => s.switchSession);
  const renameSession = useBoardStore((s) => s.renameSession);
  const removeSession = useBoardStore((s) => s.removeSession);
  const importSessionData = useBoardStore((s) => s.importSessionData);
  const fileRef = useRef<HTMLInputElement>(null);
  // ⋯ ボタンで開くセッションメニューの開閉状態
  const [menuOpen, setMenuOpen] = useState(false);

  const rename = () => {
    const meta = sessions.find((m) => m.id === currentId);
    const name = window.prompt("セッション名", meta?.name ?? "");
    if (name) renameSession(name);
  };

  const remove = () => {
    if (window.confirm("このセッションを削除しますか？この操作は取り消せません。")) {
      void removeSession();
    }
  };

  const exportJson = () => {
    const s = useBoardStore.getState();
    const meta = s.sessions.find((m) => m.id === s.currentId);
    if (!meta) return;
    const blob = new Blob([serializeExport({ ...meta, nodes: s.nodes, edges: s.edges })], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meta.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      await importSessionData(parseImport(await file.text()));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "インポートに失敗しました");
    }
  };

  const MENU_ITEMS: { label: string; danger?: boolean; onClick: () => void }[] = [
    { label: "新規セッション", onClick: () => void createSession() },
    { label: "名前変更", onClick: rename },
    { label: "エクスポート", onClick: exportJson },
    { label: "インポート", onClick: () => fileRef.current?.click() },
    { label: "削除", danger: true, onClick: remove },
  ];

  return (
    <header className="flex items-center gap-2 border-b border-border-subtle bg-bg-surface px-3 py-2">
      <h1 className="mr-2 text-sm font-bold whitespace-nowrap text-text-secondary">
        マダめもくん2
      </h1>
      <select
        className="input-base min-w-0 shrink max-w-48 text-sm"
        value={currentId ?? ""}
        onChange={(e) => void switchSession(e.target.value)}
      >
        {sessions.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <div className="relative">
        <button
          type="button"
          title="セッション操作"
          aria-label="セッション操作"
          className={BUTTON_CLASS}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-full left-0 z-50 mt-1 min-w-40 rounded border border-border-default bg-bg-elevated py-1 shadow-lg">
              {MENU_ITEMS.map(({ label, danger, onClick }) => (
                <button
                  key={label}
                  type="button"
                  className={`block w-full cursor-pointer px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-bg-hover ${
                    danger ? "text-danger" : ""
                  }`}
                  onClick={() => {
                    setMenuOpen(false);
                    onClick();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        title="テーマ切替"
        className={`${BUTTON_CLASS} ml-auto`}
        onClick={onToggleTheme}
      >
        {THEME_LABELS[theme]}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importJson(file);
          e.target.value = "";
        }}
      />
    </header>
  );
}
