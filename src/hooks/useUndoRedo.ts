/**
 * Custom hook for implementing undo/redo functionality
 * 
 * Features:
 * - Maintains history stack with configurable max size
 * - Efficient state management without unnecessary copies
 * - Batch updates for grouping related changes
 * - TypeScript generic support for any state type
 * 
 * Example usage:
 * ```tsx
 * const {
 *   state: projectData,
 *   setState: setProjectData,
 *   undo,
 *   redo,
 *   canUndo,
 *   canRedo,
 *   clear,
 * } = useUndoRedo<ProjectData>(initialData, { maxHistory: 50 });
 * 
 * // Update state (automatically adds to history)
 * setProjectData(newData);
 * 
 * // Undo last change
 * if (canUndo) undo();
 * 
 * // Redo undone change
 * if (canRedo) redo();
 * ```
 */

import { useState, useCallback, useRef } from 'react';

interface UseUndoRedoOptions {
  /** Maximum number of history entries to keep (default: 50) */
  maxHistory?: number;
  /** Callback when state changes (includes undo/redo) */
  onChange?: (state: unknown, source: 'set' | 'undo' | 'redo') => void;
}

interface UseUndoRedoReturn<T> {
  /** Current state */
  state: T;
  /** Update state (adds to history) */
  setState: (newState: T | ((prev: T) => T)) => void;
  /** Undo the last change */
  undo: () => void;
  /** Redo the last undone change */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Clear all history */
  clear: () => void;
  /** Reset to a specific state (clears history) */
  reset: (newState: T) => void;
  /** Number of undo steps available */
  undoCount: number;
  /** Number of redo steps available */
  redoCount: number;
  /** Start a batch update (changes won't create new history entries until endBatch is called) */
  startBatch: () => void;
  /** End batch update and create single history entry */
  endBatch: () => void;
  /** Whether currently in a batch update */
  isBatching: boolean;
}

export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions = {}
): UseUndoRedoReturn<T> {
  const { maxHistory = 50, onChange } = options;

  // Current state
  const [present, setPresent] = useState<T>(initialState);
  
  // History stacks
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  
  // Batching state
  const [isBatching, setIsBatching] = useState(false);
  const batchStartState = useRef<T | null>(null);

  // Set new state (adds to history)
  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setPresent((currentPresent) => {
        const nextState = typeof newState === 'function'
          ? (newState as (prev: T) => T)(currentPresent)
          : newState;

        // If batching, don't add to history yet
        if (isBatching) {
          return nextState;
        }

        // Add current state to past
        setPast((currentPast) => {
          const newPast = [...currentPast, currentPresent];
          // Trim if exceeds max history
          if (newPast.length > maxHistory) {
            return newPast.slice(newPast.length - maxHistory);
          }
          return newPast;
        });

        // Clear future (can't redo after new action)
        setFuture([]);

        onChange?.(nextState, 'set');
        return nextState;
      });
    },
    [isBatching, maxHistory, onChange]
  );

  // Undo
  const undo = useCallback(() => {
    setPast((currentPast) => {
      if (currentPast.length === 0) return currentPast;

      const previous = currentPast[currentPast.length - 1];
      const newPast = currentPast.slice(0, -1);

      setPresent((currentPresent) => {
        // Add current state to future
        setFuture((currentFuture) => [currentPresent, ...currentFuture]);
        onChange?.(previous, 'undo');
        return previous;
      });

      return newPast;
    });
  }, [onChange]);

  // Redo
  const redo = useCallback(() => {
    setFuture((currentFuture) => {
      if (currentFuture.length === 0) return currentFuture;

      const next = currentFuture[0];
      const newFuture = currentFuture.slice(1);

      setPresent((currentPresent) => {
        // Add current state to past
        setPast((currentPast) => [...currentPast, currentPresent]);
        onChange?.(next, 'redo');
        return next;
      });

      return newFuture;
    });
  }, [onChange]);

  // Clear history
  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  // Reset to new state (clears history)
  const reset = useCallback((newState: T) => {
    setPresent(newState);
    setPast([]);
    setFuture([]);
  }, []);

  // Start batch update
  const startBatch = useCallback(() => {
    if (!isBatching) {
      batchStartState.current = present;
      setIsBatching(true);
    }
  }, [isBatching, present]);

  // End batch update
  const endBatch = useCallback(() => {
    if (isBatching && batchStartState.current !== null) {
      // Only add to history if state actually changed
      if (batchStartState.current !== present) {
        setPast((currentPast) => {
          const newPast = [...currentPast, batchStartState.current as T];
          if (newPast.length > maxHistory) {
            return newPast.slice(newPast.length - maxHistory);
          }
          return newPast;
        });
        setFuture([]);
      }
      batchStartState.current = null;
      setIsBatching(false);
    }
  }, [isBatching, present, maxHistory]);

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    clear,
    reset,
    undoCount: past.length,
    redoCount: future.length,
    startBatch,
    endBatch,
    isBatching,
  };
}

export default useUndoRedo;
