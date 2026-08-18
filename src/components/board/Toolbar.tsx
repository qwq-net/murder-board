import { Plus, Search, Settings, SquarePen } from "lucide-react";
import { useBoardStore } from "@/store";

const BUTTON_CLASS = "btn-ghost btn-sm text-sm";
// アイコンのみのボタン。テキストボタンと高さが揃う正方形の枠にする
const ICON_BUTTON_CLASS = "btn-ghost size-8 shrink-0 justify-center";

export function Toolbar({
  onOpenSearch,
  onOpenSettings,
}: {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}) {
  const sessions = useBoardStore((s) => s.sessions);
  const currentId = useBoardStore((s) => s.currentId);
  const createSession = useBoardStore((s) => s.createSession);
  const switchSession = useBoardStore((s) => s.switchSession);
  const renameSession = useBoardStore((s) => s.renameSession);

  const rename = () => {
    const meta = sessions.find((m) => m.id === currentId);
    const name = window.prompt("セッション名", meta?.name ?? "");
    if (name) renameSession(name);
  };

  return (
    <header className="flex items-center gap-2 border-b border-border-subtle bg-bg-surface px-3 py-2">
      <h1 className="mr-2 text-sm font-bold whitespace-nowrap text-text-secondary">
        マダめもくん2
      </h1>
      <select
        className="input-base min-w-0 shrink max-w-48 pr-2 text-sm"
        value={currentId ?? ""}
        onChange={(e) => void switchSession(e.target.value)}
      >
        {sessions.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        title="新規セッション"
        aria-label="新規セッション"
        className={ICON_BUTTON_CLASS}
        onClick={() => void createSession()}
      >
        <Plus className="mr" size={14} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        title="セッション名を変更"
        aria-label="セッション名を変更"
        className={ICON_BUTTON_CLASS}
        onClick={rename}
      >
        <SquarePen size={14} />
      </button>
      <button
        type="button"
        title="検索 (Ctrl+F)"
        className={`${BUTTON_CLASS} ml-auto`}
        onClick={onOpenSearch}
      >
        <Search size={14} />
        検索
      </button>
      <button type="button" title="設定" className={BUTTON_CLASS} onClick={onOpenSettings}>
        <Settings size={14} />
        設定
      </button>
    </header>
  );
}
