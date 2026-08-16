import { nanoid } from 'nanoid';
import { STICKY_COLORS, type BoardEdge, type BoardNode, type Session } from '@/types/board';

export const EXPORT_APP = 'murder-memo2';
export const EXPORT_VERSION = 1;

// セッションをエクスポート用 JSON 文字列（整形済み）にする。
export function serializeExport(session: Session): string {
  return JSON.stringify({ app: EXPORT_APP, version: EXPORT_VERSION, session }, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// エクスポート JSON を検証し、全 ID を再採番した新しい Session を返す。
// - JSON 不正・app/version 不一致・セッション/ノードの必須フィールド欠落は Error を throw
// - node/edge の ID はすべて再採番し、edge の source/target も追随させる
// - 存在しないノードを参照する edge、形の壊れた edge は黙って捨てる
// - 未知の色は 'yellow' に落とし、未知のフィールドは保持しない
// - createdAt/updatedAt は now で上書きする（インポート時点を新規作成として扱う）
// 使われ方: ファイル入力（信頼境界）から呼ばれる。失敗は throw で伝え、呼び手が通知を出す。
export function parseImport(json: string, now = Date.now()): Session {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('JSON として読み込めませんでした');
  }
  if (!isRecord(raw) || raw.app !== EXPORT_APP || raw.version !== EXPORT_VERSION) {
    throw new Error('murder-memo2 のエクスポートファイルではありません');
  }
  const s = raw.session;
  if (!isRecord(s) || typeof s.name !== 'string' || !Array.isArray(s.nodes) || !Array.isArray(s.edges)) {
    throw new Error('セッションデータが壊れています');
  }

  const idMap = new Map<string, string>();
  const nodes: BoardNode[] = s.nodes.map((n: unknown) => {
    if (
      !isRecord(n) ||
      typeof n.id !== 'string' ||
      !isRecord(n.position) ||
      typeof n.position.x !== 'number' ||
      typeof n.position.y !== 'number'
    ) {
      throw new Error('ノードデータが壊れています');
    }
    const data = isRecord(n.data) ? n.data : {};
    const newId = nanoid();
    idMap.set(n.id, newId);
    return {
      id: newId,
      type: 'sticky' as const,
      position: { x: n.position.x, y: n.position.y },
      data: {
        text: typeof data.text === 'string' ? data.text : '',
        color: STICKY_COLORS.find((c) => c === data.color) ?? 'yellow',
      },
    };
  });

  const edges: BoardEdge[] = [];
  for (const e of s.edges as unknown[]) {
    if (!isRecord(e) || typeof e.source !== 'string' || typeof e.target !== 'string') continue;
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    if (!source || !target) continue;
    edges.push({
      id: nanoid(),
      source,
      target,
      ...(typeof e.sourceHandle === 'string' ? { sourceHandle: e.sourceHandle } : {}),
      ...(typeof e.targetHandle === 'string' ? { targetHandle: e.targetHandle } : {}),
      ...(typeof e.label === 'string' && e.label !== '' ? { label: e.label } : {}),
    });
  }

  return { id: nanoid(), name: s.name, createdAt: now, updatedAt: now, nodes, edges };
}
