import { useEffect } from "react";
import { useBoardStore } from "@/store";

// ブラウザ標準の alert/confirm を置き換える自前モーダル。ストアの dialog 状態を映すだけで、
// 表示の指示は store.showAlert / showConfirm から行う。Escape と背景クリックはキャンセル扱い。
// Escape は capture 段階で止め、背後のモーダル（設定など）の Escape 閉じを誘発させない。
// 使われ方: App のルートに 1 つだけ置く前提。
export function AppDialog() {
  const dialog = useBoardStore((s) => s.dialog);
  const closeDialog = useBoardStore((s) => s.closeDialog);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeDialog(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dialog, closeDialog]);

  if (!dialog) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/30" onClick={() => closeDialog(false)} />
      <div
        className="fixed top-1/2 left-1/2 z-[60] -translate-x-1/2 -translate-y-1/2"
        style={{ animation: "search-in 0.15s ease-out" }}
        role={dialog.kind === "confirm" ? "alertdialog" : "alert"}
      >
        <div
          className="flex flex-col gap-4 rounded-md border border-border-default bg-bg-elevated p-4 shadow-lg"
          style={{ width: "min(360px, calc(100vw - 24px))" }}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-text-primary">
            {dialog.message}
          </p>
          <div className="flex justify-end gap-2">
            {dialog.kind === "confirm" && (
              <button
                type="button"
                className="btn-ghost btn-sm text-sm"
                onClick={() => closeDialog(false)}
              >
                キャンセル
              </button>
            )}
            <button
              type="button"
              autoFocus
              className="btn-ghost btn-sm text-sm border-accent text-accent"
              onClick={() => closeDialog(true)}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
