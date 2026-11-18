import {
  type EquipmentInstance,
  type GameDataRelease,
  type ResolvedValue,
  type OcrTrace,
} from '@wwm/game-data';

export type ManualRow = {
  key: string;
  id: string;
  label: string;
  text: string;
  confirmed: boolean;
  ocr?: OcrTrace;
  valueMode?: 'MANUAL' | 'CHENG_YIN' | 'MAX';
  maxOnChengYinConfirmed?: boolean;
  original?: ResolvedValue;
  originalText?: string;
  originalLabel?: string;
  originalConfirmed?: boolean;
};
export function emptyEquipment(): EquipmentInstance {
  return {
    id: crypto.randomUUID(),
    name: '新裝備草稿',
    gameVersionId: null,
    tierId: null,
    quality: null,
    isChengYin: false,
    tuningStage: null,
    creationMethod: 'MANUAL',
    evidenceIds: [],
    imageIds: [],
    baseStats: [],
    affixes: [],
    validation: { status: 'UNVERIFIED', reasons: ['尚未驗證'] },
  };
}
export function unknownValue(version: string | null): ResolvedValue {
  return {
    status: 'UNKNOWN',
    gameVersionId: version,
    value: null,
    reason: '待人工確認或缺乏適用資料',
  };
}
export function newRow(): ManualRow {
  return {
    key: crypto.randomUUID(),
    id: 'manual-' + crypto.randomUUID(),
    label: '',
    text: '',
    confirmed: false,
  };
}
export function rowsFrom(
  item: EquipmentInstance,
  kind: 'base' | 'affix',
  release?: GameDataRelease,
): ManualRow[] {
  return kind === 'base'
    ? item.baseStats.map((stat) => {
        const observation = item.baseObservations?.find(
          (row) => row.statId === stat.statId,
        );
        const label =
          observation?.rawName ??
          release?.stats.find((def) => def.id === stat.statId)?.name ??
          stat.statId;
        const text =
          stat.value.value?.toString() ?? observation?.value?.toString() ?? '';
        const confirmed = stat.value.status === 'MANUAL_CONFIRMED';
        return {
          key: stat.statId,
          id: stat.statId,
          label,
          text,
          confirmed,
          original: stat.value,
          ocr: observation?.ocr,
          originalText: text,
          originalLabel: label,
          originalConfirmed: confirmed,
        };
      })
    : item.affixes.map((affix) => {
        const label =
          affix.observation?.rawName ??
          release?.affixes.find((def) => def.id === affix.affixId)?.name ??
          affix.affixId;
        const text =
          affix.current.value?.toString() ??
          affix.observation?.value?.toString() ??
          '';
        const confirmed = affix.current.status === 'MANUAL_CONFIRMED';
        return {
          key: affix.affixId,
          id: affix.affixId,
          label,
          text,
          confirmed,
          original: affix.current,
          valueMode: affix.valueMode,
          maxOnChengYinConfirmed: affix.maxOnChengYinConfirmed,
          ocr: affix.observation?.ocr,
          originalText: text,
          originalLabel: label,
          originalConfirmed: confirmed,
        };
      });
}
function candidateNumber(row: ManualRow): number | null {
  if (row.text.trim() === '') return null;
  const value = Number(row.text);
  if (!Number.isFinite(value))
    throw new Error('「' + row.label + '」不是有效的有限數值。');
  return value;
}
export function rowValue(
  row: ManualRow,
  version: string | null,
  origin: 'MANUAL' | 'SCREENSHOT',
): ResolvedValue {
  const unchanged =
    row.text === row.originalText &&
    row.label === row.originalLabel &&
    row.confirmed === row.originalConfirmed &&
    row.original?.gameVersionId === version;
  if (unchanged && row.original) return structuredClone(row.original);
  const value = candidateNumber(row);
  if (!row.confirmed || value === null) return unknownValue(version);
  return {
    status: 'MANUAL_CONFIRMED',
    gameVersionId: version,
    value,
    confirmation: {
      origin: row.ocr
        ? row.ocr.adapterId === 'text-import-v1'
          ? 'MANUAL'
          : 'SCREENSHOT'
        : origin,
      confirmedAt: new Date().toISOString(),
      evidenceIds: ['confirmation-' + crypto.randomUUID()],
    },
  };
}
export function applyManualRows(
  item: EquipmentInstance,
  baseRows: ManualRow[],
  affixRows: ManualRow[],
  original: EquipmentInstance,
): EquipmentInstance {
  const sameContext =
    item.definitionId === original.definitionId &&
    item.slotId === original.slotId &&
    item.gameVersionId === original.gameVersionId &&
    item.tierId === original.tierId &&
    item.quality === original.quality &&
    item.tuningStage === original.tuningStage &&
    item.isChengYin === original.isChengYin;
  if (!sameContext) {
    const invalidate = (rows: ManualRow[]) =>
      rows.map((row) =>
        row.original ? { ...row, original: undefined, confirmed: false } : row,
      );
    baseRows = invalidate(baseRows);
    affixRows = invalidate(affixRows);
  }
  const origin = item.creationMethod === 'SCREENSHOT' ? 'SCREENSHOT' : 'MANUAL';
  const check = (row: ManualRow) => {
    if (!row.label.trim())
      throw new Error('請輸入屬性或詞條名稱，也可移除空白列。');
  };
  item.baseStats = baseRows.map((row) => {
    check(row);
    return { statId: row.id, value: rowValue(row, item.gameVersionId, origin) };
  });
  item.baseObservations = baseRows.map((row) => ({
    statId: row.id,
    rawName: row.label,
    rawText: row.label + '：' + row.text,
    ocr: row.ocr,
    value: candidateNumber(row),
    manuallyConfirmed: row.confirmed && candidateNumber(row) !== null,
  }));
  item.affixes = affixRows.map((row) => {
    check(row);
    const previous = original.affixes.find((affix) => affix.affixId === row.id);
    const current = rowValue(row, item.gameVersionId, origin);
    const unchanged =
      sameContext &&
      previous &&
      row.text === row.originalText &&
      row.label === row.originalLabel &&
      row.confirmed === row.originalConfirmed;
    if (unchanged)
      return {
        ...structuredClone(previous),
        valueMode: row.valueMode ?? previous.valueMode,
        maxOnChengYinConfirmed: row.maxOnChengYinConfirmed,
      };
    return {
      affixId: row.id,
      valueMode: row.valueMode ?? (item.isChengYin ? 'CHENG_YIN' : 'MANUAL'),
      maxOnChengYinConfirmed: row.maxOnChengYinConfirmed,
      current,
      effective: current,
      maximum:
        sameContext && previous
          ? previous.maximum
          : unknownValue(item.gameVersionId),
      observation: {
        rawName: row.label,
        ocr: row.ocr,
        rawText: row.label + '：' + row.text,
        value: candidateNumber(row),
        origin: row.ocr
          ? row.ocr.adapterId === 'text-import-v1'
            ? 'MANUAL'
            : 'SCREENSHOT'
          : origin,
        manuallyConfirmed: current.status === 'MANUAL_CONFIRMED',
      },
    };
  });
  item.validation = {
    status: 'UNVERIFIED',
    reasons: ['待版本規則與詞條合法值驗證'],
  };
  return item;
}
