import { unsupportedPathHandlers } from './path-handlers.js';
import type { GameDataRelease } from './schemas.js';

/** Reports declared data only; it does not infer gameplay rules or coefficients. */
export function pathCoverage(
  release: GameDataRelease | undefined,
  pathId: string,
) {
  const path = release?.paths.find((item) => item.id === pathId);
  const missing: string[] = [];
  if (!release || !path)
    return {
      pathId,
      status: 'UNKNOWN' as const,
      missing: ['缺少此流派的版本資料'],
    };
  for (const id of unsupportedPathHandlers(path.requiredHandlerIds))
    missing.push('未支援的流派機制：' + id);
  if (path.martialArtIds.length !== 2) missing.push('缺少兩門版本化武學');
  const skills = release.skills.filter((skill) =>
    path.martialArtIds.includes(skill.martialArtId),
  );
  if (!skills.length) missing.push('缺少版本化技能清單');
  if (!release.combat || release.combat.evidence.status === 'UNKNOWN')
    missing.push('戰鬥規則未知');
  for (const skill of skills) {
    const formula = release.formulas.find(
      (item) => item.id === skill.formulaId,
    );
    if (
      !formula ||
      !path.formulaIds.includes(formula.id) ||
      formula.evidence?.status === 'UNKNOWN' ||
      !formula.evidence
    )
      missing.push(skill.name + '：公式未知或未綁定');
    if (formula && formula.implementationId !== 'weighted-hit-v1')
      missing.push(skill.name + '：公式實作未支援');
    const variants = skill.variants?.length ? skill.variants : [skill];
    for (const variant of variants) {
      if (
        !variant.combat ||
        variant.combat.castDurationMs === null ||
        variant.combat.cooldownMs === null
      )
        missing.push(skill.name + '：戰鬥時間規則未知');
      if (
        !variant.hits.length ||
        variant.hits.some(
          (hit) =>
            hit.offsetMs === null ||
            hit.coefficient.status === 'UNKNOWN' ||
            hit.flatDamage.status === 'UNKNOWN',
        )
      )
        missing.push(skill.name + '：命中資料未知');
    }
  }
  return {
    pathId,
    status: missing.length ? ('UNKNOWN' as const) : ('AVAILABLE' as const),
    missing: [...new Set(missing)],
  };
}
