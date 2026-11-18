import {
  BuildSchema,
  unsupportedPathHandlers,
  CharacterSchema,
  GameDataReleaseSchema,
  RotationPlanSchema,
  type RotationPlan,
  type RotationAction,
  type CombatSkill,
  type ResolvedValue,
  type GameDataRelease,
} from '@wwm/game-data';
import {
  calculateDamage,
  traceValues,
  type EngineRequest,
  type DamageResult,
} from '@wwm/stat-engine';
import { EventQueue } from './queue.js';
export type CombatRequest = EngineRequest & { plan: RotationPlan };
type CastData = {
  action: Extract<RotationAction, { kind: 'CAST' }>;
  skill: GameDataRelease['skills'][number];
  variant:
    | NonNullable<GameDataRelease['skills'][number]['variants']>[number]
    | undefined;
  profile: CombatSkill;
  damage: DamageResult;
};
type Buff = { expires: number; value: ResolvedValue };
type Dot = {
  expires: number;
  token: number;
  snapshot?: DamageResult;
  buffs?: Record<string, ResolvedValue>;
};
type Event = {
  atMs: number;
  sequence: number;
  kind: 'ACTION' | 'DECIDE' | 'HIT' | 'EFFECT' | 'LEGACY' | 'DOT';
  action?: RotationAction;
  cast?: CastData;
  hitIndex?: number;
  castEpoch?: number;
  effect?: CombatSkill['effects'][number];
  legacy?: NonNullable<CastData['variant']>['events'][number];
  dotId?: string;
  token?: number;
  snapshotBuffs?: Record<string, ResolvedValue>;
};
export type CombatTrace = {
  atMs: number;
  sequence: number;
  kind: string;
  detail: string;
  damage: number | null;
  resources: Record<string, number>;
  martialArtId: string;
};
export function runRotation(input: CombatRequest, random?: () => number) {
  const issues: string[] = [],
    warnings: string[] = [],
    extraEstimates: string[] = [];
  const dependencies: Record<string, ResolvedValue> = {},
    trace: CombatTrace[] = [],
    bySkill: Record<string, number> = {};
  const resources: Record<string, number> = {},
    maxima: Record<string, number> = {};
  let invalid = false,
    total = 0,
    weapon = input.plan.initialMartialArtId,
    busyUntil = 0,
    nextSequence = 0,
    tokenSequence = 0,
    weaponEpoch = 0;
  const cooldowns = new Map<string, number>(),
    buffs = new Map<string, Buff>(),
    dots = new Map<string, Dot>();
  const queue = new EventQueue<Event>(),
    prepared = new Map<string, CastData>();
  const onlyExplicit = input.onlyExplicit || input.plan.onlyExplicit,
    request = { ...input, onlyExplicit };
  const fail = (reason: string, isInvalid = false) => {
    issues.push(reason);
    invalid ||= isInvalid;
  };
  const time = (at: number, delta: number) => {
    const n = at + delta;
    if (!Number.isSafeInteger(n)) fail('事件時間溢位', true);
    return n;
  };
  const record = (
    atMs: number,
    kind: string,
    detail: string,
    damage: number | null = null,
  ) => {
    trace.push({
      atMs,
      sequence: trace.length,
      kind,
      detail,
      damage,
      resources: { ...resources },
      martialArtId: weapon,
    });
  };
  const schedule = (event: Omit<Event, 'sequence'>) => {
    if (!Number.isSafeInteger(event.atMs) || event.atMs < 0) {
      fail('事件時間溢位', true);
      return;
    }
    if (event.atMs < input.plan.durationMs)
      queue.push({ ...event, sequence: nextSequence++ });
  };
  const take = (id: string, value: ResolvedValue): number | null => {
    dependencies[id] = value;
    if (
      value.gameVersionId !== input.plan.gameVersionId ||
      value.status === 'UNKNOWN' ||
      (onlyExplicit && value.status === 'ESTIMATED')
    ) {
      fail('必要數值未知或禁止推估：' + id);
      return null;
    }
    return value.value;
  };
  const parsedPlan = RotationPlanSchema.safeParse(input.plan),
    parsedRelease = GameDataReleaseSchema.safeParse(input.release);
  const release = parsedRelease.success ? parsedRelease.data : undefined,
    rules = release?.combat;
  if (!parsedPlan.success || !parsedRelease.success)
    fail('循環或版本資料契約無效', true);
  if (
    release?.version.id !== input.plan.gameVersionId ||
    input.character.gameVersionId !== input.plan.gameVersionId
  )
    fail('循環/角色/資料版本不符', true);
  const path = release?.paths.find((p) => p.id === input.character.pathId);
  if (unsupportedPathHandlers(path?.requiredHandlerIds).length)
    fail(
      '未支援此流派必要機制：' +
        unsupportedPathHandlers(path?.requiredHandlerIds).join('、'),
    );
  const validArt = (id: string) =>
    !!path?.martialArtIds.includes(id) &&
    input.build.martialArts.some((a) => a.id === id && a.level !== null);
  if (
    !BuildSchema.safeParse(input.build).success ||
    !CharacterSchema.safeParse(input.character).success ||
    input.build.characterId !== input.character.id ||
    input.character.level === null ||
    !release?.version.availableLevels.includes(input.character.level)
  )
    fail('角色/配置契約、所屬或等級不符', true);
  if (!validArt(weapon)) fail('初始武學不屬於此配置', true);
  if (!rules || rules.evidence.status === 'UNKNOWN')
    fail('缺少已驗證或已登記推估的戰鬥規則');
  if (rules?.evidence.status === 'ESTIMATED') {
    extraEstimates.push(
      'combat:' + rules.ruleVersion + ':' + rules.evidence.modelVersion,
    );
    if (onlyExplicit) fail('僅使用明確資料：戰鬥規則為預估');
  }
  const prepare = (
    action: Extract<RotationAction, { kind: 'CAST' }>,
  ): CastData | undefined => {
    const key = action.skillId + ':' + (action.variantId ?? 'base');
    if (prepared.has(key)) return prepared.get(key);
    const skill = release?.skills.find((s) => s.id === action.skillId),
      variant = action.variantId
        ? skill?.variants?.find((v) => v.id === action.variantId)
        : undefined;
    const profile =
      variant?.combat ?? (!skill?.variants?.length ? skill?.combat : undefined);
    if (!skill || !profile) {
      fail('缺少所選技能/變體的戰鬥規則：' + key);
      return;
    }
    if (profile.castDurationMs === null || profile.cooldownMs === null)
      fail('施放時間或冷卻未知：' + key);
    if (
      variant &&
      (variant.chargeMs === null ||
        profile.castDurationMs === null ||
        profile.castDurationMs < variant.chargeMs)
    )
      fail('蓄力時間未知或超過宣告施放時間：' + key);
    if (
      (variant?.hits ?? skill.hits).some((h) => h.offsetMs === null) ||
      profile.effects.some((e) => e.offsetMs === null) ||
      variant?.events.some((e) => e.offsetMs === null)
    )
      fail('命中或效果時間未知：' + key);
    const damage = calculateDamage({
      ...request,
      skillId: action.skillId,
      ...(action.variantId ? { variantId: action.variantId } : {}),
    });
    if (damage.expectedDamage === null)
      fail(
        '技能傷害無法計算：' +
          key +
          '：' +
          damage.provenance.blockingUnknowns.join('、'),
      );
    warnings.push(...damage.warnings);
    const value = { action, skill, variant, profile, damage };
    prepared.set(key, value);
    return value;
  };
  const allActions =
    input.plan.mode === 'FIXED'
      ? input.plan.actions.map((a) => a.action)
      : input.plan.priorityRules.map((r) => r.action);
  for (const action of allActions) {
    if (action.kind === 'CAST') prepare(action);
    else if (!validArt(action.martialArtId) || rules?.switchDurationMs === null)
      fail('切換武學不合法或時間未知', !validArt(action.martialArtId));
  }
  for (const rule of input.plan.priorityRules)
    if (
      [...rule.requiredBuffIds, ...rule.forbiddenBuffIds].some(
        (id) => !rules?.buffs.some((b) => b.id === id),
      ) ||
      (rule.resourceId !== null &&
        !rules?.resources.some((r) => r.id === rule.resourceId))
    )
      fail('優先序條件缺少狀態或資源定義', true);
  if (rules)
    for (const resource of rules.resources) {
      const initial = take(
          'resource:' + resource.id + ':initial',
          resource.initial,
        ),
        maximum = take(
          'resource:' + resource.id + ':maximum',
          resource.maximum,
        );
      if (initial !== null && maximum !== null) {
        if (initial < 0 || maximum < 0 || initial > maximum)
          fail('初始資源不在合法範圍：' + resource.id, true);
        resources[resource.id] = initial;
        maxima[resource.id] = maximum;
      }
    }
  const expire = (at: number) => {
    for (const [id, buff] of buffs)
      if (buff.expires <= at) {
        buffs.delete(id);
        record(buff.expires, 'BUFF_EXPIRE', id);
      }
    for (const [id, dot] of dots)
      if (dot.expires <= at) {
        dots.delete(id);
        record(dot.expires, 'DOT_EXPIRE', id);
      }
  };
  const capture = () =>
    Object.fromEntries([...buffs].map(([id, b]) => [id, b.value]));
  const deal = (
    at: number,
    key: string,
    base: number,
    damage: DamageResult,
    active: Record<string, ResolvedValue>,
    hitIndex?: number,
  ) => {
    Object.assign(
      dependencies,
      Object.fromEntries(
        Object.entries(damage.dependencies).map(([id, value]) => [
          'damage:' + key + ':' + id,
          value,
        ]),
      ),
    );
    extraEstimates.push(
      ...damage.provenance.estimatedDependencies.map(
        (id) => 'damage:' + key + ':' + id,
      ),
    );
    let factor = 1;
    for (const [id, value] of Object.entries(active)) {
      const multiplier = take('buff:' + id, value);
      if (multiplier === null || multiplier < 0) {
        if (multiplier !== null) fail('Buff倍率不可為負數：' + id, true);
        return;
      }
      factor *= multiplier;
    }
    if (random) {
      if (!damage.outcomes) {
        fail('缺少命中分布');
        return;
      }
      const hits =
        hitIndex === undefined ? damage.hits : [damage.hits[hitIndex]];
      base = 0;
      for (const hit of hits) {
        const draw = random();
        if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
          fail('PRNG輸出不合法', true);
          return;
        }
        let cumulative = 0;
        const outcome =
          damage.outcomes.find((o) => {
            cumulative += o.probability;
            return draw < cumulative;
          }) ?? damage.outcomes[damage.outcomes.length - 1];
        base += hit.baseDamage! * outcome.multiplier;
      }
    }
    const value = base * factor;
    if (!Number.isFinite(value) || !Number.isFinite(total + value)) {
      fail('傷害總和溢位');
      return;
    }
    total += value;
    bySkill[key] = (bySkill[key] ?? 0) + value;
    record(at, 'DAMAGE', key, value);
  };
  const applyBuff = (id: string, at: number) => {
    const def = rules?.buffs.find((b) => b.id === id);
    if (!def || def.durationMs === null) {
      fail('Buff持續時間未知：' + id);
      return;
    }
    if (buffs.has(id) && def.reapply === 'REJECT') {
      fail('Buff不允許重套用：' + id, true);
      return;
    }
    buffs.set(id, { expires: time(at, def.durationMs), value: def.multiplier });
    record(at, 'BUFF_APPLY', id);
  };
  const changeResource = (id: string, delta: number, at: number) => {
    if (!(id in resources) || resources[id] + delta < 0) {
      fail('資源不足或未定義：' + id, true);
      return;
    }
    resources[id] = Math.min(maxima[id], resources[id] + delta);
    record(at, 'RESOURCE', id);
  };
  const switchWeapon = (id: string, at: number) => {
    if (
      !validArt(id) ||
      rules?.switchDurationMs === null ||
      rules?.switchDurationMs === undefined
    ) {
      fail('切換目標或時間未知', !validArt(id));
      return;
    }
    if (weapon !== id) weaponEpoch++;
    weapon = id;
    busyUntil = Math.max(busyUntil, time(at, rules.switchDurationMs));
    record(at, 'WEAPON_SWITCH', id);
  };
  const dotDamage = (id: string) => {
    const def = rules!.dots.find((d) => d.id === id)!;
    return calculateDamage({
      ...request,
      skillId: def.skillId,
      ...(def.variantId ? { variantId: def.variantId } : {}),
    });
  };
  const applyDot = (id: string, at: number) => {
    const def = rules?.dots.find((d) => d.id === id);
    if (
      !def ||
      def.durationMs === null ||
      def.intervalMs === null ||
      def.firstTickMs === null
    ) {
      fail('DOT時間規則未知：' + id);
      return;
    }
    if (dots.has(id) && def.reapply === 'REJECT') {
      fail('DOT不允許重套用：' + id, true);
      return;
    }
    const dot: Dot = {
        expires: time(at, def.durationMs),
        token: tokenSequence++,
      },
      first = time(at, def.firstTickMs);
    if (
      first < dot.expires &&
      first < input.plan.durationMs &&
      def.scaling === 'SNAPSHOT'
    ) {
      dot.snapshot = dotDamage(id);
      dot.buffs = capture();
    }
    dots.set(id, dot);
    record(at, 'DOT_APPLY', id);
    if (first < dot.expires)
      schedule({ atMs: first, kind: 'DOT', dotId: id, token: dot.token });
  };
  const readiness = (action: RotationAction, at: number): string | null => {
    if (at < busyUntil) return '施放/切換尚未完成';
    if (action.kind === 'SWITCH')
      return weapon === action.martialArtId ? '已是目前武學' : null;
    const cast = prepare(action);
    if (!cast) return '缺少戰鬥規則';
    if (cast.skill.martialArtId !== weapon) return '目前武學不符';
    if ((cooldowns.get(cast.profile.cooldownGroupId) ?? 0) > at)
      return '冷卻尚未結束';
    if (cast.variant?.requiredStateIds.some((id) => !buffs.has(id)))
      return '缺少必要狀態';
    if (cast.profile.swordEnergyMode === 'REQUIRE_MINIMUM') {
      const id = rules?.swordEnergyResourceId,
        energy = cast.variant?.swordEnergy;
      if (!id || !energy) {
        fail('缺少劍氣門檻規則');
        return '劍氣門檻未知';
      }
      const minimum = take(
        'skill:' +
          cast.skill.id +
          ':' +
          (cast.action.variantId ?? 'base') +
          ':energy',
        energy,
      );
      if (minimum === null) return '劍氣門檻未知';
      if (resources[id] < minimum) return '劍氣不足';
    }
    for (const r of cast.profile.resourceChanges) {
      const delta = take(
        'skill:' +
          cast.skill.id +
          ':' +
          (cast.action.variantId ?? 'base') +
          ':resource:' +
          r.resourceId,
        r.delta,
      );
      if (delta === null) return '資源變化未知';
      if (resources[r.resourceId] + delta < 0) return '資源不足';
    }
    return null;
  };
  const execute = (action: RotationAction, at: number) => {
    if (action.kind === 'SWITCH') {
      switchWeapon(action.martialArtId, at);
      return;
    }
    const cast = prepare(action)!;
    busyUntil = time(at, cast.profile.castDurationMs!);
    cooldowns.set(
      cast.profile.cooldownGroupId,
      time(
        cast.profile.cooldownStart === 'CAST_START' ? at : busyUntil,
        cast.profile.cooldownMs!,
      ),
    );
    for (const r of cast.profile.resourceChanges)
      changeResource(r.resourceId, r.delta.value!, at);
    record(at, 'CAST', cast.skill.id + ':' + (action.variantId ?? 'base'));
    const snapshotBuffs =
      cast.profile.scaling === 'SNAPSHOT' ? capture() : undefined;
    (cast.variant?.hits ?? cast.skill.hits).forEach((hit, i) =>
      schedule({
        atMs: time(at, hit.offsetMs!),
        kind: 'HIT',
        cast,
        hitIndex: i,
        castEpoch: weaponEpoch,
        snapshotBuffs,
      }),
    );
    cast.profile.effects.forEach((effect) =>
      schedule({ atMs: time(at, effect.offsetMs!), kind: 'EFFECT', effect }),
    );
    cast.variant?.events.forEach((legacy) =>
      schedule({
        atMs: time(at, legacy.offsetMs!),
        kind: 'LEGACY',
        legacy,
        cast,
      }),
    );
  };
  if (!issues.length) {
    if (input.plan.mode === 'FIXED')
      input.plan.actions.forEach((a) =>
        schedule({ atMs: a.atMs, kind: 'ACTION', action: a.action }),
      );
    else schedule({ atMs: 0, kind: 'DECIDE' });
  }
  let processed = 0;
  while (queue.size && !issues.length) {
    if (processed++ >= 10000) {
      fail('超出10000筆事件驗證上限，未輸出部分結果');
      break;
    }
    const event = queue.pop()!;
    expire(event.atMs);
    if (event.kind === 'ACTION') {
      const reason = readiness(event.action!, event.atMs);
      if (reason) {
        const unknown = issues.length > 0;
        record(event.atMs, 'REJECT', reason);
        fail('循環動作被拒絕：' + reason, !unknown);
      } else execute(event.action!, event.atMs);
    } else if (event.kind === 'DECIDE') {
      for (const rule of input.plan.priorityRules) {
        if (
          rule.requiredBuffIds.some((id) => !buffs.has(id)) ||
          rule.forbiddenBuffIds.some((id) => buffs.has(id)) ||
          (rule.resourceId !== null &&
            resources[rule.resourceId] < rule.minimum!)
        )
          continue;
        if (readiness(rule.action, event.atMs) === null) {
          execute(rule.action, event.atMs);
          break;
        }
        if (issues.length) break;
      }
      schedule({
        atMs: time(event.atMs, input.plan.decisionIntervalMs!),
        kind: 'DECIDE',
      });
    } else if (event.kind === 'HIT') {
      const cast = event.cast!;
      if (
        !cast.profile.hitsPersistAfterSwitch &&
        event.castEpoch !== weaponEpoch
      ) {
        record(event.atMs, 'HIT_CANCELLED', cast.skill.id);
        continue;
      }
      const hit = cast.damage.hits[event.hitIndex!]!;
      deal(
        event.atMs,
        cast.skill.id + ':' + hit.id,
        hit.expectedDamage!,
        cast.damage,
        event.snapshotBuffs ?? capture(),
        event.hitIndex,
      );
    } else if (event.kind === 'EFFECT') {
      const effect = event.effect!;
      if (effect.kind === 'APPLY_BUFF') applyBuff(effect.targetId, event.atMs);
      else if (effect.kind === 'REMOVE_BUFF') {
        buffs.delete(effect.targetId);
        record(event.atMs, 'BUFF_REMOVE', effect.targetId);
      } else if (effect.kind === 'APPLY_DOT')
        applyDot(effect.targetId, event.atMs);
      else {
        dots.delete(effect.targetId);
        record(event.atMs, 'DOT_REMOVE', effect.targetId);
      }
    } else if (event.kind === 'LEGACY') {
      const e = event.legacy!;
      if (e.kind === 'WEAPON_SWITCH')
        switchWeapon(e.targetMartialArtId!, event.atMs);
      else if (e.kind === 'STATE_APPLY') applyBuff(e.stateId!, event.atMs);
      else if (e.kind === 'STATE_REMOVE') {
        buffs.delete(e.stateId!);
        record(event.atMs, 'BUFF_REMOVE', e.stateId!);
      } else {
        const value = take(
          'event:' +
            event.cast!.skill.id +
            ':' +
            (event.cast!.action.variantId ?? 'base') +
            ':' +
            e.id,
          e.amount,
        );
        if (value !== null)
          changeResource(rules!.swordEnergyResourceId!, value, event.atMs);
      }
    } else if (event.kind === 'DOT') {
      const dot = dots.get(event.dotId!);
      if (!dot || dot.token !== event.token) continue;
      const damage = dot.snapshot ?? dotDamage(event.dotId!);
      if (damage.expectedDamage === null) {
        fail('DOT傷害未知：' + event.dotId);
        continue;
      }
      deal(
        event.atMs,
        'dot:' + event.dotId,
        damage.expectedDamage,
        damage,
        dot.buffs ?? capture(),
      );
      const def = rules!.dots.find((d) => d.id === event.dotId)!,
        next = time(event.atMs, def.intervalMs!);
      if (next < dot.expires)
        schedule({
          atMs: next,
          kind: 'DOT',
          dotId: event.dotId,
          token: dot.token,
        });
    }
  }
  if (!issues.length) expire(input.plan.durationMs);
  const ordered = trace
    .map((row, i) => ({ ...row, sequence: i }))
    .sort((a, b) => a.atMs - b.atMs || a.sequence - b.sequence)
    .map((row, i) => ({ ...row, sequence: i }));
  const provenance = traceValues(
    dependencies,
    input.plan.gameVersionId,
    onlyExplicit,
    issues,
    [...new Set(extraEstimates)],
  ).provenance;
  return {
    status: issues.length ? (invalid ? 'INVALID' : 'UNKNOWN') : 'VALID',
    totalExpectedDamage: provenance.canCalculate ? total : null,
    meanDps: null,
    provenance,
    dependencies,
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
    trace: ordered,
    bySkill: provenance.canCalculate ? bySkill : {},
    finalState: {
      martialArtId: weapon,
      resources,
      busyUntil,
      cooldowns: Object.fromEntries(cooldowns),
      buffIds: [...buffs.keys()],
      dotIds: [...dots.keys()],
    },
    context: {
      planId: input.plan.id,
      buildId: input.build.id,
      characterId: input.character.id,
      pathId: input.character.pathId,
      gameVersionId: input.plan.gameVersionId,
      ruleVersion: rules?.ruleVersion ?? null,
      durationMs: input.plan.durationMs,
      evaluatedAt: input.evaluatedAt,
    },
    note: '僅循環事件與期望總傷害驗證，未提供DPS、Monte Carlo或遊戲實測校準。',
  };
}
