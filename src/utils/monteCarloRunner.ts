import { MonteCarloResult, MonteCarloSettings, ToleranceItem } from '../types';
import { runMonteCarloSimulation } from './monteCarloCalculator';

export interface MonteCarloRequest {
  items: ToleranceItem[];
  directionId: string;
  directionName: string;
  settings: MonteCarloSettings;
  usl?: number;
  lsl?: number;
  center: number;
}

export interface MonteCarloJob {
  promise: Promise<MonteCarloResult>;
  cancel: () => void;
}

/**
 * Run a Monte Carlo simulation off the main thread so the UI stays responsive.
 * Falls back to running inline where Web Workers are unavailable.
 * `cancel()` terminates the worker; the promise then never settles.
 */
export function startMonteCarlo(request: MonteCarloRequest): MonteCarloJob {
  if (typeof Worker === 'undefined') {
    let cancelled = false;
    const promise = new Promise<MonteCarloResult>((resolve, reject) => {
      setTimeout(() => {
        if (cancelled) return;
        try {
          const { items, directionId, directionName, settings, usl, lsl, center } = request;
          resolve(runMonteCarloSimulation(items, directionId, directionName, settings, usl, lsl, center));
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
    return { promise, cancel: () => { cancelled = true; } };
  }

  const worker = new Worker(new URL('./monteCarlo.worker.ts', import.meta.url), { type: 'module' });
  const promise = new Promise<MonteCarloResult>((resolve, reject) => {
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Monte Carlo worker failed'));
    };
  });
  worker.postMessage(request);
  return { promise, cancel: () => worker.terminate() };
}
