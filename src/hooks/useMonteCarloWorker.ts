/**
 * Custom hook for running Monte Carlo simulations in a Web Worker
 *
 * This hook provides a clean API for running Monte Carlo simulations
 * off the main thread, with progress tracking and error handling.
 *
 * Example usage:
 * ```tsx
 * const { run, result, progress, isRunning, error } = useMonteCarloWorker();
 *
 * // Start simulation
 * run({ items, directionId, directionName, settings, usl, lsl });
 *
 * // Show progress
 * {isRunning && <LinearProgress value={progress * 100} />}
 *
 * // Use result
 * {result && <ResultsDisplay result={result} />}
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ToleranceItem, MonteCarloSettings, MonteCarloResult, HistogramBin } from '../types';

interface MonteCarloWorkerParams {
  items: ToleranceItem[];
  directionId: string;
  directionName: string;
  settings: MonteCarloSettings;
  usl?: number;
  lsl?: number;
}

interface SerializedMonteCarloResult extends Omit<MonteCarloResult, 'itemHistograms'> {
  itemHistograms: [string, HistogramBin[]][];
}

interface WorkerResponse {
  type: 'progress' | 'result' | 'error';
  progress?: number;
  result?: SerializedMonteCarloResult;
  error?: string;
}

interface UseMonteCarloWorkerReturn {
  /** Start a Monte Carlo simulation */
  run: (params: MonteCarloWorkerParams) => void;
  /** The simulation result (null if not yet complete) */
  result: MonteCarloResult | null;
  /** Current progress (0-1) */
  progress: number;
  /** Whether a simulation is currently running */
  isRunning: boolean;
  /** Error message if simulation failed */
  error: string | null;
  /** Cancel the current simulation */
  cancel: () => void;
}

export function useMonteCarloWorker(): UseMonteCarloWorkerReturn {
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // Clean up worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setIsRunning(false);
      setProgress(0);
    }
  }, []);

  const run = useCallback((params: MonteCarloWorkerParams) => {
    // Cancel any existing simulation
    cancel();

    setResult(null);
    setError(null);
    setProgress(0);
    setIsRunning(true);

    try {
      // Create new worker
      const worker = new Worker(
        new URL('../workers/monteCarlo.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { type } = e.data;

        switch (type) {
          case 'progress':
            setProgress(e.data.progress || 0);
            break;

          case 'result':
            if (e.data.result) {
              // Convert serialized itemHistograms back to Map
              const deserializedResult: MonteCarloResult = {
                ...e.data.result,
                itemHistograms: new Map(e.data.result.itemHistograms),
              };
              setResult(deserializedResult);
            }
            setIsRunning(false);
            setProgress(1);
            break;

          case 'error':
            setError(e.data.error || 'Unknown error');
            setIsRunning(false);
            break;
        }
      };

      worker.onerror = (e) => {
        setError(e.message || 'Worker error');
        setIsRunning(false);
      };

      // Start simulation
      worker.postMessage(params);
    } catch (err) {
      setError((err as Error).message);
      setIsRunning(false);
    }
  }, [cancel]);

  return {
    run,
    result,
    progress,
    isRunning,
    error,
    cancel,
  };
}

export default useMonteCarloWorker;
