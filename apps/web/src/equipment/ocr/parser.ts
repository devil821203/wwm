import type { GameDataRelease, OcrTrace } from '@wwm/game-data';
import type { OcrResult, OcrInput } from './contracts';
export type OcrCandidate = {
  key: string;
  kind: 'base' | 'affix' | 'unknown';
  label: string;
  text: string;
  matches: { id: string; kind: 'base' | 'affix' }[];
  warnings: string[];
  trace: OcrTrace;
};
export type MetadataCandidate = {
  key: string;
  field:
    'name' | 'quality' | 'tierId' | 'slotId' | 'tuningStage' | 'isChengYin';
  value: string | number | boolean | null;
  trace: OcrTrace;
};
export type ParsedOcr = {
  fields: MetadataCandidate[];
  candidates: OcrCandidate[];
  unparsed: string[];
};
export function normalizeOcrText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\u2212/g, '-')
    .replace(/\u00a0/g, ' ')
    .trim();
}
export function nameKey(text: string): string {
  return normalizeOcrText(text)
    .toLocaleLowerCase('en')
    .replace(/[\s_:：-]+/g, '');
}
export function parseOcrResult(
  result: OcrResult,
  input: Pick<OcrInput, 'image' | 'crop' | 'rotation' | 'scale'>,
  release?: GameDataRelease,
): ParsedOcr {
  const parsed: ParsedOcr = { fields: [], candidates: [], unparsed: [] };
  let section: 'base' | 'affix' | 'unknown' = 'unknown';
  const runId = crypto.randomUUID();
  for (const [index, line] of result.lines.entries()) {
    const text = normalizeOcrText(line.text);
    if (!text) continue;
    if (/^(?:base stats?|基礎屬性)\s*[:：]?$/i.test(text)) {
      section = 'base';
      continue;
    }
    if (/^(?:affixes|詞條|既有詞條)\s*[:：]?$/i.test(text)) {
      section = 'affix';
      continue;
    }
    const trace: OcrTrace = {
      adapterId: result.adapterId,
      runId,
      imageId: input.image.id,
      rawText: line.text,
      confidence: line.confidence,
      recognizedLabel: '',
      recognizedValue: null,
      unit: '',
      box: line.box,
      crop: input.crop,
      rotation: input.rotation as OcrTrace['rotation'],
      scale: input.scale as OcrTrace['scale'],
    };
    const metadata = text.match(
      /^(裝備名稱|名稱|name|品質|quality|階級|tier|部位|slot|調律階段|tuning|承音|chengyin)\s*:\s*(.+)$/i,
    );
    const definition = release?.equipment.filter(
      (item) => nameKey(item.name) === nameKey(text),
    );
    if (metadata || definition?.length === 1) {
      const key = metadata?.[1].toLowerCase() ?? 'name';
      const raw = metadata?.[2] ?? text;
      let field: MetadataCandidate['field'] = 'name';
      let value: MetadataCandidate['value'] = raw;
      if (['品質', 'quality'].includes(key)) {
        field = 'quality';
        value = /^(?:紫裝?|purple)$/i.test(raw) ? 'purple' : null;
      } else if (['階級', 'tier', '部位', 'slot'].includes(key)) {
        field = ['部位', 'slot'].includes(key) ? 'slotId' : 'tierId';
        value = /^[a-z0-9][a-z0-9_-]*$/.test(raw) ? raw : null;
      } else if (['調律階段', 'tuning'].includes(key)) {
        field = 'tuningStage';
        value =
          /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw))
            ? Number(raw)
            : null;
      } else if (['承音', 'chengyin'].includes(key)) {
        field = 'isChengYin';
        value = /^(是|yes|true)$/i.test(raw)
          ? true
          : /^(否|no|false)$/i.test(raw)
            ? false
            : null;
      }
      trace.recognizedLabel = field;
      parsed.fields.push({ key: runId + '-' + index, field, value, trace });
      continue;
    }
    const match = text.match(
      /^(.+?)\s*[:=]?\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(%)?$/,
    );
    if (!match || /\d\s*[-~–]\s*\d/.test(text)) {
      parsed.unparsed.push(line.text);
      continue;
    }
    const label = match[1].replace(/[:=]\s*$/, '').trim();
    if (!label || /\d/.test(label)) {
      parsed.unparsed.push(line.text);
      continue;
    }
    const value = Number(match[2].replace(/,/g, ''));
    if (!Number.isFinite(value)) {
      parsed.unparsed.push(line.text);
      continue;
    }
    const matches: OcrCandidate['matches'] = [];
    for (const stat of release?.stats ?? [])
      if (
        nameKey(stat.name) === nameKey(label) ||
        nameKey(stat.id) === nameKey(label)
      )
        matches.push({ id: stat.id, kind: 'base' });
    for (const affix of release?.affixes ?? [])
      if (
        nameKey(affix.name) === nameKey(label) ||
        nameKey(affix.id) === nameKey(label)
      )
        matches.push({ id: affix.id, kind: 'affix' });
    const relevant =
      section === 'unknown'
        ? matches
        : matches.filter((item) => item.kind === section);
    const kind =
      section !== 'unknown'
        ? section
        : relevant.length === 1
          ? relevant[0].kind
          : 'unknown';
    trace.recognizedLabel = label;
    trace.recognizedValue = value;
    trace.unit = match[3] ?? '';
    const warnings: string[] = [];
    if (line.confidence === null) warnings.push('辨識信心未知');
    else if (line.confidence < 0.75) warnings.push('低辨識信心，請對照原圖');
    if (relevant.length > 1) warnings.push('名稱有多個候選，請人工選擇');
    if (kind === 'unknown') warnings.push('欄位種類未知，請人工選擇');
    parsed.candidates.push({
      key: runId + '-' + index,
      kind,
      label,
      text: String(value),
      matches: relevant,
      warnings,
      trace,
    });
  }
  return parsed;
}
