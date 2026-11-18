import {
  BuildSchema,
  CharacterSchema,
  EquipmentInstanceSchema,
  GameDataReleaseSchema,
  resolveEquipment,
  summarizeProvenance,
  type Build,
  type Character,
  type EquipmentInstance,
  type GameDataRelease,
  type ResolvedValue,
  type ResultProvenance,
} from '@wwm/game-data';

export type EngineRequest = {
  build: Build;
  character: Character;
  equipment: EquipmentInstance[];
  release?: GameDataRelease;
  onlyExplicit: boolean;
  evaluatedAt: string;
};
export type Contribution = { id: string; label: string; value: ResolvedValue };
export type DerivedValue = {
  value: number | null;
  status: 'EXPLICIT' | 'ESTIMATED' | 'UNKNOWN';
  provenance: ResultProvenance;
  dependencies: Record<string, ResolvedValue>;
};
export type AggregatedStat = DerivedValue & {
  statId: string;
  unit: string;
  contributions: Contribution[];
};
export type Aggregation = {
  gameVersionId: string | null;
  stats: Record<string, AggregatedStat>;
  issues: string[];
  warnings: string[];
};
const unknown = (version: string | null, reason: string): ResolvedValue => ({
  status: 'UNKNOWN',
  gameVersionId: version,
  value: null,
  reason,
});
export function traceValues(
  dependencies: Record<string, ResolvedValue>,
  version: string,
  onlyExplicit: boolean,
  issues: string[] = [],
  extraEstimates: string[] = [],
): {
  dependencies: Record<string, ResolvedValue>;
  provenance: ResultProvenance;
} {
  const filtered = Object.fromEntries(
    Object.entries(dependencies).map(([id, value]) => [
      id,
      onlyExplicit && value.status === 'ESTIMATED'
        ? unknown(value.gameVersionId, '僅使用明確資料：禁止預估')
        : structuredClone(value),
    ]),
  );
  const p = summarizeProvenance(filtered, Object.keys(filtered), version);
  const blockingUnknowns = [
    ...new Set([
      ...p.blockingUnknowns,
      ...issues,
      ...(onlyExplicit ? extraEstimates : []),
    ]),
  ];
  const estimatedDependencies = [
    ...new Set([
      ...p.estimatedDependencies,
      ...(!onlyExplicit ? extraEstimates : []),
    ]),
  ];
  return {
    dependencies: filtered,
    provenance: {
      ...p,
      canCalculate: blockingUnknowns.length === 0,
      containsEstimates: estimatedDependencies.length > 0,
      blockingUnknowns,
      estimatedDependencies,
      label: blockingUnknowns.length
        ? '無法計算'
        : estimatedDependencies.length
          ? '包含預估資料'
          : '明確資料',
    },
  };
}
function sum(
  contributions: Contribution[],
  version: string,
  onlyExplicit: boolean,
  issues: string[],
): DerivedValue {
  const traced = traceValues(
    Object.fromEntries(contributions.map((c) => [c.id, c.value])),
    version,
    onlyExplicit,
    issues,
  );
  const total = traced.provenance.canCalculate
    ? Object.values(traced.dependencies).reduce((a, v) => a + v.value!, 0)
    : null;
  if (total !== null && !Number.isFinite(total)) {
    traced.provenance.canCalculate = false;
    traced.provenance.blockingUnknowns.push('屬性加總超出有限數值範圍');
    traced.provenance.label = '無法計算';
  }
  const value = traced.provenance.canCalculate ? total : null;
  return {
    ...traced,
    value,
    status:
      value === null
        ? 'UNKNOWN'
        : traced.provenance.containsEstimates
          ? 'ESTIMATED'
          : 'EXPLICIT',
  };
}
export function aggregateStats(request: EngineRequest): Aggregation {
  const issues: string[] = [];
  const warnings: string[] = [];
  const { build, character, release } = request;
  const result: Aggregation = {
    gameVersionId: character.gameVersionId,
    stats: {},
    issues,
    warnings,
  };
  if (
    !BuildSchema.safeParse(build).success ||
    !CharacterSchema.safeParse(character).success ||
    (release && !GameDataReleaseSchema.safeParse(release).success)
  ) {
    issues.push('輸入資料契約無效');
    return result;
  }
  if (!Number.isFinite(Date.parse(request.evaluatedAt))) {
    issues.push('計算日期無效');
    return result;
  }
  if (!release || release.version.id !== character.gameVersionId) {
    issues.push('缺少相同版本的資料包');
    return result;
  }
  const version = release.version.id;
  if (build.characterId !== character.id) issues.push('配置不屬於此角色');
  if (
    character.level === null ||
    !release.version.availableLevels.includes(character.level)
  )
    issues.push('缺少合法角色等級');
  if (!release.paths.some((p) => p.id === character.pathId))
    issues.push('流派不屬於此版本');
  if (build.panelMode === 'UNKNOWN') issues.push('尚未確認面板是否包含裝備');
  if (new Set(build.stats.map((s) => s.statId)).size !== build.stats.length)
    issues.push('面板有重複屬性');
  if (new Set(build.equipmentIds).size !== build.equipmentIds.length)
    issues.push('配置重複引用裝備');
  if (
    build.innerWays.length ||
    build.mysticSkillIds.length ||
    build.talentIds.length
  )
    issues.push('已配置心法／奇術／天賦尚缺效果規則，不可省略其影響');
  for (const stat of build.stats) {
    if (!release.stats.some((s) => s.id === stat.statId))
      issues.push('面板屬性未定義：' + stat.statId);
  }
  const contributions = new Map<string, Contribution[]>();
  for (const stat of release.stats) {
    contributions.set(stat.id, [
      {
        id: 'panel:' + stat.id,
        label:
          build.panelMode === 'EQUIPMENT_INCLUDED'
            ? '已含裝備面板'
            : '角色基礎面板',
        value:
          build.stats.find((s) => s.statId === stat.id)?.value ??
          unknown(version, '缺少明確面板值，不能假設基礎為0'),
      },
    ]);
  }
  if (build.panelMode === 'EQUIPMENT_INCLUDED') {
    warnings.push(
      '使用已含裝備的面板，未再次加上裝備數值；裝備清單及其未知值不參與本次屬性合成',
    );
  } else if (build.panelMode === 'BASE_ONLY') {
    const slots = new Set<string>();
    for (const id of [...build.equipmentIds].sort()) {
      const matches = request.equipment.filter((e) => e.id === id);
      const item = matches.length === 1 ? matches[0] : undefined;
      if (!item || !EquipmentInstanceSchema.safeParse(item).success) {
        issues.push('裝備缺失、重複或契約無效：' + id);
        continue;
      }
      if (item.gameVersionId !== version) {
        issues.push('裝備版本不符：' + id);
        continue;
      }
      if (!item.slotId || slots.has(item.slotId))
        issues.push('裝備部位未知或重複：' + id);
      if (item.slotId) slots.add(item.slotId);
      const resolved = resolveEquipment(item, release, {
        onlyExplicit: request.onlyExplicit || item.onlyExplicit === true,
        estimatedAt: request.evaluatedAt,
      });
      warnings.push(...resolved.warnings);
      if (resolved.equipment.validation.status === 'INVALID')
        issues.push('裝備不合法：' + id);
      else if (resolved.equipment.validation.status === 'UNVERIFIED')
        warnings.push(
          '裝備 ' + id + ' 尚未通過完整合法性驗證；本次只作數值預覽',
        );
      const definitions = release.equipment.filter(
        (d) =>
          (item.definitionId === undefined || d.id === item.definitionId) &&
          d.slotId === item.slotId &&
          d.tierId === item.tierId &&
          d.quality === item.quality,
      );
      if (definitions.length !== 1)
        issues.push('缺少唯一裝備定義，無法確認屬性完整性：' + id);
      const definition = definitions.length === 1 ? definitions[0] : undefined;
      if (definition?.requiredLevel === null)
        issues.push('裝備等級門檻未知：' + id);
      if (
        definition?.requiredLevel !== undefined &&
        definition.requiredLevel !== null &&
        (character.level === null || character.level < definition.requiredLevel)
      )
        issues.push('角色未達裝備等級門檻：' + id);
      for (const base of resolved.equipment.effectiveBaseStats ?? []) {
        if (!contributions.has(base.statId)) {
          issues.push('裝備基礎屬性未定義：' + base.statId);
          continue;
        }
        contributions.get(base.statId)!.push({
          id: 'gear:' + id + ':base:' + base.statId,
          label: (item.name ?? id) + ' 基礎屬性',
          value: base.value,
        });
      }
      for (const affix of resolved.equipment.affixes) {
        const def = release.affixes.find((a) => a.id === affix.affixId);
        if (!def || !contributions.has(def.statId)) {
          issues.push('缺少詞條屬性對應：' + affix.affixId);
          continue;
        }
        contributions.get(def.statId)!.push({
          id: 'gear:' + id + ':affix:' + affix.affixId,
          label: (item.name ?? id) + ' 詞條 ' + def.name,
          value: affix.effective,
        });
      }
    }
  }
  if (build.panelMode === 'BASE_ONLY') {
    const counts = new Map<string, number>();
    for (const id of build.equipmentIds) {
      const item = request.equipment.find((e) => e.id === id);
      const definition = item?.definitionId
        ? release.equipment.find((d) => d.id === item.definitionId)
        : release.equipment.find(
            (d) =>
              d.slotId === item?.slotId &&
              d.tierId === item?.tierId &&
              d.quality === item?.quality,
          );
      if (definition?.setId)
        counts.set(definition.setId, (counts.get(definition.setId) ?? 0) + 1);
    }
    for (const [id, count] of counts) {
      const set = release.equipmentSets?.find((s) => s.id === id);
      if (!set?.verified) {
        issues.push('套裝完整效果未驗證：' + id);
        continue;
      }
      for (const bonus of set.bonuses.filter((b) => b.pieces <= count))
        for (const stat of bonus.stats) {
          contributions.get(stat.statId)?.push({
            id: 'set:' + id + ':' + bonus.pieces + ':' + stat.statId,
            label: set.name + ' ' + bonus.pieces + '件',
            value: stat.value,
          });
        }
    }
  }
  for (const stat of release.stats) {
    const list = contributions.get(stat.id)!;
    result.stats[stat.id] = {
      statId: stat.id,
      unit: stat.unit,
      contributions: structuredClone(list),
      ...sum(list, version, request.onlyExplicit, issues),
    };
  }
  return result;
}
