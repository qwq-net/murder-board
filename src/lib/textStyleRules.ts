// テキストへルールベースの装飾を当てるための汎用分割ロジック。
// ルールは「テキスト中で探す文字列 key + 呼び手が定める任意のペイロード」で、
// 登場人物の名前色付けのほか、将来のリンクテキストのような機能もルールの追加だけで載せる。

// 分割結果の 1 区間。rule が付く区間はその key に一致した部分で、無い区間は平文
export type TextRun<R> = { text: string; rule?: R };

// text をルールに従って区間列に分割する。結合すると必ず元の text に戻る。
// - 一致は key の完全一致のみ。同じ位置に複数の key が一致するときは長い方が勝ち、
//   同長なら rules で先の方が勝つ
// - 一致済みの区間は再走査しない。key 同士の部分的な重なりは先に一致した方が取る
// - 空の key は無視する。text が空か有効なルールが無ければ全体を 1 区間で返す
export function splitByRules<R extends { key: string }>(text: string, rules: R[]): TextRun<R>[] {
  const pool = rules.filter((r) => r.key !== "").sort((a, b) => b.key.length - a.key.length);
  if (text === "" || pool.length === 0) return [{ text }];

  const runs: TextRun<R>[] = [];
  let rest = text;
  while (rest.length > 0) {
    const head = pool.find((r) => rest.startsWith(r.key));
    if (head) {
      runs.push({ text: head.key, rule: head });
      rest = rest.slice(head.key.length);
      continue;
    }
    // 先頭一致が無いので、次にいずれかの key が現れる位置までを平文として切り出す。
    // 先頭は一致しないと確認済みのため、探索は 1 文字目以降でよい
    let next = rest.length;
    for (const r of pool) {
      const idx = rest.indexOf(r.key, 1);
      if (idx > 0 && idx < next) next = idx;
    }
    const chunk = rest.slice(0, next);
    const last = runs[runs.length - 1];
    if (last !== undefined && last.rule === undefined) {
      last.text += chunk;
    } else {
      runs.push({ text: chunk });
    }
    rest = rest.slice(next);
  }
  return runs;
}
