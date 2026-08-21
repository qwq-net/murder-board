import type { Node } from "@xyflow/react";

// この並びは色相が隣り合わないように組んである。登場人物メモの行追加が
// この並び順で色を循環させるため、隣の行と紛らわしい色が続かない
export const STICKY_COLORS = [
  "yellow",
  "pink",
  "blue",
  "green",
  "orange",
  "indigo",
  "teal",
  "red",
  "olive",
  "purple",
  "gray",
] as const;
export type StickyColor = (typeof STICKY_COLORS)[number];

// 色パレットの表示用の並び。STICKY_COLORS と同じ 11 色を色相環の順に並べ替えたもので、
// 末尾に無彩色を置く。循環用の STICKY_COLORS とは並びの役割が違う
export const STICKY_COLORS_BY_HUE: readonly StickyColor[] = [
  "red",
  "orange",
  "yellow",
  "olive",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
  "gray",
];

// 付箋ノードの中身。title/text は空文字を許す。作成直後は空で、付箋側が自動的に編集状態になる。
// color 未設定は種別既定色で描画される
export type StickyData = { title: string; text: string; color?: StickyColor };

// タイムラインの 1 行。time は "HH:MM" を想定するが自由入力を許し、不正な時刻の行は末尾に並ぶ。
// color は付箋と同じ 6 色で、未設定なら種別既定のアクセント色で描画される
export type TimelineEntry = { id: string; time: string; text: string };
export type TimelineData = { title: string; entries: TimelineEntry[]; color?: StickyColor };

// リストメモの 1 行。text は作成直後の空行のような空文字を許す。並び順は登録順のまま。
// color の意味はタイムラインと同じ
export type ListEntry = { id: string; text: string };
export type ListData = { title: string; entries: ListEntry[]; color?: StickyColor };

// キーワードメモ。行の形も操作もリストメモと同じだが、登録された言葉は
// 他ノードの本文中で完全一致の検索リンクに置き換わる
export type KeywordData = { title: string; entries: ListEntry[]; color?: StickyColor };

// 登場人物メモの 1 行。color がその人物の識別色で、付箋と同じ 6 色を使う
export type CharacterEntry = { id: string; text: string; color: StickyColor };
export type CharacterData = { title: string; entries: CharacterEntry[] };

// アクションログの 1 行。「from ▶ to」の 2 人と自由記述メモを持つ。
// from/to は登場人物の名前をそのまま持ち、識別色・略称の解決は表示時に名前で行う。
// 未選択は空文字。登場人物メモから消えた名前も行にはそのまま残る
export type ActionEntry = { id: string; from: string; to: string; text: string };
export type ActionLogData = { title: string; entries: ActionEntry[]; color?: StickyColor };

// スタックノードの中身。本文を持たず、タイトルだけを持つ入れ物。
// 子ノードは parentId で所属し、順番は子の相対 y 座標の昇順そのもので表す。
// color の意味はタイムラインと同じで、未設定なら無彩色の既定枠になる
export type StackData = { title: string; color?: StickyColor };

export type StickyNodeType = Node<StickyData, "sticky">;
export type TimelineNodeType = Node<TimelineData, "timeline">;
export type ListNodeType = Node<ListData, "list">;
export type KeywordNodeType = Node<KeywordData, "keyword">;
export type CharacterNodeType = Node<CharacterData, "character">;
export type ActionLogNodeType = Node<ActionLogData, "actionlog">;
export type StackNodeType = Node<StackData, "stack">;
export type BoardNode =
  | StickyNodeType
  | TimelineNodeType
  | ListNodeType
  | KeywordNodeType
  | CharacterNodeType
  | ActionLogNodeType
  | StackNodeType;
export type BoardNodeKind = NonNullable<BoardNode["type"]>;

// 種別ごとの既定カラー。新規作成時に色を持つ種別（通常メモ・登場人物の行）が参照する。
// パネル系の未設定時の描画は index.css の識別色変数が担うため、ここは同じ色相の
// パレット色を対応させた一覧という位置づけ。有彩色は種別間で被らないように割り当て、
// 無彩色だけは通常メモとスタックで共用する
export const DEFAULT_NODE_COLORS = {
  sticky: "gray",
  stack: "gray",
  list: "blue",
  timeline: "purple",
  actionlog: "orange",
  character: "green",
  keyword: "yellow",
} satisfies Record<BoardNodeKind, StickyColor>;

// ノード種別の表示名。キーの並びが検索結果グループの表示順を兼ねる。
// 右クリックメニューの並びと区切りは Board の MENU_GROUPS が別途持つ
export const NODE_KIND_LABELS = {
  sticky: "通常メモ",
  stack: "メモスタック",
  list: "リスト",
  timeline: "タイムライン",
  actionlog: "行動ログ",
  character: "登場人物",
  keyword: "キーワード",
} satisfies Record<BoardNodeKind, string>;
// 1 セッション = IndexedDB の 1 レコード。nodes を正規化せず丸ごと持つ。
// isDemo は自動生成されるデモセッションの印。demoVersion が DEMO_VERSION と
// 一致しないデモは、起動時に最新の内容へ丸ごと置き換えられる
export type Session = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDemo?: boolean;
  demoVersion?: number;
  nodes: BoardNode[];
};

export type SessionMeta = Omit<Session, "nodes">;
