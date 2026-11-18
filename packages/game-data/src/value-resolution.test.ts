import { describe, expect, it } from 'vitest';
import {
  resolveValue,
  summarizeProvenance,
  valueStatusLabel,
} from './value-resolution.js';
import {
  InstanceOverrideSchema,
  type ConflictSelection,
  type ValueScope,
} from './governance-schemas.js';
import {
  approval,
  bundle,
  model,
  override,
  record,
  registry,
  reviewed,
  scope,
} from './test/governance-fixtures.js';
import { recorded, testTime, testVersion, unknown } from './test/fixtures.js';

const resolve = (
  data = bundle(),
  extra: Partial<Parameters<typeof resolveValue>[0]> = {},
) =>
  resolveValue({
    scope,
    dataset: reviewed(data),
    registry,
    estimatedAt: testTime,
    ...extra,
  });

describe('S03 numerical resolution', () => {
  it('uses recorded cheng-yin value instead of running the 94% fixture model', () => {
    const result = resolve();
    expect(result.value).toMatchObject({ status: 'RECORDED', value: 93 });
    expect(result.selectedIds).toEqual(['synthetic-record']);
  });
  it('falls back to an applicable model with all estimate metadata', () => {
    const data = bundle();
    data.records = [];
    const result = resolve(data);
    expect(result.value).toMatchObject({
      status: 'ESTIMATED',
      value: 94,
      modelVersion: 'synthetic-1',
      formulaId: 'synthetic-scale',
      estimatedAt: testTime,
      inputs: { input: 100, multiplier: 0.94 },
    });
    expect(valueStatusLabel(result.value)).toBe('預估值');
  });
  it('does not assume a 94% multiplier', () => {
    const data = bundle();
    data.records = [];
    data.models[0].multiplier = 0.8;
    expect(resolve(data).value.value).toBe(80);
  });
  it('returns UNKNOWN without model or explicit data', () => {
    const data = bundle();
    data.records = [];
    data.models = [];
    expect(resolve(data).value).toMatchObject({
      status: 'UNKNOWN',
      value: null,
    });
  });
  it('keeps stored estimated records marked estimated', () => {
    const data = bundle();
    data.models = [];
    data.records[0].value = {
      status: 'ESTIMATED',
      value: 92.123456789,
      gameVersionId: testVersion,
      formulaId: 'synthetic-scale',
      modelVersion: 'test',
      estimatedAt: testTime,
      inputs: { cap: 100 },
      sourceIds: ['synthetic-source'],
    };
    expect(resolve(data).value).toMatchObject({
      status: 'ESTIMATED',
      value: 92.123456789,
    });
  });
  it('onlyExplicit blocks stored estimates and model execution', () => {
    const data = bundle();
    data.records = [];
    expect(resolve(data, { onlyExplicit: true }).value.status).toBe('UNKNOWN');
    const estimated = resolve(data).value;
    data.models = [];
    data.records = [{ ...record(), value: estimated }];
    expect(resolve(data, { onlyExplicit: true }).value.status).toBe('UNKNOWN');
  });
  it('preserves recorded zero and raw decimals', () => {
    const data = bundle();
    data.records[0].value = recorded(0);
    expect(resolve(data).value).toMatchObject({ status: 'RECORDED', value: 0 });
    data.records[0].value = recorded(0.123456789);
    expect(resolve(data).value.value).toBe(0.123456789);
  });
  it.each([
    ['gameVersionId', 'other-version'],
    ['entityId', 'other-entity'],
    ['fieldId', 'maximum'],
    ['tierId', 'other-tier'],
    ['quality', 'other-quality'],
    ['cultivation', 'other-state'],
    ['tuningStage', 2],
    ['unit', 'percent'],
    ['precision', 3],
  ] as [keyof ValueScope, string | number][])(
    'does not mix scope field %s',
    (field, value) => {
      const changedScope = { ...scope, [field]: value };
      expect(resolve(bundle(), { scope: changedScope }).value.status).toBe(
        'UNKNOWN',
      );
    },
  );
  it('does not use null scope components as wildcards', () => {
    expect(
      resolve(bundle(), { scope: { ...scope, tierId: null } }).value.status,
    ).toBe('UNKNOWN');
  });
  it('does not infer unknown model input or allow overflow', () => {
    const data = bundle();
    data.records = [];
    data.models[0].input = unknown();
    expect(resolve(data).value).toMatchObject({
      status: 'UNKNOWN',
      reason: 'MODEL_INPUT_UNKNOWN',
    });
    data.models[0].input = recorded(Number.MAX_VALUE);
    data.models[0].multiplier = 2;
    expect(resolve(data).value).toMatchObject({
      status: 'UNKNOWN',
      reason: 'MODEL_RESULT_NOT_FINITE',
    });
  });
  it('does not silently choose between multiple models', () => {
    const data = bundle();
    data.records = [];
    data.models.push({ ...model(), id: 'another-model' });
    expect(resolve(data).value).toMatchObject({
      status: 'UNKNOWN',
      reason: 'ESTIMATE_MODEL_CONFLICT',
    });
  });
  it('does not accept rejected source or unreviewed license', () => {
    const data = bundle();
    data.sources[0].license = 'UNVERIFIED';
    expect(resolve(data).value.status).toBe('UNKNOWN');
    data.sources[0].license = 'MANUAL_ONLY';
    data.sources[0].review.decision = 'REJECT';
    expect(resolve(data).value.status).toBe('UNKNOWN');
  });
  it('rejects a rejected dataset', () => {
    expect(() =>
      resolve(bundle(), {
        dataset: {
          data: bundle(),
          review: { ...approval, decision: 'REJECT' },
        },
      }),
    ).toThrow();
  });
});

describe('source conflicts and adjudication', () => {
  function conflicting() {
    const data = bundle();
    data.records.push(record('synthetic-second', 94));
    return data;
  }
  it('does not hide conflicting records behind trust ranking or model fallback', () => {
    const result = resolve(conflicting());
    expect(result.value).toMatchObject({
      status: 'UNKNOWN',
      reason: 'RECORDED_SOURCE_CONFLICT',
    });
    expect(result.conflicts).toHaveLength(2);
  });
  it('allows an explicit review bound to the full competing records', () => {
    const data = conflicting();
    const selection: ConflictSelection = {
      scope,
      candidates: data.records,
      selectedRecordId: 'synthetic-second',
      review: approval,
    };
    expect(resolve(data, { selection }).value.value).toBe(94);
    data.records[0].value = recorded(91);
    // Selection holds old snapshots, not caller aliases.
    const oldSelection = {
      ...selection,
      candidates: [record(), record('synthetic-second', 94)],
    };
    expect(resolve(data, { selection: oldSelection }).value.status).toBe(
      'UNKNOWN',
    );
  });
  it('chooses official ahead of community only when recorded numbers agree', () => {
    const data = bundle();
    data.sources.push({
      ...data.sources[0],
      id: 'synthetic-official',
      confidence: 'OFFICIAL',
    });
    const second = record('synthetic-official-record', 93);
    second.value = {
      gameVersionId: testVersion,
      status: 'RECORDED',
      value: 93,
      sourceIds: ['synthetic-official'],
    };
    data.records.push(second);
    expect(resolve(data).selectedIds).toEqual(['synthetic-official-record']);
  });
});

describe('instance override audit', () => {
  it('uses confirmed instance value before database and preserves source data', () => {
    const data = bundle();
    const before = structuredClone(data);
    const result = resolve(data, {
      instanceId: 'synthetic-instance',
      overrides: [override()],
    });
    expect(result.value).toMatchObject({
      status: 'MANUAL_CONFIRMED',
      value: 92,
    });
    expect(result.overrideHistory[0]).toMatchObject({
      author: 'synthetic-user',
      oldValue: { value: 93 },
    });
    expect(result.warnings).toContain('MANUAL_DATABASE_DIFFERENCE');
    expect(data).toEqual(before);
    expect(
      resolve(data, { instanceId: 'another-instance', overrides: [override()] })
        .value.value,
    ).toBe(93);
  });
  it('retains override and reports changes after a database update', () => {
    const data = bundle();
    data.records[0].value = recorded(97);
    const result = resolve(data, {
      instanceId: 'synthetic-instance',
      overrides: [override()],
    });
    expect(result.value.value).toBe(92);
    expect(result.warnings).toContain('OVERRIDE_BASE_CHANGED');
  });
  it('MAX field scope does not unintentionally override current values', () => {
    const result = resolve(bundle(), {
      scope: { ...scope, fieldId: 'maximum' },
      instanceId: 'synthetic-instance',
      overrides: [override()],
    });
    expect(result.value.status).toBe('UNKNOWN');
    expect(result.overrideHistory).toEqual([]);
  });
  it('requires manual confirmation and matching versions in override records', () => {
    expect(
      InstanceOverrideSchema.safeParse({ ...override(), newValue: recorded(1) })
        .success,
    ).toBe(false);
    expect(
      InstanceOverrideSchema.safeParse({
        ...override(),
        oldValue: unknown('other-version'),
      }).success,
    ).toBe(false);
  });
  it('chooses latest override by instant, detects same-time conflicts', () => {
    const first = override();
    const second = override();
    second.id = 'second-override';
    second.newValue = {
      ...second.newValue,
      value: 95,
    } as typeof second.newValue;
    const conflict = resolve(bundle(), {
      instanceId: first.instanceId,
      overrides: [first, second],
    });
    expect(conflict.value).toMatchObject({
      status: 'UNKNOWN',
      reason: 'OVERRIDE_CONFLICT',
    });
    second.at = '2026-11-17T01:00:00+08:00';
    expect(
      resolve(bundle(), {
        instanceId: first.instanceId,
        overrides: [first, second],
      }).value.value,
    ).toBe(95);
  });
});

describe('provenance consumption gate', () => {
  it('blocks required unknowns without providing numerical DPS', () => {
    const report = summarizeProvenance(
      { skill: unknown() },
      ['skill', 'missing'],
      testVersion,
    );
    expect(report).toMatchObject({
      canCalculate: false,
      label: '無法計算',
      blockingUnknowns: ['skill', 'missing'],
    });
    expect(report).not.toHaveProperty('meanDps');
  });
  it('ignores unused unknowns and propagates estimated dependencies', () => {
    const data = bundle();
    data.records = [];
    const estimate = resolve(data).value;
    expect(
      summarizeProvenance(
        { unused: unknown(), used: estimate },
        ['used'],
        testVersion,
      ),
    ).toMatchObject({
      canCalculate: true,
      containsEstimates: true,
      label: '包含預估資料',
      estimatedDependencies: ['used'],
    });
  });
  it('rejects cross-version or malformed required values', () => {
    expect(
      summarizeProvenance(
        { wrong: recorded(0, 'other-version') },
        ['wrong'],
        testVersion,
      ).canCalculate,
    ).toBe(false);
    expect(
      summarizeProvenance({}, ['toString'], testVersion).canCalculate,
    ).toBe(false);
  });
  it('explicit zero is usable and manual values get their own label', () => {
    expect(
      summarizeProvenance({ zero: recorded(0) }, ['zero'], testVersion),
    ).toMatchObject({ canCalculate: true, label: '明確資料' });
    expect(valueStatusLabel(override().newValue)).toBe('手動輸入');
    expect(valueStatusLabel(recorded(0))).toBe('資料庫數值');
    expect(valueStatusLabel(unknown())).toBe('未知');
  });
});
