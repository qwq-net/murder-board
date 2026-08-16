import { useEffect, useState } from 'react';

export const THEMES = ['dark', 'light', 'auto'] as const;
export type Theme = (typeof THEMES)[number];

const THEME_KEY = 'murder-memo2-theme';

// localStorage 等から読んだ生値を Theme に解釈する。
// 'dark' | 'light' | 'auto' 以外の値は既定の 'dark' を返す。null・空文字も同様。
export function parseTheme(raw: string | null): Theme {
  return THEMES.includes(raw as Theme) ? (raw as Theme) : 'dark';
}

// テーマ設定を dark → light → auto → dark の順に巡回させた次の値を返す。
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
}

// テーマ設定を localStorage に永続化しつつ <html data-theme> に反映するフック。
// 'auto' のときは prefers-color-scheme に追従し、OS 設定の変更にも即座に反応する。
// 返り値は現在の設定値と、設定を巡回させる toggle。
// 使われ方: App のルートで 1 箇所だけ呼び、theme を Toolbar の表示と Board の
// ReactFlow colorMode に渡す前提。複数箇所で呼ぶと data-theme の反映が競合する。
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => parseTheme(localStorage.getItem(THEME_KEY)));

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    const apply = (resolved: 'dark' | 'light') => {
      document.documentElement.dataset.theme = resolved;
    };
    if (theme !== 'auto') {
      apply(theme);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, toggle: () => setTheme(nextTheme(theme)) };
}
