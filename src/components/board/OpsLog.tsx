import { useEffect, useState } from "react";
import { useBoardStore } from "@/store";

// 1 件表示してから消え始めるまでの時間と、フェードにかける時間
const VISIBLE_MS = 4500;
const FADE_MS = 500;

// トースト 1 件。マウントから VISIBLE_MS 後にフェードを始め、
// FADE_MS かけて透明になったら onExpire で親へ除去を頼む
function OpsToast({ message, onExpire }: { message: string; onExpire: () => void }) {
  const [fading, setFading] = useState(false);
  useEffect(() => {
    const fade = setTimeout(() => setFading(true), VISIBLE_MS);
    const expire = setTimeout(onExpire, VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(expire);
    };
    // onExpire は毎レンダー新しい関数が来るが、タイマーはマウント時刻基準で張り直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className={`rounded-md border border-border-subtle bg-bg-elevated/95 px-3 py-1.5 text-sm text-text-secondary shadow transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ animation: "ops-in 0.2s ease-out" }}
    >
      {message}
    </div>
  );
}

// 盤面右下の操作ログ。ストアの opsLog から表示済みでないものを最大 5 件、
// 新しいものほど下に積んで表示する。各件は約 5 秒でフェードアウトして消える。
// クリックを奪わないよう全体をポインタ透過にする。
// 使われ方: Board のラッパー直下に 1 つだけ置く前提。
export function OpsLog() {
  const opsLog = useBoardStore((s) => s.opsLog);
  // 表示を終えたエントリの id。opsLog がストア側で直近 8 件に刈られるため、
  // それを覆う 16 件だけ覚えれば取りこぼしがない
  const [expiredIds, setExpiredIds] = useState<readonly number[]>([]);

  const visible = opsLog.filter((op) => !expiredIds.includes(op.id)).slice(-5);
  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-40 flex flex-col items-end gap-1.5">
      {visible.map((op) => (
        <OpsToast
          key={op.id}
          message={op.message}
          onExpire={() => setExpiredIds((prev) => [...prev, op.id].slice(-16))}
        />
      ))}
    </div>
  );
}
