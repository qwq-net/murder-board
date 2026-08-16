import { useReactFlow } from '@xyflow/react';
import { useRef } from 'react';
import { parseImport, serializeExport } from '@/lib/exportImport';
import { useBoardStore } from '@/store';

const BUTTON_CLASS =
  'cursor-pointer rounded border border-zinc-300 bg-white px-2 py-1 text-sm hover:bg-zinc-100';

export function Toolbar() {
  const sessions = useBoardStore((s) => s.sessions);
  const currentId = useBoardStore((s) => s.currentId);
  const addNode = useBoardStore((s) => s.addNode);
  const createSession = useBoardStore((s) => s.createSession);
  const switchSession = useBoardStore((s) => s.switchSession);
  const renameSession = useBoardStore((s) => s.renameSession);
  const removeSession = useBoardStore((s) => s.removeSession);
  const importSessionData = useBoardStore((s) => s.importSessionData);
  const { screenToFlowPosition } = useReactFlow();
  const fileRef = useRef<HTMLInputElement>(null);

  const addAtCenter = () =>
    addNode('sticky', screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));

  const rename = () => {
    const meta = sessions.find((m) => m.id === currentId);
    const name = window.prompt('セッション名', meta?.name ?? '');
    if (name) renameSession(name);
  };

  const remove = () => {
    if (window.confirm('このセッションを削除しますか？この操作は取り消せません。')) {
      void removeSession();
    }
  };

  const exportJson = () => {
    const s = useBoardStore.getState();
    const meta = s.sessions.find((m) => m.id === s.currentId);
    if (!meta) return;
    const blob = new Blob([serializeExport({ ...meta, nodes: s.nodes, edges: s.edges })], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      await importSessionData(parseImport(await file.text()));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'インポートに失敗しました');
    }
  };

  return (
    <header className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
      <h1 className="mr-2 text-sm font-bold text-zinc-700">マダめもくん2</h1>
      <select
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
        value={currentId ?? ''}
        onChange={(e) => void switchSession(e.target.value)}
      >
        {sessions.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button type="button" className={BUTTON_CLASS} onClick={() => void createSession()}>
        新規
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={rename}>
        名前変更
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={remove}>
        削除
      </button>
      <span className="mx-1 h-5 w-px bg-zinc-300" />
      <button type="button" className={BUTTON_CLASS} onClick={addAtCenter}>
        ＋付箋
      </button>
      <span className="ml-auto hidden text-xs text-zinc-400 sm:inline">
        右クリックでメモを追加 / Ctrl+Z で元に戻す
      </span>
      <button type="button" className={BUTTON_CLASS} onClick={exportJson}>
        エクスポート
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={() => fileRef.current?.click()}>
        インポート
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importJson(file);
          e.target.value = '';
        }}
      />
    </header>
  );
}
