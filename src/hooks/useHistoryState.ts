import { useCallback, useRef, useState } from 'react';

const MAX_HISTORY = 100;
/** Edits with the same coalesce key closer together than this are merged into one undo step (e.g. typing). */
const COALESCE_MS = 600;

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface HistoryState<T> {
  state: T;
  /**
   * Apply a change that can be undone. Rapid consecutive changes that pass the same
   * `coalesceKey` are merged into one step; changes without a key always get their own step.
   */
  setState: (updater: T | ((prev: T) => T), coalesceKey?: string) => void;
  /** Replace state and clear history (e.g. after loading a file). */
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * useState with undo/redo history.
 */
export function useHistoryState<T>(initial: T | (() => T)): HistoryState<T> {
  const [history, setHistory] = useState<History<T>>(() => ({
    past: [],
    present: typeof initial === 'function' ? (initial as () => T)() : initial,
    future: [],
  }));
  const lastChange = useRef<{ time: number; key?: string }>({ time: 0 });

  const setState = useCallback((updater: T | ((prev: T) => T), coalesceKey?: string) => {
    const now = Date.now();
    const coalesce =
      coalesceKey !== undefined &&
      coalesceKey === lastChange.current.key &&
      now - lastChange.current.time < COALESCE_MS;
    lastChange.current = { time: now, key: coalesceKey };

    setHistory((h) => {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(h.present) : updater;
      if (Object.is(next, h.present)) return h;
      const past = coalesce && h.past.length > 0 ? h.past : [...h.past, h.present].slice(-MAX_HISTORY);
      return { past, present: next, future: [] };
    });
  }, []);

  const reset = useCallback((next: T) => {
    lastChange.current = { time: 0 };
    setHistory({ past: [], present: next, future: [] });
  }, []);

  const undo = useCallback(() => {
    lastChange.current = { time: 0 };
    setHistory((h) => {
      if (h.past.length === 0) return h;
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastChange.current = { time: 0 };
    setHistory((h) => {
      if (h.future.length === 0) return h;
      return {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      };
    });
  }, []);

  return {
    state: history.present,
    setState,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
