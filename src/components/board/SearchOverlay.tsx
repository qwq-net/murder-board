import { useReactFlow } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import {
  buildSnippetSegments,
  highlightSegments,
  searchNodes,
  tokenizeQuery,
  type HighlightSegment,
} from "@/lib/nodeSearch";
import { useBoardStore } from "@/store";
import { NODE_KIND_LABELS, type BoardNode, type BoardNodeKind } from "@/types/board";

const MAX_RESULTS = 50;
const DEBOUNCE_MS = 150;

// 種別グループヘッダー・結果行のアクセント色。sticky はノードごとに色が違うためブランド色で代表する
const KIND_ACCENT = {
  sticky: "var(--color-accent)",
  timeline: "var(--color-panel-timeline-accent)",
  list: "var(--color-panel-list-accent)",
  keyword: "var(--color-panel-keyword-accent)",
  character: "var(--color-panel-character-accent)",
  actionlog: "var(--color-panel-actionlog-accent)",
  stack: "var(--color-text-muted)",
} satisfies Record<BoardNodeKind, string>;

// SAFETY: NODE_KIND_LABELS のキーは BoardNodeKind の全種別。Object.keys が
// string[] へ落とすのを戻すだけの表明
const KIND_ORDER = Object.keys(NODE_KIND_LABELS) as BoardNodeKind[];

// セグメント列を mark 混じりのテキストに描画する
function Segments({ segments }: { segments: HighlightSegment[] }) {
  return segments.map((seg, i) =>
    seg.highlighted ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>,
  );
}

// 検索パレット。マウント時に入力欄へフォーカスし、Escape・背景クリックで onClose を呼ぶ。
// 結果クリックで対象ノードだけを選択状態にし、fitView でその位置へパンして閉じる。
// 開閉のたびにマウントし直す前提で、閉じれば入力値は消える。
// initialQuery は開いた時点の検索欄の値。本文中の検索リンクからの起動が文言を渡してくる。
// マウント時にだけ効き、デバウンスを挟まず即座に結果が出る。
export function SearchOverlay({
  initialQuery = "",
  onClose,
}: {
  initialQuery?: string;
  onClose: () => void;
}) {
  const nodes = useBoardStore((s) => s.nodes);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const { fitView } = useReactFlow();

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const grouped = useMemo(
    () => searchNodes(debouncedQuery, nodes, KIND_ORDER, MAX_RESULTS),
    [debouncedQuery, nodes],
  );
  const terms = useMemo(() => tokenizeQuery(debouncedQuery), [debouncedQuery]);
  const totalCount = grouped.reduce((sum, g) => sum + g.matches.length, 0);

  const selectNode = (node: BoardNode) => {
    onClose();
    onNodesChange(
      nodes
        .filter((n) => n.selected || n.id === node.id)
        .map((n) => ({ id: n.id, type: "select", selected: n.id === node.id })),
    );
    void fitView({ nodes: [{ id: node.id }], duration: 300, maxZoom: 1 });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose} />
      <div
        className="fixed top-12 left-1/2 z-50 -translate-x-1/2"
        style={{ animation: "search-in 0.15s ease-out" }}
      >
        <div
          className="flex flex-col rounded-md border border-border-default bg-bg-elevated shadow-lg"
          style={{ width: "min(520px, calc(100vw - 24px))", maxHeight: "calc(100vh - 72px)" }}
        >
          {/* 入力欄 */}
          <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              className="shrink-0 text-text-muted"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <line
                x1="16.5"
                y1="16.5"
                x2="21"
                y2="21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="メモを検索…"
              autoComplete="off"
              autoFocus
              className="flex-1 border-none bg-transparent text-sm text-text-primary outline-none placeholder:text-text-faint"
            />
            {query && (
              <button
                type="button"
                aria-label="クリア"
                className="shrink-0 cursor-pointer px-1 text-text-muted hover:text-text-primary"
                onClick={() => setQuery("")}
              >
                ×
              </button>
            )}
          </div>

          {/* 結果エリア */}
          <div className="overflow-y-auto" style={{ maxHeight: "min(60vh, 480px)" }}>
            {!!debouncedQuery && totalCount === 0 && (
              <div className="px-3 py-6 text-center text-sm text-text-muted">
                該当するメモが見つかりません
              </div>
            )}
            {grouped.map((group) => (
              <div key={group.kind}>
                {/* 種別グループヘッダー */}
                <div
                  className="sticky top-0 z-10 flex items-center gap-2 border-b border-border-subtle bg-bg-elevated px-3 py-1.5 text-[11px] font-semibold tracking-[0.06em]"
                  style={{ color: KIND_ACCENT[group.kind] }}
                >
                  <span
                    className="inline-block size-1.5 rounded-full opacity-70"
                    style={{ background: KIND_ACCENT[group.kind] }}
                  />
                  {NODE_KIND_LABELS[group.kind]}
                  <span className="ml-1 font-normal text-text-muted">{group.matches.length}件</span>
                </div>

                {/* 結果一覧 */}
                {group.matches.map(({ node, title, body }) => (
                  <button
                    key={node.id}
                    type="button"
                    className="flex w-full cursor-pointer items-start gap-2 border-none bg-transparent px-3 py-2 text-left hover:bg-bg-hover"
                    onClick={() => selectNode(node)}
                  >
                    <div
                      className="w-[3px] shrink-0 self-stretch rounded-sm opacity-60"
                      style={{ background: KIND_ACCENT[node.type] }}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-bold text-text-primary">
                        {title ? (
                          <Segments segments={highlightSegments(title, terms)} />
                        ) : (
                          <span className="text-text-muted">無題</span>
                        )}
                      </span>
                      {body && (
                        <span className="text-sm leading-[1.6] break-all whitespace-pre-wrap text-text-secondary">
                          <Segments segments={buildSnippetSegments(body, terms)} />
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* フッター: 結果件数 */}
          {totalCount > 0 && (
            <div className="border-t border-border-subtle px-3 py-1.5 text-[11px] text-text-muted">
              {totalCount}件の結果
              {totalCount >= MAX_RESULTS && "（上限）"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
