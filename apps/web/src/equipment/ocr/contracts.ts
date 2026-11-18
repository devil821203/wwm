import type { EquipmentImage } from '@wwm/game-data';
export type OcrBox = { x0: number; y0: number; x1: number; y1: number };
export type OcrLine = { text: string; confidence: number | null; box?: OcrBox };
export type OcrResult = { adapterId: string; text: string; lines: OcrLine[] };
export type Crop = { x: number; y: number; width: number; height: number };
export type OcrInput = {
  image: EquipmentImage;
  language: 'eng' | 'chi_tra+eng';
  crop: Crop;
  rotation: number;
  scale: number;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
};
export interface OcrAdapter {
  id: string;
  recognize(input: OcrInput): Promise<OcrResult>;
}
export const fullCrop: Crop = { x: 0, y: 0, width: 100, height: 100 };
export function validateTransform(crop: Crop, rotation: number, scale: number) {
  if (
    ![crop.x, crop.y, crop.width, crop.height, rotation, scale].every(
      Number.isFinite,
    ) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.x + crop.width > 100 ||
    crop.y + crop.height > 100 ||
    ![0, 90, 180, 270].includes(rotation) ||
    ![1, 2].includes(scale)
  )
    throw new Error('裁切範圍須在原圖內，旋轉限90度倍數，取樣倍率為1或2。');
}
export const abortError = () =>
  new DOMException('辨識已取消，人工輸入保留。', 'AbortError');
export class TextOcrAdapter implements OcrAdapter {
  readonly id = 'text-import-v1';
  constructor(private readonly text: string) {}
  async recognize(input: OcrInput): Promise<OcrResult> {
    if (input.signal.aborted) throw abortError();
    return {
      adapterId: this.id,
      text: this.text,
      lines: this.text
        .split(/\r?\n/)
        .map((text) => ({ text, confidence: null })),
    };
  }
}
export async function runOcr(
  adapter: OcrAdapter,
  input: OcrInput,
): Promise<OcrResult> {
  if (input.signal.aborted) throw abortError();
  const result = await adapter.recognize(input);
  if (input.signal.aborted) throw abortError();
  return result;
}
