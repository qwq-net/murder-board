import { nanoid } from "nanoid";
import { STACK_EMPTY_H, STACK_EMPTY_W } from "@/lib/stackLayout";
import type {
  ActionEntry,
  BoardNode,
  CharacterEntry,
  ListEntry,
  Session,
  StickyColor,
  TimelineEntry,
} from "@/types/board";

// 行ヘルパ。デモデータの本体を「内容の列挙」に保つため、id の採番だけをここに寄せる
const tl = (time: string, text: string): TimelineEntry => ({ id: nanoid(), time, text });
const li = (text: string): ListEntry => ({ id: nanoid(), text });
const ch = (text: string, color: StickyColor): CharacterEntry => ({ id: nanoid(), text, color });
const ac = (from: string, to: string, text: string): ActionEntry => ({
  id: nanoid(),
  from,
  to,
  text,
});

// 機能説明メモ。無彩色の付箋で、各列の最上段や実サンプルの近くに置く
const guide = (x: number, y: number, title: string, text: string): BoardNode => ({
  id: nanoid(),
  type: "sticky",
  position: { x, y },
  data: { title, text, color: "gray" },
});

// デモの内容を変えたらこの数値を上げる。既存デモとの不一致を init が検知し、
// ユーザーの編集ごと最新の内容へ置き換える
export const DEMO_VERSION = 6;

// デモシナリオ「宇宙ステーション・整備士視点」のセッションを新規 ID で生成する。
// 全ノード種別・時刻なしタイムライン行を含む機能ショーケース。
// 配置は博物館形式のチュートリアル。機能ごとの列が横に並び、各列は y=0 の説明メモと
// y=150 から始まる実サンプルで構成される。列の x は「前列の右端 + 40」を目安に取る。
// 先頭列だけは操作説明のメモを縦に積む。
// isDemo と demoVersion が付くため、通常セッションと違い起動時の置き換え対象になる。
// 使われ方: ストアの init から、デモ不在またはバージョン不一致のときだけ呼ばれる前提。
export function buildDemoSession(): Session {
  const ids = {
    players: nanoid(),
    npcs: nanoid(),
    dayBefore: nanoid(),
    dayOf: nanoid(),
    points: nanoid(),
    theory: nanoid(),
    handout: nanoid(),
    goals: nanoid(),
    commander: nanoid(),
    operator: nanoid(),
    researcher: nanoid(),
    medic: nanoid(),
    keywords: nanoid(),
    actions: nanoid(),
    secretTalks: nanoid(),
    stack: nanoid(),
    stackMemo1: nanoid(),
    stackMemo2: nanoid(),
    emptyStack: nanoid(),
  };

  const nodes: BoardNode[] = [
    guide(
      0,
      0,
      "メモの追加方法",
      "各種メモは、右クリックをして出てくるメニューから追加することができます。",
    ),
    guide(
      0,
      120,
      "操作について",
      "各コンポーネントは左クリックまたは右クリックで選択でき、黄色の枠線が付きます。この状態でドラッグして位置を変えたり、右クリックからコピー・削除などが行えます。Ctrl+C、Ctrl+X、Ctrl+V のショートカットにも対応しています。",
    ),
    guide(
      0,
      330,
      "各コンポーネントの横幅",
      "横幅はコンポーネントの種別ごとに設定できます。調整したい場合は、右上の設定ボタンから変更してみてください。",
    ),
    guide(
      290,
      0,
      "登場人物設定機能",
      "このメモに登録すると、各メモで設定した色でハイライトされます。",
    ),
    guide(
      580,
      0,
      "キーワード機能",
      "このメモに登録すると、リンクとしてハイライトすることができます。リンクをクリックすると、自動で検索機能が開かれます。",
    ),
    guide(
      580,
      340,
      "検索機能",
      "キーワード登録によって表示されるリンクのほか、右上の検索ボタンや Ctrl+F でも検索を開けます。検索結果をクリックすると、対応したメモへ移動できます。",
    ),
    guide(
      870,
      0,
      "タイムライン機能",
      "時系列情報を整理するのに役立つメモです。時間の入力と、テキストの入力が分かれているのが特徴です。",
    ),
    guide(
      1570,
      0,
      "行動ログ機能",
      "登場人物設定機能と連携し、誰が・誰にといった行動ログをメモしやすい機能です。対象とテキストをセットで記録できます。",
    ),
    guide(
      1930,
      0,
      "リスト機能",
      "リスト形式のメモ機能です。連続した情報をメモしたい時などに役立つ機能です。",
    ),
    guide(
      3030,
      0,
      "通常メモ機能",
      "通常のメモです。単一の情報や、強調して残しておきたい情報に向いています。",
    ),
    guide(
      3320,
      0,
      "スタック機能",
      "通常メモをまとめられる機能です。メモが多くなってきたときの整理に役立ちます。",
    ),
    {
      id: ids.players,
      type: "character",
      position: { x: 290, y: 150 },
      data: {
        title: "プレイヤー",
        entries: [
          ch("ステーション長", "pink"),
          ch("研究員", "blue"),
          ch("医療班長", "green"),
          ch("整備士（自分）", "purple"),
          ch("通信士", "yellow"),
        ],
      },
    },
    {
      id: ids.npcs,
      type: "character",
      position: { x: 290, y: 370 },
      data: {
        title: "NPC",
        entries: [ch("被害者", "gray"), ch("補給船パイロット", "gray")],
      },
    },
    {
      id: ids.dayBefore,
      type: "timeline",
      position: { x: 870, y: 150 },
      data: {
        title: "前日",
        entries: [
          tl("14:00", "補給船がドッキング。パイロットと積荷の検品を開始"),
          tl("16:00", "研究員と被害者が実験室で口論。実験データの扱いを巡ってらしい"),
          tl("18:00", "夕食。被害者が「次の定期報告ですべて報告する」と宣言"),
          tl("19:30", "医療班長が被害者に睡眠導入剤を処方。不眠が続いていたとのこと"),
          tl("20:00", "酸素センサーが一時的に誤作動。自分が点検したが異常なし"),
          tl("21:00", "ステーション長と被害者が管制室で二人きりの面談。内容は不明"),
          tl("22:00", "通信士の証言：被害者が端末で長文の報告書を書いていた"),
          tl("23:00", "パイロットが貨物室に長時間こもっていた。「積荷の整理」と説明"),
          tl("深夜", "貨物室の方向で物音。当直の通信士は「何も聞いていない」"),
        ],
      },
    },
    {
      id: ids.dayOf,
      type: "timeline",
      position: { x: 1210, y: 150 },
      data: {
        title: "当日",
        entries: [
          tl("8:00", "朝のブリーフィング。被害者は疲れた様子だが出席"),
          tl("8:30", "通信士が外部通信を約30分遮断。「アンテナの保守」と説明"),
          tl("9:00", "研究員の証言：被害者が「報告書は送信済みだ」と話していた"),
          tl("10:00", "被害者がエアロック区画へ。「船外カメラの様子を見る」と"),
          tl("10:30", "医療班長の証言：廊下でふらつく被害者に声をかけた"),
          tl("11:00", "減圧警報。エアロック第2区画が開放状態に"),
          tl("11:02", "システムログはこの時刻に「手動開放」を記録"),
          tl("11:10", "ステーション長の指示で区画を封鎖。被害者の救助は間に合わず"),
          tl("11:30", "ステーション長がログの自動バックアップを停止するよう指示"),
          tl("12:00", "全員が管制室に集合。ステーション長が「事故」として報告すると宣言"),
        ],
      },
    },
    {
      id: ids.points,
      type: "list",
      position: { x: 2470, y: 150 },
      data: {
        title: "気になるポイント",
        entries: [
          li("エアロックの内側パネルは3日前から故障中 → 内側から開けられない"),
          li("ログの「手動開放」に対応する操作端末の記録が消されている"),
          li("被害者の端末に本部宛の報告書ドラフト。本当に送信済み？"),
          li("研究員には実験データ改ざんの疑惑。被害者と口論していた"),
          li("医療班長の睡眠導入剤の在庫が処方記録と合わない"),
          li("通信遮断の30分は本当にアンテナ保守だったのか"),
          li("パイロットの積荷リストに未申告のコンテナが1つ"),
          li("ステーション長は事故直後にログのバックアップを止めた。なぜ？"),
        ],
      },
    },
    {
      id: ids.theory,
      type: "list",
      position: { x: 2740, y: 150 },
      data: {
        title: "推理・仮説",
        entries: [
          li("内側パネルは故障中 → 開放は遠隔コマンドによるものでは"),
          li("遠隔開放ができるのは管制室の権限者 → ステーション長か通信士"),
          li("動機はデータ改ざんの隠蔽か、報告書に載る別の何かか"),
          li("ふらつき＝睡眠導入剤？ 昏倒させてから開放した可能性"),
          li("通信遮断は報告書の送信を止めるためだったのでは"),
          li("仮説：薬で昏倒 → 11:02に遠隔開放 → 事故として処理"),
        ],
        color: "blue",
      },
    },
    {
      id: ids.handout,
      type: "list",
      position: { x: 1930, y: 150 },
      data: {
        title: "自分のハンドアウト",
        entries: [
          li("内側パネルの故障を報告したのは自分。修理部品は補給船で届いたばかり"),
          li("3日前、被害者に「エアロックの点検記録を見せてほしい」と頼まれた"),
          li("昨夜、管制室で通信士が権限外の端末を操作しているのを見た"),
          li("実は修理を後回しにしていた。責任を問われるのが怖い"),
          li("被害者から記録メディアを預かっている。「何かあったら地球に送って」"),
          li("ステーション長から「事故として処理する。余計なことは言うな」と釘を刺された"),
        ],
      },
    },
    {
      id: ids.goals,
      type: "list",
      position: { x: 2200, y: 150 },
      data: {
        title: "秘密の目標",
        entries: [
          li("【3点】エアロック開放の真の操作元を突き止める"),
          li("【2点】修理を後回しにしていた事実を隠し通す"),
          li("【2点】真犯人を正しく投票する"),
          li("【1点】預かった記録メディアを地球へ送信する"),
        ],
      },
    },
    {
      id: ids.researcher,
      type: "sticky",
      position: { x: 3030, y: 300 },
      data: {
        title: "研究員",
        text: "データ改ざんの疑惑。報告書が届けば破滅する動機がある",
        color: "blue",
      },
    },
    {
      id: ids.operator,
      type: "sticky",
      position: { x: 3030, y: 450 },
      data: {
        title: "通信士",
        text: "権限外の端末操作と30分の通信遮断。遠隔開放ができる立場",
        color: "yellow",
      },
    },
    {
      id: ids.commander,
      type: "sticky",
      position: { x: 3030, y: 600 },
      data: {
        title: "ステーション長",
        text: "ログ保全を止め、事故処理を急ぎすぎている。何かを隠している？",
        color: "pink",
      },
    },
    {
      id: ids.medic,
      type: "sticky",
      position: { x: 3030, y: 150 },
      data: {
        title: "医療班長",
        text: "睡眠導入剤の在庫が合わない。単独犯行は難しいが共犯なら？",
        color: "green",
      },
    },
    {
      id: ids.keywords,
      type: "keyword",
      position: { x: 580, y: 150 },
      data: {
        title: "キーワード",
        entries: [li("報告書"), li("エアロック"), li("睡眠導入剤"), li("記録メディア")],
        color: "purple",
      },
    },
    {
      id: ids.actions,
      type: "actionlog",
      position: { x: 1570, y: 150 },
      data: {
        title: "やり取りの記録",
        entries: [
          ac("研究員", "被害者", "実験データの扱いを巡って口論"),
          ac("医療班長", "被害者", "睡眠導入剤を処方"),
          ac("ステーション長", "被害者", "管制室で二人きりの面談"),
          ac("被害者", "整備士（自分）", "記録メディアを託す"),
          ac("ステーション長", "整備士（自分）", "「余計なことは言うな」と釘を刺す"),
        ],
      },
    },
    {
      id: ids.secretTalks,
      type: "actionlog",
      position: { x: 1570, y: 370 },
      data: {
        title: "密談メモ",
        entries: [
          ac("ステーション長", "通信士", "また二人きり。口裏合わせでは？"),
          ac("研究員", "", ""),
          ac("医療班長", "", ""),
          ac("整備士（自分）", "研究員", ""),
          ac("通信士", "", "相手を明かさない。なぜ？"),
        ],
      },
    },
    {
      id: ids.stack,
      type: "stack",
      position: { x: 3320, y: 150 },
      width: 266,
      height: 300,
      data: { title: "未整理メモ", color: "gray" },
    },
    {
      id: ids.emptyStack,
      type: "stack",
      position: { x: 3320, y: 480 },
      width: STACK_EMPTY_W,
      height: STACK_EMPTY_H,
      data: { title: "" },
    },
    {
      id: ids.stackMemo1,
      type: "sticky",
      parentId: ids.stack,
      position: { x: 8, y: 40 },
      data: {
        title: "確認したいこと",
        text: "未申告のコンテナの中身。パイロットに聞くか、貨物室を調べるか",
        color: "yellow",
      },
    },
    {
      id: ids.stackMemo2,
      type: "sticky",
      parentId: ids.stack,
      position: { x: 8, y: 170 },
      data: {
        title: "あとで整理",
        text: "深夜の物音と通信士の「何も聞いていない」は矛盾しない？",
        color: "gray",
      },
    },
  ];

  const now = Date.now();
  return {
    id: nanoid(),
    name: "サンプルシナリオ",
    createdAt: now,
    updatedAt: now,
    isDemo: true,
    demoVersion: DEMO_VERSION,
    nodes,
  };
}
