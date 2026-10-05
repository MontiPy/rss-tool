/// <reference lib="webworker" />
import { runMonteCarloSimulation } from './monteCarloCalculator';
import type { MonteCarloRequest } from './monteCarloRunner';

self.onmessage = (event: MessageEvent<MonteCarloRequest>) => {
  const { items, directionId, directionName, settings, usl, lsl, center } = event.data;
  try {
    const result = runMonteCarloSimulation(items, directionId, directionName, settings, usl, lsl, center);
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({ ok: false, error: (error as Error).message });
  }
};
