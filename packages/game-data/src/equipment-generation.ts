import { z } from 'zod';
import {
  EquipmentInstanceSchema,
  GameDataReleaseSchema,
  type EquipmentInstance,
  type GameDataRelease,
  type ResolvedValue,
} from './schemas.js';
import { resolveEquipment } from './equipment-rules.js';
const Options = z.strictObject({
  mode: z.enum([
    'PERFECT_LEGAL',
    'TARGET_AFFIX',
    'RANDOM_LEGAL',
    'MODIFY_OWNED',
  ]),
  definitionId: z.string().min(1),
  level: z.number().int().positive(),
  tuningStage: z.number().int().nonnegative(),
  valueMode: z.enum(['MANUAL', 'MAX', 'CHENG_YIN']),
  onlyExplicit: z.boolean(),
  scenarioConfirmed: z.literal(true),
  seed: z.number().int().min(0).max(4294967295),
  idPrefix: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .max(60),
  evaluatedAt: z.iso.datetime({ offset: true }),
  affixes: z.array(
    z.strictObject({
      id: z.string().min(1),
      value: z.number().finite().nullable(),
    }),
  ),
  mutableAffixIds: z.array(z.string()),
});
export type GenerationOptions = z.infer<typeof Options>;
export type GenerationRequest = GenerationOptions & {
  release: GameDataRelease;
  source?: EquipmentInstance;
};
export function generateIdealGear(input: GenerationRequest) {
  const { release: raw, source, ...rawOptions } = input;
  const result: {
    status: 'READY' | 'PARTIAL' | 'BLOCKED';
    candidates: EquipmentInstance[];
    issues: string[];
    optimalityProven: false;
    combinationsComplete: boolean;
    note: string;
  } = {
    status: 'BLOCKED',
    candidates: [],
    issues: [],
    optimalityProven: false,
    combinationsComplete: false,
    note: '當階候選未依DPS排名，不代表全域完美或遊戲取得保證。隨機為均勻示範分布，非掉落機率。',
  };
  const parsed = Options.safeParse(rawOptions),
    data = GameDataReleaseSchema.safeParse(raw);
  if (!parsed.success || !data.success) {
    result.issues.push('生成設定或版本資料無效，需確認模擬用途與完整欄位');
    return result;
  }
  const o = parsed.data,
    release = data.data;
  const def = release.equipment.find((d) => d.id === o.definitionId),
    rules = def?.legality;
  if (
    !def ||
    !rules?.verified ||
    !release.version.availableLevels.includes(o.level) ||
    def.requiredLevel === null ||
    def.requiredLevel > o.level ||
    !rules.tuningStages.includes(o.tuningStage)
  ) {
    result.issues.push('缺少已驗證完整詞條池/階段，或版本等級不適用');
    return result;
  }
  if (
    new Set(o.affixes.map((a) => a.id)).size !== o.affixes.length ||
    new Set(o.mutableAffixIds).size !== o.mutableAffixIds.length
  ) {
    result.issues.push('詞條或允許修改清單重複');
    return result;
  }
  const unknown = (): ResolvedValue => ({
    status: 'UNKNOWN',
    gameVersionId: release.version.id,
    value: null,
    reason: '生成模式未提供目前實測值',
  });
  const selected = (value: number): ResolvedValue => ({
    status: 'MANUAL_CONFIRMED',
    gameVersionId: release.version.id,
    value,
    confirmation: {
      origin: 'MANUAL',
      confirmedAt: o.evaluatedAt,
      evidenceIds: [o.idPrefix + '-scenario'],
    },
    note: '使用者確認的生成模擬設定，非遊戲實測或資料庫實值',
  });
  const capFor = (id: string) => {
    const matches = release.affixCaps.filter(
      (c) =>
        c.affixId === id &&
        c.quality === def.quality &&
        c.tierId === def.tierId &&
        c.tuningStage === o.tuningStage,
    );
    return matches.length === 1 ? matches[0] : undefined;
  };
  const combinationValid = (ids: string[]) =>
    ids.length >= rules.minAffixes &&
    ids.length <= rules.maxAffixes &&
    ids.every((id) => def.allowedAffixIds.includes(id)) &&
    rules.exclusionGroups.every(
      (g) => ids.filter((id) => g.includes(id)).length <= 1,
    );
  if (new Set(def.allowedAffixIds).size !== def.allowedAffixIds.length) {
    result.issues.push('詞條池重複，無法確認完整組合');
    return result;
  }
  if (o.mode === 'PERFECT_LEGAL') {
    if (
      !def.baseStats.length ||
      def.baseStats.some((s) => s.value.status !== 'RECORDED')
    ) {
      result.issues.push('缺少明確同品質基礎屬性');
      return result;
    }
    for (const id of def.allowedAffixIds) {
      const cap = capFor(id);
      if (
        !cap ||
        cap.maximum.status !== 'RECORDED' ||
        cap.minimum?.status !== 'RECORDED' ||
        !cap.precisionVerified ||
        cap.step === null ||
        cap.roundingRule === null
      ) {
        result.issues.push('缺少完整明確當階上限/下限/步進：' + id);
        return result;
      }
    }
  }
  const templates: { ids: string[]; base?: EquipmentInstance }[] = [];
  if (o.mode === 'MODIFY_OWNED') {
    const checked = EquipmentInstanceSchema.safeParse(source);
    if (
      !checked.success ||
      checked.data.gameVersionId !== release.version.id ||
      checked.data.definitionId !== def.id ||
      checked.data.tierId !== def.tierId ||
      checked.data.quality !== def.quality ||
      checked.data.slotId !== def.slotId ||
      checked.data.tuningStage !== o.tuningStage ||
      o.mutableAffixIds.some(
        (id) => !checked.data.affixes.some((a) => a.affixId === id),
      ) ||
      o.affixes.some((a) => !o.mutableAffixIds.includes(a.id))
    ) {
      result.issues.push('微調來源身份不符，或嘗試修改未授權詞條');
      return result;
    }
    templates.push({
      ids: checked.data.affixes.map((a) => a.affixId),
      base: checked.data,
    });
  } else if (o.mode === 'TARGET_AFFIX')
    templates.push({ ids: o.affixes.map((a) => a.id) });
  else {
    if (def.allowedAffixIds.length > 24) {
      result.issues.push('詞條池超出本次枚舉上限24，請使用指定詞條');
      return result;
    }
    let visited = 0,
      stopped = false;
    const walk = (start: number, ids: string[]) => {
      if (++visited > 20000 || templates.length >= 256) {
        stopped = true;
        return;
      }
      if (ids.length >= rules.minAffixes) templates.push({ ids: [...ids] });
      if (ids.length >= rules.maxAffixes) return;
      for (let i = start; i < def.allowedAffixIds.length && !stopped; i++) {
        const next = [...ids, def.allowedAffixIds[i]];
        if (
          rules.exclusionGroups.every(
            (g) => next.filter((id) => g.includes(id)).length <= 1,
          )
        )
          walk(i + 1, next);
      }
    };
    walk(0, []);
    result.combinationsComplete = !stopped;
    if (stopped) result.issues.push('枚舉已截斷，不能宣稱完整或最優');
    if (o.mode === 'RANDOM_LEGAL' && stopped) return result;
  }
  let state = o.seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let chosen = templates;
  if (o.mode === 'RANDOM_LEGAL') {
    // Verify the entire selection space before selecting, never bias around unknown rules.
    for (const id of def.allowedAffixIds) {
      const cap = capFor(id);
      const min = cap?.minimum,
        max = cap?.maximum;
      const steps =
        cap &&
        min?.status === 'RECORDED' &&
        max?.status === 'RECORDED' &&
        cap.step !== null
          ? (max.value - min.value) / cap.step
          : NaN;
      if (
        !cap?.precisionVerified ||
        cap.roundingRule === null ||
        !Number.isSafeInteger(Math.round(steps)) ||
        Math.abs(steps - Math.round(steps)) > 1e-8 ||
        steps < 0 ||
        steps >= 4294967296
      ) {
        result.issues.push('隨機模式缺少已驗證有限步進網格：' + id);
        return result;
      }
    }
    chosen = templates.length
      ? [templates[Math.floor(random() * templates.length)]]
      : [];
  }
  if (!chosen.length) {
    result.issues.push('沒有符合條件的詞條組合');
    return result;
  }
  const requestJson = JSON.stringify({
    ...o,
    gameVersionId: release.version.id,
    sourceId: source?.id ?? null,
  });
  for (const template of chosen) {
    if (!combinationValid(template.ids)) {
      result.issues.push('詞條數量、可用池或互斥組合不合法');
      continue;
    }
    const item: EquipmentInstance = template.base
      ? structuredClone(template.base)
      : {
          id: o.idPrefix,
          gameVersionId: release.version.id,
          definitionId: def.id,
          name: def.name,
          slotId: def.slotId,
          tierId: def.tierId,
          quality: def.quality,
          tuningStage: o.tuningStage,
          isChengYin: o.valueMode === 'CHENG_YIN',
          creationMethod: 'GENERATED',
          evidenceIds: [o.idPrefix + '-scenario'],
          baseStats: [],
          affixes: [],
          validation: { status: 'UNVERIFIED', reasons: [] },
        };
    item.id = o.idPrefix + '-' + result.candidates.length;
    if (template.base) item.derivedFromId = template.base.id;
    item.evidenceIds = [
      ...new Set([...item.evidenceIds, o.idPrefix + '-scenario']),
    ];
    item.creationMethod = 'GENERATED';
    item.createdAt = o.evaluatedAt;
    item.updatedAt = o.evaluatedAt;
    item.imageIds = [];
    item.onlyExplicit = o.onlyExplicit || template.base?.onlyExplicit === true;
    item.generation = {
      mode: o.mode,
      algorithmVersion: 'equipment-generation-v1/mulberry32-v1',
      seed: o.mode === 'RANDOM_LEGAL' ? o.seed : null,
      requestJson,
      note: result.note,
    };
    if (
      o.valueMode === 'CHENG_YIN' &&
      (!template.base || o.mutableAffixIds.length)
    )
      item.isChengYin = true;
    item.affixes = template.ids.map((id) => {
      const old = template.base?.affixes.find((a) => a.affixId === id);
      if (old && !o.mutableAffixIds.includes(id)) return structuredClone(old);
      const cap = capFor(id);
      let value = o.affixes.find((a) => a.id === id)?.value ?? null;
      if (o.mode === 'RANDOM_LEGAL' && o.valueMode === 'MANUAL') {
        const min = cap!.minimum!.value!,
          max = cap!.maximum.value!;
        value =
          min +
          Math.floor(random() * (Math.round((max - min) / cap!.step!) + 1)) *
            cap!.step!;
      }
      return {
        affixId: id,
        valueMode: o.mode === 'PERFECT_LEGAL' ? 'MAX' : o.valueMode,
        maxOnChengYinConfirmed: true,
        current:
          value !== null && o.valueMode === 'MANUAL'
            ? selected(value)
            : unknown(),
        effective: unknown(),
        maximum: unknown(),
      };
    });
    const resolved = resolveEquipment(item, release, {
      onlyExplicit: item.onlyExplicit,
      estimatedAt: o.evaluatedAt,
    });
    if (resolved.equipment.validation.status === 'INVALID') {
      result.issues.push(...resolved.equipment.validation.reasons);
      continue;
    }
    result.candidates.push(resolved.equipment);
  }
  result.status = !result.candidates.length
    ? 'BLOCKED'
    : result.issues.length ||
        result.candidates.some((c) => c.validation.status !== 'VALID')
      ? 'PARTIAL'
      : 'READY';
  return result;
}
