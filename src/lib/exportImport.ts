import { nanoid } from "nanoid";
import { z } from "zod";
import { STACK_EMPTY_H, STACK_EMPTY_W } from "@/lib/stackLayout";
import { STICKY_COLORS, type BoardEdge, type BoardNode, type Session } from "@/types/board";

export const EXPORT_APP = "murder-memo2";
export const EXPORT_VERSION = 1;

// セッションをエクスポート用の整形済み JSON 文字列にする。
export function serializeExport(session: Session): string {
  return JSON.stringify({ app: EXPORT_APP, version: EXPORT_VERSION, session }, null, 2);
}

// エクスポートファイルの外枠。app/version が一致しなければ別アプリのファイルとして扱う
const envelopeSchema = z.object({
  app: z.literal(EXPORT_APP),
  version: z.literal(EXPORT_VERSION),
  session: z.unknown(),
});

const sessionSchema = z.object({
  name: z.string(),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
});

// ノードの必須部分だけを検証する。type と data は種別ごとに後段で解釈する
const nodeSchema = z.object({
  id: z.string(),
  type: z.unknown(),
  position: z.object({ x: z.number(), y: z.number() }),
  parentId: z.string().optional().catch(undefined),
  width: z.number().optional().catch(undefined),
  height: z.number().optional().catch(undefined),
  data: z.unknown(),
});

// data 系スキーマはフィールド単位でも全体でも catch で既定値に落とし、決して throw しない。
// 壊れたフィールドだけを黙って既定値へ置き換える方針のため
const timelineRowSchema = z.object({
  time: z.string().catch(""),
  text: z.string().catch(""),
});

// ノード単位の色は任意フィールド。未知の値は「色未設定 = 種別既定色」へ落とす
const nodeColorSchema = z.enum(STICKY_COLORS).optional().catch(undefined);

const timelineDataSchema = z
  .object({
    title: z.string().catch(""),
    entries: z.array(z.unknown()).catch([]),
    color: nodeColorSchema,
  })
  .catch({ title: "", entries: [] });

const listRowSchema = z.object({ text: z.string().catch("") });

const listDataSchema = z
  .object({
    title: z.string().catch(""),
    entries: z.array(z.unknown()).catch([]),
    color: nodeColorSchema,
  })
  .catch({ title: "", entries: [] });

const characterRowSchema = z.object({
  text: z.string().catch(""),
  color: z.enum(STICKY_COLORS).catch("yellow"),
});

const characterDataSchema = z
  .object({
    title: z.string().catch(""),
    entries: z.array(z.unknown()).catch([]),
  })
  .catch({ title: "", entries: [] });

const stickyDataSchema = z
  .object({
    title: z.string().catch(""),
    text: z.string().catch(""),
    color: z.enum(STICKY_COLORS).catch("yellow"),
  })
  .catch({ title: "", text: "", color: "yellow" });

const stackDataSchema = z
  .object({ title: z.string().catch(""), color: nodeColorSchema })
  .catch({ title: "" });

const edgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional().catch(undefined),
  targetHandle: z.string().optional().catch(undefined),
});

// エクスポート JSON を検証し、全 ID を再採番した新しい Session を返す。
// - JSON 不正・app/version 不一致・セッション/ノードの必須フィールド欠落は Error を throw
// - node/edge の ID はすべて再採番し、edge の source/target も追随させる
// - 存在しないノードを参照する edge、形の壊れた edge は黙って捨てる
// - 未知の色は、必須の色（付箋・登場人物の行）は 'yellow'、任意のノード色は未設定に落とす。
//   未知のフィールドは保持しない
// - createdAt/updatedAt は now で上書きし、インポート時点を新規作成として扱う
// 使われ方: 信頼境界であるファイル入力から呼ばれる。失敗は throw で伝え、呼び手が通知を出す。
export function parseImport(json: string, now = Date.now()): Session {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("JSON として読み込めませんでした");
  }
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) {
    throw new Error("murder-memo2 のエクスポートファイルではありません");
  }
  const session = sessionSchema.safeParse(envelope.data.session);
  if (!session.success) {
    throw new Error("セッションデータが壊れています");
  }

  // パス 1: 必須フィールドの検証と新 ID の採番。parentId の解決には全ノードの
  // 新 ID と種別が必要なため、data の解釈より先に全件を済ませる
  const parsedNodes = session.data.nodes.map((value) => {
    const parsed = nodeSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error("ノードデータが壊れています");
    }
    return parsed.data;
  });
  const idMap = new Map<string, string>();
  const typeMap = new Map<string, unknown>();
  for (const n of parsedNodes) {
    idMap.set(n.id, nanoid());
    typeMap.set(n.id, n.type);
  }

  // パス 2: data の種別ごとの解釈。parentId はスタックを指すときだけ新 ID で引き継ぎ、
  // 存在しない親やスタック以外を指すものは捨ててトップレベルのノードとして残す
  const nodes: BoardNode[] = parsedNodes.map(
    ({ id, type, position, parentId, width, height, data }) => {
      const newId = idMap.get(id)!;
      const newParentId =
        parentId !== undefined && typeMap.get(parentId) === "stack"
          ? idMap.get(parentId)
          : undefined;
      const base =
        newParentId !== undefined
          ? { id: newId, position, parentId: newParentId }
          : { id: newId, position };

      if (type === "timeline") {
        const { title, entries, color } = timelineDataSchema.parse(data);
        const rows = entries.flatMap((row) => {
          const r = timelineRowSchema.safeParse(row);
          return r.success ? [{ id: nanoid(), ...r.data }] : [];
        });
        return { ...base, type: "timeline" as const, data: { title, entries: rows, color } };
      }

      if (type === "list") {
        const { title, entries, color } = listDataSchema.parse(data);
        const rows = entries.flatMap((row) => {
          const r = listRowSchema.safeParse(row);
          return r.success ? [{ id: nanoid(), text: r.data.text }] : [];
        });
        return { ...base, type: "list" as const, data: { title, entries: rows, color } };
      }

      if (type === "character") {
        const { title, entries } = characterDataSchema.parse(data);
        const rows = entries.flatMap((row) => {
          const r = characterRowSchema.safeParse(row);
          return r.success ? [{ id: nanoid(), ...r.data }] : [];
        });
        return { ...base, type: "character" as const, data: { title, entries: rows } };
      }

      if (type === "stack") {
        return {
          ...base,
          type: "stack" as const,
          width: width ?? STACK_EMPTY_W,
          height: height ?? STACK_EMPTY_H,
          data: stackDataSchema.parse(data),
        };
      }

      // 未知の type は付箋として救出する。黙って捨てると edge の参照ごと消えるため
      return { ...base, type: "sticky" as const, data: stickyDataSchema.parse(data) };
    },
  );

  // React Flow の「親は子より配列で前」の制約を、スタックを前へ寄せる安定パーティションで満たす
  const orderedNodes = [
    ...nodes.filter((n) => n.type === "stack"),
    ...nodes.filter((n) => n.type !== "stack"),
  ];

  const edges: BoardEdge[] = [];
  for (const value of session.data.edges) {
    const parsed = edgeSchema.safeParse(value);
    if (!parsed.success) continue;
    const source = idMap.get(parsed.data.source);
    const target = idMap.get(parsed.data.target);
    if (!source || !target) continue;
    const edge: BoardEdge = { id: nanoid(), source, target };
    if (parsed.data.sourceHandle !== undefined) edge.sourceHandle = parsed.data.sourceHandle;
    if (parsed.data.targetHandle !== undefined) edge.targetHandle = parsed.data.targetHandle;
    edges.push(edge);
  }

  return {
    id: nanoid(),
    name: session.data.name,
    createdAt: now,
    updatedAt: now,
    nodes: orderedNodes,
    edges,
  };
}
