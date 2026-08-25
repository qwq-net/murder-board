import { useReactFlow } from "@xyflow/react";
import { ClipboardPaste, Copy, CopyPlus, Trash2, Ungroup, type LucideIcon } from "lucide-react";
import { KIND_ICONS } from "@/components/nodes/nodeMeta";
import { duplicateSelection, materializeNodes, snapshotSelection } from "@/lib/nodeClipboard";
import { useBoardStore } from "@/store";
import { NODE_KIND_LABELS, type BoardNode, type BoardNodeKind } from "@/types/board";

// 右クリックメニューの表示位置。画面座標で、nodeId があればノード用メニュー、
// 無ければペイン用の追加メニューになる
export type MenuState = { x: number; y: number; nodeId?: string };

// 右クリックメニューの並び。役割の近さでグループ化し、グループ間に区切り線を挟む。
// 「単体メモとその入れ物 / 行を積む記録系 / 他ノードの装飾に効く登録系」の 3 グループ
const MENU_GROUPS: BoardNodeKind[][] = [
  ["sticky", "stack"],
  ["list", "timeline", "actionlog"],
  ["character", "keyword"],
];

// コンテキストメニューの 1 項目。アイコン + ラベルの横並びで、danger は削除系の赤文字
function MenuItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-bg-hover ${
        danger ? "text-danger" : ""
      }`}
      onClick={onClick}
    >
      <Icon size={14} className="shrink-0 opacity-70" />
      {label}
    </button>
  );
}

// 盤面の右クリックメニュー。menu.nodeId の有無でペイン用（ノード追加 + 貼り付け）と
// ノード用（コピー・複製・スタック解除・削除）を出し分ける。項目の実行後は onClose を呼ぶ。
// ノード用のコピー・複製・削除は、対象ノードが選択中なら選択ノード全体に効き、
// ラベルにも件数が付く。Board 側が開く前に選択状態を整えている前提。
// 貼り付けはメニューを開いた位置へ行い、clipboard が null なら項目自体を出さない。
// 複製は元の位置から少し右下へずらして置く。
// nodeId が既に消えたノードを指すときは何も描画しない。
// 使われ方: Board が menu の開閉状態を持ち、開いているときだけ描画する前提。
// ReactFlowProvider 配下でしか使えない。
export function BoardMenu({
  menu,
  clipboard,
  setClipboard,
  onClose,
}: {
  menu: MenuState;
  clipboard: BoardNode[] | null;
  setClipboard: (nodes: BoardNode[]) => void;
  onClose: () => void;
}) {
  const nodes = useBoardStore((s) => s.nodes);
  const addNode = useBoardStore((s) => s.addNode);
  const addNodes = useBoardStore((s) => s.addNodes);
  const dissolveStack = useBoardStore((s) => s.dissolveStack);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const { screenToFlowPosition } = useReactFlow();

  const addFromMenu = (kind: BoardNodeKind) => {
    addNode(kind, screenToFlowPosition(menu));
    onClose();
  };

  const pasteFromMenu = () => {
    if (!clipboard) return;
    addNodes(materializeNodes(clipboard, screenToFlowPosition(menu)));
    onClose();
  };

  const copyFromMenu = (ids: string[]) => {
    setClipboard(snapshotSelection(nodes, new Set(ids)));
    onClose();
  };

  const duplicateFromMenu = (ids: string[]) => {
    const dup = duplicateSelection(nodes, new Set(ids));
    if (dup) addNodes(dup.nodes, dup.label);
    onClose();
  };

  const deleteFromMenu = (ids: string[]) => {
    onNodesChange(ids.map((id) => ({ type: "remove" as const, id })));
    onClose();
  };

  const dissolveFromMenu = (nodeId: string) => {
    dissolveStack(nodeId);
    onClose();
  };

  // メニューの対象ノード。nodeId が残っていてもノードが消えていれば null 扱い
  const menuTarget =
    menu.nodeId !== undefined ? nodes.find((n) => n.id === menu.nodeId) : undefined;

  // ノード用メニューが作用する対象。対象ノードが選択中なら選択全体、そうでなければ単体
  const targetIds =
    menuTarget?.selected === true
      ? nodes.filter((n) => n.selected).map((n) => n.id)
      : menuTarget
        ? [menuTarget.id]
        : [];
  // 件数付きのラベル。単体のときは件数を出さない
  const countLabel = (action: string) =>
    targetIds.length > 1 ? `${targetIds.length}件を${action}` : action;

  return (
    <div
      className="fixed z-50 min-w-40 rounded border border-border-default bg-bg-elevated py-1 shadow-lg"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.nodeId === undefined ? (
        <>
          {clipboard !== null && (
            <>
              <MenuItem icon={ClipboardPaste} label="貼り付け" onClick={pasteFromMenu} />
              <div className="my-1 border-t border-border-subtle" />
            </>
          )}
          {MENU_GROUPS.map((group, gi) => (
            <div key={group[0]}>
              {gi > 0 && <div className="my-1 border-t border-border-subtle" />}
              {group.map((kind) => (
                <MenuItem
                  key={kind}
                  icon={KIND_ICONS[kind]}
                  label={NODE_KIND_LABELS[kind]}
                  onClick={() => addFromMenu(kind)}
                />
              ))}
            </div>
          ))}
        </>
      ) : (
        menuTarget && (
          <>
            <MenuItem
              icon={Copy}
              label={countLabel("コピー")}
              onClick={() => copyFromMenu(targetIds)}
            />
            <MenuItem
              icon={CopyPlus}
              label={countLabel("複製")}
              onClick={() => duplicateFromMenu(targetIds)}
            />
            {menuTarget.type === "stack" && (
              <MenuItem
                icon={Ungroup}
                label="スタックを解除"
                onClick={() => dissolveFromMenu(menuTarget.id)}
              />
            )}
            <div className="my-1 border-t border-border-subtle" />
            <MenuItem
              icon={Trash2}
              label={countLabel("削除")}
              danger
              onClick={() => deleteFromMenu(targetIds)}
            />
          </>
        )
      )}
    </div>
  );
}
