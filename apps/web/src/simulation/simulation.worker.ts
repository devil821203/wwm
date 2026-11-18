import { simulate, type SimulationRequest } from '@wwm/combat-engine';
self.onmessage = (event: MessageEvent<SimulationRequest>) => {
  try {
    const result = simulate(event.data, (completed, total) =>
      self.postMessage({ type: 'PROGRESS', completed, total }),
    );
    self.postMessage({ type: 'RESULT', result });
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      message: error instanceof Error ? error.message : '模擬失敗',
    });
  }
};
