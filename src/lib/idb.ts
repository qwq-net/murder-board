import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Session, SessionMeta } from '@/types/board';

interface MemoDb extends DBSchema {
  sessions: { key: string; value: Session };
}

let dbPromise: Promise<IDBPDatabase<MemoDb>> | undefined;

function getDb() {
  dbPromise ??= openDB<MemoDb>('murder-memo2', 1, {
    upgrade(db) {
      db.createObjectStore('sessions', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

// 全セッションのメタ情報を作成日時の昇順で返す（nodes/edges は含まない）。
export async function listSessionMetas(): Promise<SessionMeta[]> {
  const all = await (await getDb()).getAll('sessions');
  return all
    .map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

// 見つからなければ undefined を返す。
export async function getSession(id: string): Promise<Session | undefined> {
  return (await getDb()).get('sessions', id);
}

// 同一 id は上書き。
export async function putSession(session: Session): Promise<void> {
  await (await getDb()).put('sessions', session);
}

export async function deleteSession(id: string): Promise<void> {
  await (await getDb()).delete('sessions', id);
}
