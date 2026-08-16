import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, throttleLeading } from '../debounce';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('連続呼び出しは最後の引数で 1 回だけ実行される', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    d(3);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('cancel は保留中の実行を破棄する', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush は保留中なら即実行し、保留なしなら何もしない', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
    d(1);
    d.flush();
    expect(fn).toHaveBeenCalledExactlyOnceWith(1);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttleLeading', () => {
  it('先頭は即実行し、ms 以内の後続は無視する', () => {
    const fn = vi.fn();
    const t = throttleLeading(fn, 100);
    t(1);
    t(2);
    expect(fn).toHaveBeenCalledExactlyOnceWith(1);
    vi.advanceTimersByTime(101);
    t(3);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });
});
