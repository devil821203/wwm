import type { ManualRow } from '../editor-model';
import { newRow } from '../editor-model';
import { nameKey, type OcrCandidate } from './parser';
export function addOcrCandidate(
  existing: ManualRow[],
  candidate: OcrCandidate,
  kind: 'base' | 'affix',
): {
  rows: ManualRow[];
  added: boolean;
  message: string;
} {
  if (existing.some((row) => nameKey(row.label) === nameKey(candidate.label)))
    return {
      rows: existing,
      added: false,
      message: '已有同名欄位，保留原值；請在編輯器手動修正。',
    };
  const matches = candidate.matches.filter((match) => match.kind === kind);
  const row: ManualRow = {
    ...newRow(),
    label: candidate.label,
    text: candidate.text,
    confirmed: false,
    ocr: structuredClone(candidate.trace),
  };
  if (matches.length === 1) row.id = matches[0].id;
  return {
    rows: [...existing, row],
    added: true,
    message: '已加入待確認欄位；請對照原圖再勾選確認。',
  };
}
