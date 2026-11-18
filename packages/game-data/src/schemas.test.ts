import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EquipmentInstanceSchema,
  GameVersionSchema,
  PathCatalogSchema,
  ResolvedValueSchema,
  SkillSchema,
  type GameDataRelease,
} from './schemas.js';
import { pathCatalog, validateGameData } from './index.js';
import {
  equipmentFixture,
  recorded,
  releaseFixture,
  testTime,
  testVersion,
  unknown,
} from './test/fixtures.js';

describe('versioned release contract', () => {
  it.each(['synthetic-v1', 'synthetic-future-999'])(
    'accepts independent version %s and sparse legal levels',
    (version) => {
      const result = validateGameData(releaseFixture(version));
      expect(result.success).toBe(true);
      if (result.success)
        expect(result.data.version.availableLevels).toEqual([1, 3, 7]);
    },
  );
  it('supports no known levels or cap without making up values', () => {
    expect(
      GameVersionSchema.parse({
        id: 'unknown-version',
        region: 'GLOBAL',
        label: 'Unknown fixture',
        availableLevels: [],
        levelCap: null,
      }).availableLevels,
    ).toEqual([]);
  });
  it('has no hardcoded maximum game level', () => {
    expect(
      GameVersionSchema.safeParse({
        id: 'future-version',
        region: 'GLOBAL',
        label: 'Synthetic future',
        availableLevels: [1001],
        levelCap: 1001,
      }).success,
    ).toBe(true);
  });
  it.each([
    { availableLevels: [1, 1], levelCap: 1 },
    { availableLevels: [0], levelCap: null },
    { availableLevels: [1.5], levelCap: null },
    { availableLevels: [3], levelCap: 2 },
    { availableLevels: ['3'], levelCap: null },
  ])('rejects invalid legal level data %j', (levels) => {
    expect(
      GameVersionSchema.safeParse({
        id: 'fixture',
        region: 'GLOBAL',
        label: 'fixture',
        ...levels,
      }).success,
    ).toBe(false);
  });
  const invalidCases: [string, (release: GameDataRelease) => void][] = [
    [
      'duplicate IDs',
      (data) => {
        data.paths.push(structuredClone(data.paths[0]));
      },
    ],
    [
      'foreign source version',
      (data) => {
        data.sources[0].gameVersionId = 'other-version';
      },
    ],
    [
      'nested value version',
      (data) => {
        data.skills[0].hits[0].coefficient.gameVersionId = 'other-version';
      },
    ],
    [
      'missing source',
      (data) => {
        data.sources = [];
      },
    ],
    [
      'missing stat',
      (data) => {
        data.stats = [];
      },
    ],
    [
      'missing martial art',
      (data) => {
        data.martialArts = [];
      },
    ],
    [
      'missing skill',
      (data) => {
        data.skills = [];
      },
    ],
    [
      'missing formula',
      (data) => {
        data.skills[0].formulaId = 'missing';
      },
    ],
    [
      'missing affix',
      (data) => {
        data.affixes = [];
      },
    ],
    [
      'illegal equipment level',
      (data) => {
        data.equipment[0].requiredLevel = 2;
      },
    ],
    [
      'wrong martial art owner',
      (data) => {
        data.skills[0].martialArtId = 'synthetic-spear';
      },
    ],
    [
      'verified path without formulas',
      (data) => {
        data.paths[0].formulaStatus = 'VERIFIED';
      },
    ],
    [
      'duplicate base stat',
      (data) => {
        data.equipment[0].baseStats.push(
          structuredClone(data.equipment[0].baseStats[0]),
        );
      },
    ],
  ];
  it.each(invalidCases)('rejects %s with a field path', (_name, mutate) => {
    const data = releaseFixture();
    mutate(data);
    const result = validateGameData(data);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.some((issue) => issue.path.length > 0)).toBe(
        true,
      );
  });
  it('does not mutate caller data', () => {
    const data = releaseFixture();
    const original = structuredClone(data);
    validateGameData(data);
    expect(data).toEqual(original);
  });
  it('rejects undeclared fields and non-global releases', () => {
    expect(
      validateGameData({ ...releaseFixture(), region: 'CN' }).success,
    ).toBe(false);
    const data = releaseFixture();
    expect(
      validateGameData({ ...data, version: { ...data.version, region: 'CN' } })
        .success,
    ).toBe(false);
  });
  it('accepts estimated data only with a resolvable formula and source', () => {
    const data = releaseFixture();
    data.skills[0].hits[0].coefficient = {
      status: 'ESTIMATED',
      gameVersionId: testVersion,
      value: 0.123456789,
      formulaId: 'synthetic-formula',
      modelVersion: 'test-v1',
      estimatedAt: testTime,
      inputs: { base: 0 },
      sourceIds: ['synthetic-source'],
    };
    expect(validateGameData(data).success).toBe(true);
    data.formulas = [];
    expect(validateGameData(data).success).toBe(false);
  });
});

describe('numeric provenance', () => {
  it.each([0, -1, 0.123456789])(
    'preserves recorded %s without rounding or coercion',
    (value) => {
      expect(ResolvedValueSchema.parse(recorded(value)).value).toBe(value);
    },
  );
  it('keeps unknown null and reason', () => {
    expect(ResolvedValueSchema.parse(unknown()).value).toBeNull();
    expect(
      ResolvedValueSchema.safeParse({ ...unknown(), value: 0 }).success,
    ).toBe(false);
  });
  it.each([NaN, Infinity, -Infinity, '0', null])(
    'rejects nonfinite or nonnumeric recorded data %s',
    (value) => {
      expect(
        ResolvedValueSchema.safeParse({ ...recorded(0), value }).success,
      ).toBe(false);
    },
  );
  it('requires recorded source and confirmed evidence', () => {
    expect(
      ResolvedValueSchema.safeParse({ ...recorded(0), sourceIds: [] }).success,
    ).toBe(false);
    expect(
      ResolvedValueSchema.safeParse({
        status: 'MANUAL_CONFIRMED',
        gameVersionId: testVersion,
        value: 1,
      }).success,
    ).toBe(false);
    expect(
      ResolvedValueSchema.safeParse({
        status: 'MANUAL_CONFIRMED',
        gameVersionId: testVersion,
        value: 0,
        confirmation: {
          origin: 'MANUAL',
          confirmedAt: testTime,
          evidenceIds: ['synthetic-evidence'],
        },
      }).success,
    ).toBe(true);
  });
  it('rejects estimates without model metadata rather than treating them as recorded', () => {
    expect(
      ResolvedValueSchema.safeParse({ ...recorded(1), status: 'ESTIMATED' })
        .success,
    ).toBe(false);
  });
});

describe('uniform equipment', () => {
  it.each(['MANUAL', 'SCREENSHOT', 'GENERATED'])(
    'uses one schema for %s',
    (creationMethod) => {
      expect(
        EquipmentInstanceSchema.safeParse({
          ...equipmentFixture(),
          creationMethod,
        }).success,
      ).toBe(true);
    },
  );
  it('preserves current, maximum and preview values separately', () => {
    const item = equipmentFixture();
    item.affixes[0].valueMode = 'MAX';
    item.affixes[0].current = recorded(0);
    item.affixes[0].maximum = recorded(100);
    item.affixes[0].effective = recorded(100);
    const parsed = EquipmentInstanceSchema.parse(item);
    expect(parsed.affixes[0].current.value).toBe(0);
    expect(parsed.affixes[0].maximum.value).toBe(100);
    expect(parsed.quality).toBe('synthetic-purple');
    expect(parsed.isChengYin).toBe(true);
  });
  it('rejects virtual or owned type flags', () => {
    expect(
      EquipmentInstanceSchema.safeParse({
        ...equipmentFixture(),
        virtual: true,
      }).success,
    ).toBe(false);
    expect(
      EquipmentInstanceSchema.safeParse({ ...equipmentFixture(), owned: true })
        .success,
    ).toBe(false);
  });
  it('rejects multiple value modes and duplicate affixes', () => {
    const item = equipmentFixture();
    expect(
      EquipmentInstanceSchema.safeParse({
        ...item,
        affixes: [{ ...item.affixes[0], valueMode: ['CHENG_YIN', 'MAX'] }],
      }).success,
    ).toBe(false);
    item.affixes.push(structuredClone(item.affixes[0]));
    expect(EquipmentInstanceSchema.safeParse(item).success).toBe(false);
  });
  it('rejects nested values from another version', () => {
    const item = equipmentFixture();
    item.affixes[0].maximum = unknown('other-version');
    expect(EquipmentInstanceSchema.safeParse(item).success).toBe(false);
  });
  it('does not allow unconfirmed OCR to claim confirmed screenshot value', () => {
    const item = equipmentFixture();
    item.affixes[0].observation = {
      rawText: '0',
      value: 0,
      origin: 'SCREENSHOT',
      manuallyConfirmed: false,
    };
    item.affixes[0].current = {
      status: 'MANUAL_CONFIRMED',
      gameVersionId: testVersion,
      value: 0,
      confirmation: {
        origin: 'SCREENSHOT',
        confirmedAt: testTime,
        evidenceIds: ['synthetic-image'],
      },
    };
    expect(EquipmentInstanceSchema.safeParse(item).success).toBe(false);
    item.affixes[0].observation.manuallyConfirmed = true;
    expect(EquipmentInstanceSchema.safeParse(item).success).toBe(true);
  });
});

describe('skill timing', () => {
  it.each([-1, 0.5, Infinity])(
    'rejects invalid millisecond timing %s',
    (offsetMs) => {
      const skill = releaseFixture().skills[0];
      expect(
        SkillSchema.safeParse({
          ...skill,
          hits: [{ ...skill.hits[0], offsetMs }],
        }).success,
      ).toBe(false);
    },
  );
  it('allows unknown coefficients and timings without inventing values', () => {
    const skill = releaseFixture().skills[0];
    skill.castTimeMs = null;
    expect(SkillSchema.parse(skill).hits[0].coefficient.value).toBeNull();
  });
});

describe('candidate catalog', () => {
  it('preserves the 11 supplied candidates and uncertain English names', () => {
    const original = JSON.parse(
      readFileSync(
        new URL('../../../requirements/schemas/paths.json', import.meta.url),
        'utf8',
      ),
    );
    expect(pathCatalog).toEqual(original);
    expect(pathCatalog.paths).toHaveLength(11);
    expect(pathCatalog.paths.some((path) => path.role === 'HEAL')).toBe(true);
    expect(
      pathCatalog.paths
        .filter((path) => !path.translationVerified)
        .every((path) => path.en.length > 0),
    ).toBe(true);
    expect(
      pathCatalog.paths.every((path) => path.formulaStatus === 'UNKNOWN'),
    ).toBe(true);
  });
  it('accepts a 12th candidate without changing schema', () => {
    const catalog = structuredClone(pathCatalog);
    catalog.paths.push({ ...catalog.paths[0], id: 'synthetic-twelfth' });
    expect(PathCatalogSchema.parse(catalog).paths).toHaveLength(12);
  });
  it('rejects duplicate candidate IDs and cannot be mistaken for a release', () => {
    const catalog = structuredClone(pathCatalog);
    catalog.paths.push(structuredClone(catalog.paths[0]));
    expect(PathCatalogSchema.safeParse(catalog).success).toBe(false);
    expect(validateGameData(pathCatalog).success).toBe(false);
  });
});
