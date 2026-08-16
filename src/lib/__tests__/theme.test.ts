import { describe, expect, it } from 'vitest';
import { nextTheme, parseTheme } from '@/lib/theme';

describe('parseTheme', () => {
  it('有効な値はそのまま返す', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('auto')).toBe('auto');
  });

  it('null や不正値は dark にフォールバックする', () => {
    expect(parseTheme(null)).toBe('dark');
    expect(parseTheme('')).toBe('dark');
    expect(parseTheme('purple')).toBe('dark');
  });
});

describe('nextTheme', () => {
  it('dark → light → auto → dark と巡回する', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('auto');
    expect(nextTheme('auto')).toBe('dark');
  });
});
