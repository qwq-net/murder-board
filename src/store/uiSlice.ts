import {
  clampNodeWidth,
  loadNodeWidths,
  saveNodeWidths,
  type NodeWidths,
  type WidthKind,
} from "@/lib/nodeWidths";

// 盤面データに属さない UI 状態のスライス。いずれも揮発状態か localStorage 同期の
// アプリ設定で、セッションにも Undo 履歴（temporal の partialize は nodes のみ）にも含めない
export type UiSlice = {
  // 検索オーバーレイの状態。null なら閉、文字列なら開でその値が検索欄の初期値。
  // 本文中の検索リンクが「その文言入りで検索を開く」ために文字列を持つ
  searchSeed: string | null;
  openSearch: (seed: string) => void;
  closeSearch: () => void;

  // addNode で直近に追加されたノードの id。NodeShell がマウント時に自ノードと一致したら
  // タイトルを編集状態で始めるための印で、貼り付けや複製では更新しない
  newNodeId: string | null;

  // 直近操作の表示用ログ。各エントリは一意の id を持ち、UI 側が表示済みの判定に使う
  opsLog: { id: number; message: string }[];
  // 操作ログへ 1 件追記する。保持は直近 8 件まで
  logOp: (message: string) => void;

  // ブラウザ標準の alert/confirm の置き換えに使う自前ダイアログの状態。null なら閉。
  // resolve はダイアログを出した Promise を解決するためのもので、closeDialog だけが呼ぶ
  dialog: { message: string; kind: "alert" | "confirm"; resolve: (ok: boolean) => void } | null;
  // メッセージを自前モーダルで表示し、閉じられたら解決する。多重に開いた場合は後勝ち
  showAlert: (message: string) => Promise<void>;
  // 確認ダイアログを表示し、実行なら true・キャンセルなら false で解決する
  showConfirm: (message: string) => Promise<boolean>;
  // 開いているダイアログを閉じて resolve を呼ぶ。alert では ok の値は使われない
  closeDialog: (ok: boolean) => void;

  // ノード種別ごとのデフォルト横幅。localStorage と同期するアプリ設定でセッションに属さない
  nodeWidths: NodeWidths;
  // 種別の横幅を更新して永続化する。範囲外は丸め、undefined でその種別を既定値へ戻す
  setNodeWidth: (kind: WidthKind, width: number | undefined) => void;
};

// 操作ログの採番。表示済み判定に使うだけの連番で、永続化しない
let opSeq = 0;

// UI スライスの実装。store 本体の (set, get) をそのまま受けて初期値とアクションを返す。
// UiSlice の範囲しか触らないため、set / get は UiSlice へ狭めた型で受ける
export const createUiSlice = (
  set: (partial: Partial<UiSlice>) => void,
  get: () => UiSlice,
): UiSlice => ({
  searchSeed: null,
  openSearch: (seed) => set({ searchSeed: seed }),
  closeSearch: () => set({ searchSeed: null }),

  newNodeId: null,

  opsLog: [],
  logOp: (message) => set({ opsLog: [...get().opsLog, { id: ++opSeq, message }].slice(-8) }),

  dialog: null,
  showAlert: (message) =>
    new Promise((resolve) => {
      set({ dialog: { message, kind: "alert", resolve: () => resolve() } });
    }),
  showConfirm: (message) =>
    new Promise((resolve) => {
      set({ dialog: { message, kind: "confirm", resolve } });
    }),
  closeDialog: (ok) => {
    const { dialog } = get();
    if (!dialog) return;
    set({ dialog: null });
    dialog.resolve(ok);
  },

  nodeWidths: loadNodeWidths(),
  setNodeWidth: (kind, width) => {
    const next = { ...get().nodeWidths };
    if (width === undefined || !Number.isFinite(width)) {
      delete next[kind];
    } else {
      next[kind] = clampNodeWidth(width);
    }
    saveNodeWidths(next);
    set({ nodeWidths: next });
  },
});
