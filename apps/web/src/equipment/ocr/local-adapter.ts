import type { Worker } from 'tesseract.js';
import {
  abortError,
  validateTransform,
  type OcrAdapter,
  type OcrInput,
  type OcrResult,
} from './contracts';

export async function preprocessImage(
  input: OcrInput,
): Promise<HTMLCanvasElement> {
  validateTransform(input.crop, input.rotation, input.scale);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('圖片無法解碼。'));
    image.src = input.image.dataUrl;
  });
  if (input.signal.aborted) throw abortError();
  const crop = input.crop;
  const sx = (image.naturalWidth * crop.x) / 100,
    sy = (image.naturalHeight * crop.y) / 100;
  const sw = (image.naturalWidth * crop.width) / 100,
    sh = (image.naturalHeight * crop.height) / 100;
  const sideways = input.rotation === 90 || input.rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((sideways ? sh : sw) * input.scale));
  canvas.height = Math.max(1, Math.round((sideways ? sw : sh) * input.scale));
  if (canvas.width > 12000 || canvas.height > 12000)
    throw new Error('處理後圖片超過12000像素，請縮小裁切範圍。');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('此瀏覽器無法使用本機圖像處理。');
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((input.rotation * Math.PI) / 180);
  context.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    (-sw * input.scale) / 2,
    (-sh * input.scale) / 2,
    sw * input.scale,
    sh * input.scale,
  );
  return canvas;
}
export class LocalTesseractAdapter implements OcrAdapter {
  readonly id = 'tesseract-local-v7';
  async recognize(input: OcrInput): Promise<OcrResult> {
    const image = await preprocessImage(input);
    const { createWorker, OEM, PSM } = await import('tesseract.js');
    if (input.signal.aborted) throw abortError();
    let worker: Worker | undefined;
    let finished = false;
    let rejectFailure: (reason: Error) => void = () => {};
    const failure = new Promise<never>((_, reject) => {
      rejectFailure = reject;
    });
    const abort = () => {
      rejectFailure(abortError());
      void worker?.terminate().catch(() => {});
    };
    input.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => {
      rejectFailure(new Error('本機辨識逾時，請縮小圖片或改用文字/手動輸入。'));
      void worker?.terminate().catch(() => {});
    }, 60000);
    try {
      const base = new URL(
        import.meta.env.BASE_URL + 'ocr-assets/',
        window.location.href,
      ).href;
      const creation = createWorker(input.language, OEM.LSTM_ONLY, {
        workerPath: base + 'worker.min.js',
        corePath: base + 'core',
        langPath: base + 'lang',
        workerBlobURL: false,
        gzip: true,
        cacheMethod: 'none',
        logger: (message) =>
          input.onProgress(Math.max(0, Math.min(1, message.progress))),
        errorHandler: (error) => rejectFailure(new Error(String(error))),
      }).then((created) => {
        if (finished || input.signal.aborted) {
          void created.terminate().catch(() => {});
          throw abortError();
        }
        worker = created;
        return created;
      });
      worker = await Promise.race([creation, failure]);
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
      });
      const { data } = await Promise.race([
        worker.recognize(image, {}, { text: true, blocks: true }),
        failure,
      ]);
      const lines = (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.map((line) => ({
            text: line.text,
            confidence: Number.isFinite(line.confidence)
              ? Math.max(0, Math.min(1, line.confidence / 100))
              : null,
            box: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1,
            },
          })),
        ),
      );
      return {
        adapterId: this.id,
        text: data.text,
        lines: lines.length
          ? lines
          : data.text
              .split(/\r?\n/)
              .map((text) => ({ text, confidence: null })),
      };
    } finally {
      finished = true;
      clearTimeout(timer);
      input.signal.removeEventListener('abort', abort);
      await worker?.terminate().catch(() => {});
    }
  }
}
