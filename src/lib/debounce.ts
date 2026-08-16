// 連続呼び出しを ms 後の 1 回にまとめる debounce。呼び出しごとにタイマーをリセットし、
// 最後に渡された引数で fn を 1 回だけ実行する。
// - cancel(): 保留中の実行を破棄する
// - flush(): 保留中の実行があれば即座に実行する（なければ何もしない）
// 使われ方: ボード変更の IndexedDB 自動保存。セッション切替前に flush、削除時に cancel する。
export function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: T | undefined;

  const invoke = () => {
    timer = undefined;
    const args = lastArgs!;
    lastArgs = undefined;
    fn(...args);
  };

  const debounced = (...args: T) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(invoke, ms);
  };
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
  };
  debounced.flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      invoke();
    }
  };
  return debounced;
}

// 先頭の呼び出しを即実行し、以降 ms 経過までの呼び出しを無視する throttle（trailing なし）。
// 使われ方: zundo の履歴記録の間引き。ドラッグ中の連続更新で Undo 履歴が溢れるのを防ぐ。
// ponytail: trailing なしのため ms を跨ぐ長ドラッグは複数の履歴エントリになる。気になれば trailing 追加
export function throttleLeading<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let last = -Infinity;
  return (...args: T) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}
