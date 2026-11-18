import { optimize, type OptimizationRequest } from '@wwm/optimizer';
self.onmessage = (event: MessageEvent<OptimizationRequest>) => {
  try {
    const result = optimize(event.data, {
      progress: (progress) => self.postMessage({ type: 'PROGRESS', progress }),
    });
    self.postMessage({ type: 'RESULT', result });
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      message: error instanceof Error ? error.message : '最佳化失敗',
    });
  }
};
