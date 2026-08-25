import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { temporal } from "zundo";
import { debounce, throttleLeading } from "@/lib/debounce";
import { buildDemoSession, DEMO_VERSION } from "@/lib/demoSession";
import * as idb from "@/lib/idb";
import { DEFAULT_NODE_WIDTHS, NODE_WIDTHS_KEY } from "@/lib/nodeWidths";
import {
  applyStackDrops,
  relayoutOnDimensionChanges,
  STACK_EMPTY_H,
  stackEmptyWidth,
} from "@/lib/stackLayout";
import { THEME_KEY } from "@/lib/theme";
import { createUiSlice, type UiSlice } from "@/store/uiSlice";
import {
  DEFAULT_NODE_COLORS,
  NODE_KIND_LABELS,
  type BoardNode,
  type BoardNodeKind,
  type Session,
  type SessionMeta,
} from "@/types/board";

const LAST_SESSION_KEY = "murder-memo2-last-session";

// ノード種別からその data 型を引く。updateNodeData の patch を種別ごとに型付けるために使う
type DataOf<K extends BoardNodeKind> = Extract<BoardNode, { type: K }>["data"];

type Store = UiSlice & {
  loaded: boolean;
  sessions: SessionMeta[];
  currentId: string | null;
  nodes: BoardNode[];

  // IDB からセッション一覧を読み、前回のセッションを開く。前回のセッションが無ければ新規作成する。
  // 多重呼び出しは無視。
  init: () => Promise<void>;

  onNodesChange: (changes: NodeChange<BoardNode>[]) => void;
  // ドラッグ終了した選択ノード群のスタック所属を applyStackDrops で解決する。変更が無ければ何もしない。
  onNodeDragStop: (dragged: BoardNode[]) => void;
  // 指定位置に空のノードを追加する。position はフロー座標。追加したノードは newNodeId に
  // 記録され、タイトルの編集から始まる。行を持つ種別は空行 1 つ付きで作られる。
  addNode: (kind: BoardNodeKind, position: { x: number; y: number }) => void;
  // 組み立て済みのノード列を末尾へ追加する。貼り付け・複製用。親子を含むときは親が先に
  // 並んでいる前提。opLabel を渡すと操作ログの文言を差し替えられる。
  addNodes: (added: BoardNode[], opLabel?: string) => void;
  // スタックだけを削除し、子をその場の絶対位置で盤面直下に残す。見た目の位置と順序は
  // 変わらない。id がスタック以外を指すときは何もしない。
  dissolveStack: (id: string) => void;
  // 指定 id かつ指定種別のノードの data を部分更新する。id が存在しても種別が一致しなければ何もしない。
  updateNodeData: <K extends BoardNodeKind>(id: string, type: K, patch: Partial<DataOf<K>>) => void;
  // 現在のセッションのメモを全削除する。セッション自体は残り、Undo で戻せる。
  // 既に空なら履歴も操作ログも汚さず何もしない。
  clearNodes: () => void;

  createSession: () => Promise<void>;
  // 未保存の変更を flush してから切り替える。切替後は Undo 履歴をクリアする。
  switchSession: (id: string) => Promise<void>;
  // 現在のセッションをリネームして即保存する。
  renameSession: (name: string) => void;
  // 現在のセッションを削除する。残りが無ければ新規セッションを作って開く。
  removeSession: () => Promise<void>;
  // parseImport 済みのセッションを保存して開く。バリデーションは呼び手側で済んでいる前提。
  importSessionData: (session: Session) => Promise<void>;
  // 全セッション・保存キー・テーマ設定を削除し、ページを再読み込みして初期状態に戻す。
  // 確認ダイアログは呼び手側で済んでいる前提。
  resetAll: () => Promise<void>;
};

function newSession(): Session {
  const now = Date.now();
  return {
    id: nanoid(),
    name: "新しいセッション",
    createdAt: now,
    updatedAt: now,
    nodes: [],
  };
}

// nodes 以外を丸ごと残す。isDemo/demoVersion を落とすと自動保存で
// デモの印が消え、次回起動時にデモが二重作成されるため、フィールドを列挙しない
function toMeta(session: Session): SessionMeta {
  const { nodes: _nodes, ...meta } = session;
  return meta;
}

let initStarted = false;

export const useBoardStore = create<Store>()(
  temporal(
    (set, get) => ({
      ...createUiSlice(set, get),
      loaded: false,
      sessions: [],
      currentId: null,
      nodes: [],

      init: async () => {
        if (initStarted) return;
        initStarted = true;

        let metas = await idb.listSessionMetas();

        // デモセッションの保証: 未作成またはバージョン不一致なら最新デモへ置き換える。
        // isDemo の有無で判定するため、既にあれば何度起動しても二重には作られない
        const oldDemo = metas.find((m) => m.isDemo);
        if (!oldDemo || oldDemo.demoVersion !== DEMO_VERSION) {
          const demo = buildDemoSession();
          if (oldDemo) {
            await idb.deleteSession(oldDemo.id);
            metas = metas.filter((m) => m.id !== oldDemo.id);
            // 旧デモを開いていた場合、復元先を新デモへ引き継ぐ
            if (localStorage.getItem(LAST_SESSION_KEY) === oldDemo.id) {
              localStorage.setItem(LAST_SESSION_KEY, demo.id);
            }
          }
          await idb.putSession(demo);
          metas = [...metas, toMeta(demo)];
        }

        const lastId = localStorage.getItem(LAST_SESSION_KEY);
        let session = lastId ? await idb.getSession(lastId) : undefined;
        if (!session && metas.length > 0) {
          session = await idb.getSession(metas[metas.length - 1]!.id);
        }
        if (!session) {
          session = newSession();
          await idb.putSession(session);
          metas = [...metas, toMeta(session)];
        }
        localStorage.setItem(LAST_SESSION_KEY, session.id);
        set({
          loaded: true,
          sessions: metas,
          currentId: session.id,
          nodes: session.nodes,
        });
        useBoardStore.temporal.getState().clear();
      },

      onNodesChange: (changes) => {
        // スタックの削除時は子も一緒に消す。React Flow が子の remove を発行しない
        // 経路に備え、削除対象を親に持つ子の remove を補ってから適用する
        const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
        if (removed.size > 0) {
          const orphans = get().nodes.filter(
            (n) => n.parentId && removed.has(n.parentId) && !removed.has(n.id),
          );
          changes = [...changes, ...orphans.map((n) => ({ type: "remove" as const, id: n.id }))];
          get().logOp(removed.size === 1 ? "メモを削除" : `${removed.size}件を削除`);
        }
        const applied = applyNodeChanges(changes, get().nodes);
        // テキストの折り返しなどで子の高さが変わったら、その場でスタックを詰め直す
        set({ nodes: relayoutOnDimensionChanges(applied, changes, emptyStackWidth()) });
      },
      onNodeDragStop: (dragged) => {
        get().logOp(dragged.length === 1 ? "メモを移動" : `${dragged.length}件を移動`);
        const next = applyStackDrops(
          get().nodes,
          dragged.map((n) => n.id),
          emptyStackWidth(),
        );
        if (next) set({ nodes: next });
      },

      addNode: (kind, position) => {
        const node: BoardNode =
          kind === "sticky"
            ? {
                id: nanoid(),
                type: "sticky",
                position,
                data: { title: "", text: "" },
              }
            : kind === "timeline"
              ? {
                  id: nanoid(),
                  type: "timeline",
                  position,
                  data: { title: "", entries: [{ id: nanoid(), time: "", text: "" }] },
                }
              : kind === "list"
                ? {
                    id: nanoid(),
                    type: "list",
                    position,
                    data: { title: "", entries: [{ id: nanoid(), text: "" }] },
                  }
                : kind === "keyword"
                  ? {
                      id: nanoid(),
                      type: "keyword",
                      position,
                      data: { title: "", entries: [{ id: nanoid(), text: "" }] },
                    }
                  : kind === "character"
                    ? {
                        id: nanoid(),
                        type: "character",
                        position,
                        data: {
                          title: "",
                          entries: [
                            { id: nanoid(), text: "", color: DEFAULT_NODE_COLORS.character },
                          ],
                        },
                      }
                    : kind === "actionlog"
                      ? {
                          id: nanoid(),
                          type: "actionlog",
                          position,
                          data: {
                            title: "",
                            entries: [{ id: nanoid(), from: "", to: "", text: "" }],
                          },
                        }
                      : {
                          id: nanoid(),
                          type: "stack",
                          position,
                          width: emptyStackWidth(),
                          height: STACK_EMPTY_H,
                          data: { title: "" },
                        };
        set({ nodes: [...get().nodes, node], newNodeId: node.id });
        get().logOp(`${NODE_KIND_LABELS[kind]}を追加`);
      },

      addNodes: (added, opLabel) => {
        set({ nodes: [...get().nodes, ...added] });
        get().logOp(
          opLabel ?? (added.length === 1 ? "1件を貼り付け" : `${added.length}件を貼り付け`),
        );
      },

      dissolveStack: (id) => {
        const stackNode = get().nodes.find((n) => n.id === id);
        if (stackNode?.type !== "stack") return;
        get().logOp("スタックを解除");
        set({
          nodes: get().nodes.flatMap((n) => {
            if (n.id === id) return [];
            if (n.parentId !== id) return [n];
            const { parentId: _parentId, ...detached } = n;
            // SAFETY: parentId を除き position を絶対座標へ差し替えただけで、type と data の
            // 相関は変わらない。ユニオンをまたぐ再構築を TS が追えないためだけの表明
            return [
              {
                ...detached,
                position: {
                  x: stackNode.position.x + n.position.x,
                  y: stackNode.position.y + n.position.y,
                },
              } as BoardNode,
            ];
          }),
        });
      },

      updateNodeData: (id, type, patch) => {
        if (!get().nodes.some((n) => n.id === id && n.type === type)) return;
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== id || n.type !== type) return n;
            // SAFETY: n.type === type を確認済みなので、patch は n と同じ種別の data の部分型。
            // ジェネリクス越しの相関を TS が追えないためだけの表明で、実行時の形は変わらない
            return { ...n, data: { ...n.data, ...patch } } as BoardNode;
          }),
        });
        get().logOp(`${NODE_KIND_LABELS[type]}を編集`);
      },

      clearNodes: () => {
        if (get().nodes.length === 0) return;
        set({ nodes: [] });
        get().logOp("すべてのメモを削除");
      },

      createSession: async () => {
        scheduleSave.flush();
        const session = newSession();
        await idb.putSession(session);
        localStorage.setItem(LAST_SESSION_KEY, session.id);
        set({
          sessions: [...get().sessions, toMeta(session)],
          currentId: session.id,
          nodes: [],
        });
        useBoardStore.temporal.getState().clear();
      },

      switchSession: async (id) => {
        if (id === get().currentId) return;
        scheduleSave.flush();
        const session = await idb.getSession(id);
        if (!session) return;
        localStorage.setItem(LAST_SESSION_KEY, id);
        set({ currentId: id, nodes: session.nodes });
        useBoardStore.temporal.getState().clear();
      },

      renameSession: (name) => {
        const { currentId, sessions } = get();
        if (!currentId) return;
        set({ sessions: sessions.map((m) => (m.id === currentId ? { ...m, name } : m)) });
        saveCurrent();
      },

      removeSession: async () => {
        const { currentId, sessions } = get();
        if (!currentId) return;
        scheduleSave.cancel();
        await idb.deleteSession(currentId);

        const rest = sessions.filter((m) => m.id !== currentId);
        const next = rest.length > 0 ? await idb.getSession(rest[rest.length - 1]!.id) : undefined;
        if (next) {
          set({ sessions: rest, currentId: next.id, nodes: next.nodes });
        } else {
          const session = newSession();
          await idb.putSession(session);
          set({
            sessions: [...rest, toMeta(session)],
            currentId: session.id,
            nodes: [],
          });
        }
        localStorage.setItem(LAST_SESSION_KEY, get().currentId!);
        useBoardStore.temporal.getState().clear();
      },

      importSessionData: async (session) => {
        scheduleSave.flush();
        await idb.putSession(session);
        localStorage.setItem(LAST_SESSION_KEY, session.id);
        set({
          sessions: [...get().sessions, toMeta(session)],
          currentId: session.id,
          nodes: session.nodes,
        });
        useBoardStore.temporal.getState().clear();
      },

      resetAll: async () => {
        // 再読み込み前の flush や自動保存が消したデータを書き戻さないよう、
        // 保存経路を先にすべて塞ぐ。loaded=false で saveCurrent は無条件に no-op になる
        set({ loaded: false });
        scheduleSave.cancel();
        await idb.deleteDatabase();
        localStorage.removeItem(LAST_SESSION_KEY);
        localStorage.removeItem(THEME_KEY);
        localStorage.removeItem(NODE_WIDTHS_KEY);
        location.reload();
      },
    }),
    {
      partialize: (s) => ({ nodes: s.nodes }),
      equality: (past, cur) => past.nodes === cur.nodes,
      // ドラッグ中の連続更新で履歴が溢れないよう、記録を 500ms に 1 回へ間引く。
      // SAFETY: throttleLeading は受けた関数の引数をそのまま素通しするため、間引き後も
      // handleSet と同じシグネチャのまま。汎用の関数型を経由するための表明
      handleSet: (handleSet) =>
        throttleLeading(handleSet as (...args: unknown[]) => void, 500) as typeof handleSet,
    },
  ),
);

// 空スタックの幅を通常メモの現在の横幅設定から求める。通常メモ 1 枚が入った
// スタックと同じ見た目の幅にするためのもの。設定が無ければ既定幅で計算する
function emptyStackWidth(): number {
  const { nodeWidths } = useBoardStore.getState();
  return stackEmptyWidth(nodeWidths.sticky ?? DEFAULT_NODE_WIDTHS.sticky);
}

// 現在のセッションを state から丸ごと組み立てて即座に IDB へ保存する。未ロード時は何もしない。
function saveCurrent() {
  const s = useBoardStore.getState();
  if (!s.loaded || !s.currentId) return;
  const meta = s.sessions.find((m) => m.id === s.currentId);
  if (!meta) return;
  const updatedAt = Date.now();
  useBoardStore.setState({
    sessions: s.sessions.map((m) => (m === meta ? { ...m, updatedAt } : m)),
  });
  void idb.putSession({ ...meta, updatedAt, nodes: s.nodes });
}

const scheduleSave = debounce(saveCurrent, 500);

// nodes の変更を自動保存につなぐ。Undo/Redo による変更も対象になる
useBoardStore.subscribe((state, prev) => {
  if (!state.loaded) return;
  if (state.nodes !== prev.nodes) scheduleSave();
});

window.addEventListener("beforeunload", () => scheduleSave.flush());
