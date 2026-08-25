// 配列の from の要素を取り除き、移動前の添字で数えた to の位置へ挿し直した新しい配列を返す。
// 「行を別の行の上へドロップするとその行の位置に収まる」挙動の実装で、元の配列は変えない。
// from が範囲外なら元の内容のままのコピーを返す。to は範囲外でも端へ丸まる。
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return [...items];
  const item = items[from]!;
  const next = items.filter((_, i) => i !== from);
  next.splice(to, 0, item);
  return next;
}
