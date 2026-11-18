import {
  MeasurementSchema,
  type PlayerArchive,
  type Measurement,
} from '@wwm/game-data';
export type MeasurementFields = {
  label: string;
  kind: Measurement['kind'];
  skillId: string;
  variantId: string;
  enemyName: string;
  enemyLevel: string;
  enemyConditions: string;
  conditions: string;
  sampling: 'UNFILTERED_CAST_TOTAL' | 'FILTERED_OR_PARTIAL';
  samplesText: string;
  source: string;
  evidenceKind: 'TEXT' | 'SCREENSHOT_REFERENCE';
  comparisonContextConfirmed: boolean;
  confirmed: boolean;
};
export function createMeasurement(
  archive: PlayerArchive,
  buildId: string,
  fields: MeasurementFields,
): Measurement {
  const build = archive.builds.find((b) => b.id === buildId);
  const character = archive.characters.find((c) => c.id === build?.characterId);
  const release = archive.dataReleases.find(
    (r) => r.version.id === character?.gameVersionId,
  );
  if (!build || !character || !release)
    throw new Error('請先選擇具版本資料的配置。');
  const lines = fields.samplesText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const samples = lines.map((line) => {
    if (
      !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(line) ||
      !Number.isFinite(Number(line))
    )
      throw new Error(
        '每行只能輸入一筆非負有限傷害，不能輸入逗號、範圍或缺字。',
      );
    return Number(line);
  });
  const at = new Date().toISOString();
  const parsed = MeasurementSchema.safeParse({
    id: crypto.randomUUID(),
    label: fields.label,
    purpose:
      release.purpose === 'SYNTHETIC_TEST'
        ? 'SYNTHETIC_TEST'
        : 'GAME_MEASUREMENT',
    kind: fields.kind,
    recordedAt: at,
    status: 'OBSERVATION_ONLY',
    snapshot: {
      character,
      build,
      release,
      equipment: archive.equipment.filter((e) =>
        build.equipmentIds.includes(e.id),
      ),
      onlyExplicit: false,
      evaluatedAt: at,
    },
    skillId: fields.kind === 'SINGLE_SKILL' ? fields.skillId : null,
    variantId: fields.kind === 'SINGLE_SKILL' ? fields.variantId || null : null,
    enemy: {
      name: fields.enemyName,
      level: fields.enemyLevel.trim() === '' ? null : Number(fields.enemyLevel),
      conditions: fields.enemyConditions,
    },
    conditions: fields.conditions,
    samples,
    sampling:
      fields.kind === 'ROTATION_60S' ? 'ROTATION_TOTAL' : fields.sampling,
    durationMs: fields.kind === 'ROTATION_60S' ? 60000 : null,
    evidence: [{ kind: fields.evidenceKind, reference: fields.source }],
    comparisonContextConfirmed: fields.comparisonContextConfirmed,
    confirmed: fields.confirmed,
  });
  if (!parsed.success)
    throw new Error(
      '紀錄條件或快照不完整：請核對版本、合法等級、技能變體、樣本與來源，並勾選確認。',
    );
  return parsed.data;
}
