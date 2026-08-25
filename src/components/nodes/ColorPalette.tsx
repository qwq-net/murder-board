import { STICKY_COLORS_BY_HUE, type StickyColor } from "@/types/board";

// 基準要素の近くに浮かべる色パレット。position が "top" なら基準要素の上に中央揃えで、
// "left" なら左横に縦中央で出る。ノードの横幅設定が変わっても位置が偏らないよう、
// どちらも基準要素からの相対配置で決まる。
// スワッチは色相環の順に並び、Tab のフォーカス対象にはならない。
// クリックで onPick に色を渡す。defaultSwatch を渡すと
// 先頭に「既定色へ戻す」スワッチが付き、そのクリックでは onPick(undefined) が呼ばれる。
// 付箋のように既定色の概念が無いノードは defaultSwatch を渡さないことで
// undefined が来ないことを保証できる。
export function ColorPalette({
  color,
  defaultSwatch,
  position = "top",
  onPick,
}: {
  color: StickyColor | undefined;
  defaultSwatch?: string;
  position?: "top" | "left";
  onPick: (color: StickyColor | undefined) => void;
}) {
  const swatch = (label: string, current: boolean, bg: string, pick: StickyColor | undefined) => (
    <button
      key={label}
      type="button"
      tabIndex={-1}
      aria-label={`色: ${label}`}
      className={`h-4 w-4 shrink-0 cursor-pointer rounded-full ${
        current ? "ring-2 ring-accent" : ""
      }`}
      style={{ background: bg }}
      onClick={() => onPick(pick)}
    />
  );
  return (
    <div
      className={`nodrag absolute z-10 flex items-center gap-1 rounded-md border border-border-strong bg-bg-elevated px-1.5 py-1 shadow-lg ${
        position === "top"
          ? "-top-9 left-1/2 -translate-x-1/2"
          : "top-1/2 right-full mr-2 -translate-y-1/2"
      }`}
    >
      {defaultSwatch !== undefined && (
        <>
          {swatch("既定", color === undefined, defaultSwatch, undefined)}
          {/* 既定色とパレット本体の大胆な区切り */}
          <div className="mx-0.5 h-4 w-px shrink-0 bg-border-strong" />
        </>
      )}
      {STICKY_COLORS_BY_HUE.map((c) => swatch(c, c === color, `var(--sticky-${c}-accent)`, c))}
    </div>
  );
}
