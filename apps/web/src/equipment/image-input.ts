import type { EquipmentImage } from '@wwm/game-data';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function validateImageHeader(
  type: string,
  bytes: Uint8Array,
  size: number,
) {
  if (size <= 0 || size > MAX_IMAGE_BYTES)
    throw new Error('每張圖片須介於 1 byte 至 5 MB。');
  const png =
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value);
  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255;
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(
    (type === 'image/png' && png) ||
    (type === 'image/jpeg' && jpeg) ||
    (type === 'image/webp' && webp)
  ))
    throw new Error('僅接受內容與格式一致的 PNG、JPEG 或 WebP 圖片。');
}
function readFile(
  file: Blob,
  asDataUrl: boolean,
): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取圖片失敗。'));
    reader.onload = () => resolve(reader.result as string | ArrayBuffer);
    if (asDataUrl) reader.readAsDataURL(file);
    else reader.readAsArrayBuffer(file);
  });
}
export async function readEquipmentImage(
  file: File,
  equipmentId: string,
): Promise<EquipmentImage> {
  validateImageHeader(
    file.type,
    new Uint8Array((await readFile(file.slice(0, 12), false)) as ArrayBuffer),
    file.size,
  );
  const dataUrl = (await readFile(file, true)) as string;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('圖片無法解碼，請換一張清晰截圖。'));
    image.src = dataUrl;
  });
  if (
    !image.naturalWidth ||
    !image.naturalHeight ||
    image.naturalWidth > 12000 ||
    image.naturalHeight > 12000
  )
    throw new Error('圖片尺寸無效或超過 12000 像素。');
  return {
    id: crypto.randomUUID(),
    equipmentId,
    name: file.name,
    dataUrl,
    width: image.naturalWidth,
    height: image.naturalHeight,
    savedAt: new Date().toISOString(),
  };
}
