import { useEffect, useRef, useState } from "react";
import { parseImport, serializeExport } from "@/lib/exportImport";
import { DEFAULT_NODE_WIDTHS, MAX_NODE_WIDTH, MIN_NODE_WIDTH, WIDTH_KINDS } from "@/lib/nodeWidths";
import { THEMES, type Theme } from "@/lib/theme";
import { useBoardStore } from "@/store";
import { NODE_KIND_LABELS } from "@/types/board";

const THEME_LABELS = { dark: "ダーク", light: "ライト", auto: "自動" } satisfies Record<
  Theme,
  string
>;

const SECTIONS = [
  { id: "theme", label: "テーマ" },
  { id: "nodeWidth", label: "ノードの横幅" },
  { id: "export", label: "エクスポート" },
  { id: "backup", label: "バックアップ" },
  { id: "session", label: "現在のセッション" },
  { id: "reset", label: "完全リセット" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// 設定項目の説明文
function Description({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-text-secondary">{children}</p>;
}

// 未実装の操作ボタン。押せない状態で表示だけ行う
function PendingButton({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled
      title="未実装"
      className={`btn-ghost btn-sm w-fit text-sm ${danger ? "text-danger" : ""}`}
    >
      {label}
    </button>
  );
}

// 設定モーダル。左のメニューで項目を選び、右にその内容を表示する。
// テーマ選択は onSetTheme で即時反映する。未実装の操作は PendingButton で表示のみ。
// Escape・背景クリック・× ボタンで onClose を呼ぶ。開閉のたびにマウントし直す前提。
export function SettingsModal({
  theme,
  onSetTheme,
  onClose,
}: {
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<SectionId>("theme");
  const nodeWidths = useBoardStore((s) => s.nodeWidths);
  const setNodeWidth = useBoardStore((s) => s.setNodeWidth);
  const importSessionData = useBoardStore((s) => s.importSessionData);
  const removeSession = useBoardStore((s) => s.removeSession);
  const resetAll = useBoardStore((s) => s.resetAll);
  const isDemoSession = useBoardStore(
    (s) => s.sessions.find((m) => m.id === s.currentId)?.isDemo === true,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  // 現在のセッションを JSON ファイルとしてダウンロードさせる。ファイル名はセッション名
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

  // 選択された JSON を検証して新規セッションとして取り込む。不正な内容は alert で通知
  const importJson = async (file: File) => {
    try {
      await importSessionData(parseImport(await file.text()));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "インポートに失敗しました");
    }
  };

  const remove = () => {
    if (window.confirm("このセッションを削除しますか？この操作は取り消せません。")) {
      void removeSession();
    }
  };

  const reset = () => {
    if (
      window.confirm(
        "すべてのセッション・設定・保存データを削除して初期状態に戻しますか？この操作は取り消せません。",
      )
    ) {
      void resetAll();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const CONTENT = {
    theme: (
      <>
        <Description>アプリ全体の配色を切り替えます。</Description>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              className={`btn-ghost btn-sm text-sm ${
                t === theme ? "border-accent text-accent" : ""
              }`}
              onClick={() => onSetTheme(t)}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </>
    ),
    nodeWidth: (
      <>
        <Description>
          ノード種別ごとの横幅をピクセルで指定します。空欄なら種別ごとの既定値になります。
          スタックは子のサイズに追従するため対象外です。
        </Description>
        <div className="flex flex-col gap-2">
          {WIDTH_KINDS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm text-text-primary">
              <span className="w-36 shrink-0">{NODE_KIND_LABELS[kind]}</span>
              {/* 確定は blur。確定時の丸め結果を入力欄へ反映させるため、確定値で強制的に再マウントする */}
              <input
                key={`${kind}:${nodeWidths[kind] ?? ""}`}
                type="number"
                min={MIN_NODE_WIDTH}
                max={MAX_NODE_WIDTH}
                placeholder={String(DEFAULT_NODE_WIDTHS[kind])}
                defaultValue={nodeWidths[kind] ?? ""}
                className="input-base w-24 text-sm"
                onBlur={(e) =>
                  setNodeWidth(kind, e.target.value === "" ? undefined : Number(e.target.value))
                }
              />
              <span className="text-text-muted">px</span>
            </label>
          ))}
        </div>
      </>
    ),
    export: (
      <>
        <Description>メモ内容を Markdown テキストとしてクリップボードにコピーします。</Description>
        <PendingButton label="全メモをコピー" />
      </>
    ),
    backup: (
      <>
        <Description>
          現在のセッションのデータを JSON
          ファイルとしてエクスポート、またはファイルからインポートして復元します。
        </Description>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost btn-sm text-sm" onClick={exportJson}>
            エクスポート
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm text-sm"
            onClick={() => fileRef.current?.click()}
          >
            インポート
          </button>
        </div>
      </>
    ),
    session: (
      <>
        <Description>
          現在のセッションのすべての付箋と接続線を削除します。セッション自体は残ります。
        </Description>
        <PendingButton label="初期化する" danger />
        <Description>現在のセッションそのものを削除します。この操作は取り消せません。</Description>
        <button
          type="button"
          disabled={isDemoSession}
          title={isDemoSession ? "デモセッションは削除できません" : undefined}
          className="btn-ghost btn-sm w-fit text-sm text-danger"
          onClick={remove}
        >
          セッションを削除
        </button>
      </>
    ),
    reset: (
      <>
        <Description>
          すべてのセッション・設定・保存データを完全に削除し、アプリを初期状態に戻します。
        </Description>
        <button
          type="button"
          className="btn-ghost btn-sm w-fit text-sm text-danger"
          onClick={reset}
        >
          完全リセット
        </button>
      </>
    ),
  } satisfies Record<SectionId, React.ReactNode>;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose} />
      <div
        className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
        style={{ animation: "search-in 0.15s ease-out" }}
        role="dialog"
        aria-label="設定"
      >
        <div
          className="flex flex-col rounded-md border border-border-default bg-bg-elevated shadow-lg"
          style={{ width: "min(720px, calc(100vw - 24px))", height: "min(560px, 100vh - 48px)" }}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
            <h2 className="text-sm font-bold text-text-primary">設定</h2>
            <button
              type="button"
              aria-label="閉じる"
              className="cursor-pointer px-1 text-text-muted hover:text-text-primary"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* 左メニュー */}
            <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-subtle p-2">
              {SECTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`cursor-pointer rounded px-2.5 py-1.5 text-left text-sm ${
                    id === section
                      ? "bg-bg-active text-text-primary"
                      : "text-text-secondary hover:bg-bg-hover"
                  }`}
                  onClick={() => setSection(id)}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* 右コンテンツ */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <h3 className="text-sm font-bold text-text-primary">
                {SECTIONS.find((s) => s.id === section)?.label}
              </h3>
              {CONTENT[section]}
            </div>
          </div>
        </div>
      </div>
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
    </>
  );
}
