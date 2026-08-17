import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { temporal } from "zundo";
import { debounce, throttleLeading } from "@/lib/debounce";
import * as idb from "@/lib/idb";
import type { BoardEdge, BoardNode, BoardNodeKind, Session, SessionMeta } from "@/types/board";

const LAST_SESSION_KEY = "murder-memo2-last-session";

// ノード種別からその data 型を引く。updateNodeData の patch を種別ごとに型付けるために使う
type DataOf<K extends BoardNodeKind> = Extract<BoardNode, { type: K }>["data"];

type Store = {
  loaded: boolean;
  sessions: SessionMeta[];
  currentId: string | null;
  nodes: BoardNode[];
  edges: BoardEdge[];

  // IDB からセッション一覧を読み、前回のセッションを開く。前回のセッションが無ければ新規作成する。
  // 多重呼び出しは無視。
  init: () => Promise<void>;

  onNodesChange: (changes: NodeChange<BoardNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<BoardEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  // 指定位置に空のノードを追加する。position はフロー座標。sticky は作成直後に編集状態になり、
  // timeline / list は空行 1 つ付きで作られる。
  addNode: (kind: BoardNodeKind, position: { x: number; y: number }) => void;
  // 指定 id かつ指定種別のノードの data を部分更新する。id が存在しても種別が一致しなければ何もしない。
  updateNodeData: <K extends BoardNodeKind>(id: string, type: K, patch: Partial<DataOf<K>>) => void;
  updateEdgeLabel: (id: string, label: string) => void;

  createSession: () => Promise<void>;
  // 未保存の変更を flush してから切り替える。切替後は Undo 履歴をクリアする。
  switchSession: (id: string) => Promise<void>;
  // 現在のセッションをリネームして即保存する。
  renameSession: (name: string) => void;
  // 現在のセッションを削除する。残りが無ければ新規セッションを作って開く。
  removeSession: () => Promise<void>;
  // parseImport 済みのセッションを保存して開く。バリデーションは呼び手側で済んでいる前提。
  importSessionData: (session: Session) => Promise<void>;
};

function newSession(): Session {
  const now = Date.now();
  return {
    id: nanoid(),
    name: "新しいセッション",
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
  };
}

function toMeta({ id, name, createdAt, updatedAt }: Session): SessionMeta {
  return { id, name, createdAt, updatedAt };
}

let initStarted = false;

export const useBoardStore = create<Store>()(
  temporal(
    (set, get) => ({
      loaded: false,
      sessions: [],
      currentId: null,
      nodes: [],
      edges: [],

      init: async () => {
        if (initStarted) return;
        initStarted = true;

        let metas = await idb.listSessionMetas();
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
          edges: session.edges,
        });
        useBoardStore.temporal.getState().clear();
      },

      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
      onConnect: (connection) =>
        set({ edges: addEdge({ ...connection, id: nanoid() }, get().edges) }),

      addNode: (kind, position) => {
        const node: BoardNode =
          kind === "sticky"
            ? {
                id: nanoid(),
                type: "sticky",
                position,
                data: { title: "", text: "", color: "yellow" },
              }
            : kind === "timeline"
              ? {
                  id: nanoid(),
                  type: "timeline",
                  position,
                  data: { title: "", entries: [{ id: nanoid(), time: "", text: "" }] },
                }
              : {
                  id: nanoid(),
                  type: "list",
                  position,
                  data: { title: "", entries: [{ id: nanoid(), text: "" }] },
                };
        set({ nodes: [...get().nodes, node] });
      },

      updateNodeData: (id, type, patch) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === id && n.type === type
              ? ({ ...n, data: { ...n.data, ...patch } } as BoardNode)
              : n,
          ),
        }),

      updateEdgeLabel: (id, label) =>
        set({ edges: get().edges.map((e) => (e.id === id ? { ...e, label } : e)) }),

      createSession: async () => {
        scheduleSave.flush();
        const session = newSession();
        await idb.putSession(session);
        localStorage.setItem(LAST_SESSION_KEY, session.id);
        set({
          sessions: [...get().sessions, toMeta(session)],
          currentId: session.id,
          nodes: [],
          edges: [],
        });
        useBoardStore.temporal.getState().clear();
      },

      switchSession: async (id) => {
        if (id === get().currentId) return;
        scheduleSave.flush();
        const session = await idb.getSession(id);
        if (!session) return;
        localStorage.setItem(LAST_SESSION_KEY, id);
        set({ currentId: id, nodes: session.nodes, edges: session.edges });
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
          set({ sessions: rest, currentId: next.id, nodes: next.nodes, edges: next.edges });
        } else {
          const session = newSession();
          await idb.putSession(session);
          set({
            sessions: [...rest, toMeta(session)],
            currentId: session.id,
            nodes: [],
            edges: [],
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
          edges: session.edges,
        });
        useBoardStore.temporal.getState().clear();
      },
    }),
    {
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges }),
      equality: (past, cur) => past.nodes === cur.nodes && past.edges === cur.edges,
      // ドラッグ中の連続更新で履歴が溢れないよう、記録を 500ms に 1 回へ間引く
      handleSet: (handleSet) =>
        throttleLeading(handleSet as (...args: unknown[]) => void, 500) as typeof handleSet,
    },
  ),
);

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
  void idb.putSession({ ...meta, updatedAt, nodes: s.nodes, edges: s.edges });
}

const scheduleSave = debounce(saveCurrent, 500);

// nodes/edges の変更を自動保存につなぐ。Undo/Redo による変更も対象になる
useBoardStore.subscribe((state, prev) => {
  if (!state.loaded) return;
  if (state.nodes !== prev.nodes || state.edges !== prev.edges) scheduleSave();
});

window.addEventListener("beforeunload", () => scheduleSave.flush());
