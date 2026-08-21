import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Session, SessionMeta } from "@/types/board";

interface MemoDb extends DBSchema {
  sessions: { key: string; value: Session };
}

const DB_NAME = "murder-memo2";

let dbPromise: Promise<IDBPDatabase<MemoDb>> | undefined;

function getDb() {
  dbPromise ??= openDB<MemoDb>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore("sessions", { keyPath: "id" });
    },
  });
  return dbPromise;
}

// 接続を閉じてデータベースを丸ごと削除する。以後この接続では読み書きできないため、
// 呼び手はページを再読み込みして初期化し直す前提。完全リセットからのみ呼ばれる。
export async function deleteDatabase(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = undefined;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("deleteDatabase failed"));
  });
}

// 全セッションのメタ情報を作成日時の昇順で返す。nodes は含まない。
export async function listSessionMetas(): Promise<SessionMeta[]> {
  const all = await (await getDb()).getAll("sessions");
  return all
    .map(({ nodes: _nodes, ...meta }) => {
      // SAFETY: 機能の廃止前に保存されたレコードに残る edges を落とすだけの表明。
      // ここで落とさないと、メタ経由の再保存で廃止済みデータが残り続ける
      delete (meta as { edges?: unknown }).edges;
      return meta;
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

// 見つからなければ undefined を返す。
export async function getSession(id: string): Promise<Session | undefined> {
  return (await getDb()).get("sessions", id);
}

// 同一 id は上書き。
export async function putSession(session: Session): Promise<void> {
  await (await getDb()).put("sessions", session);
}

export async function deleteSession(id: string): Promise<void> {
  await (await getDb()).delete("sessions", id);
}
