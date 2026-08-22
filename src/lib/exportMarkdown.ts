import { nodeBody } from "@/lib/nodeSearch";
import { NODE_KIND_LABELS, type BoardNode } from "@/types/board";

// 1 ノードを Markdown の節にする。見出しは「種別ラベル: タイトル」で、無題ならラベルだけ。
// 付箋は本文をそのまま、行を持つ種別は空でない行だけを箇条書きにする。本文が空なら見出しのみ
function nodeSection(node: BoardNode, depth: number): string {
  const label = NODE_KIND_LABELS[node.type];
  const heading = `${"#".repeat(depth)} ${node.data.title ? `${label}: ${node.data.title}` : label}`;
  const body =
    node.type === "sticky"
      ? node.data.text.trim()
      : nodeBody(node)
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((line) => `- ${line}`)
          .join("\n");
  return body ? `${heading}\n\n${body}` : heading;
}

// セッションの全メモを 1 つの Markdown テキストにする。設定画面の「全メモをコピー」用。
// 先頭はセッション名の見出しで、以降はノード配列の順に 1 ノード 1 節。
// スタックは自身の節の直後に子を 1 段深い見出しで続け、並びは盤面の表示順と同じ
// 子の相対 y 座標の昇順にする。メモが 1 つも無ければセッション名の見出しだけを返す。
export function serializeMarkdown(name: string, nodes: BoardNode[]): string {
  const sections = [`# ${name}`];
  for (const node of nodes) {
    if (node.parentId !== undefined) continue;
    sections.push(nodeSection(node, 2));
    if (node.type === "stack") {
      const children = nodes
        .filter((c) => c.parentId === node.id)
        .sort((a, b) => a.position.y - b.position.y);
      sections.push(...children.map((c) => nodeSection(c, 3)));
    }
  }
  return sections.join("\n\n") + "\n";
}
