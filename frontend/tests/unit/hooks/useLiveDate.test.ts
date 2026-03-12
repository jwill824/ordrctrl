// T010 — Unit tests for useLiveDate hook
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useLiveDate } from '@/hooks/useLiveDate';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useLiveDate', () => {
  it('returns the current date on mount', () => {
    vi.useFakeTimers();
    const before = Date.now();
    const { result } = renderHook(() => useLiveDate());
    const after = Date.now();
    expect(result.current.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.current.getTime()).toBeLessThanOrEqual(after);
  });

  it('updates after the interval elapses', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveDate(1000));
    const initial = result.current.getTime();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.getTime()).toBeGreaterThan(initial);
  });

  it('does not update before the interval elapses', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveDate(5000));
    const initial = result.current.getTime();

    act(() => {
      vi.advanceTimersByTime(4999);
    });

    expect(result.current.getTime()).toBe(initial);
  });

  it('uses 60 seconds as default interval', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    renderHook(() => useLiveDate());
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    setIntervalSpy.mockRestore();
  });

  it('clears the interval on unmount', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useLiveDate(1000));
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
