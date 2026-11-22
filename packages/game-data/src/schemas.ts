import { z } from 'zod';

export const IdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);
const Text = z.string().trim().min(1);
const NumberValue = z.number().finite();
const Level = z.number().int().positive().safe();
const Milliseconds = z.number().int().nonnegative().safe();
const Timestamp = z.iso.datetime({ offset: true });
export const FormulaStatusSchema = z.enum([
  'VERIFIED',
  'ESTIMATED',
  'PARTIAL',
  'UNKNOWN',
]);
export const ValueStatusSchema = z.enum([
  'MANUAL_CONFIRMED',
  'RECORDED',
  'ESTIMATED',
  'UNKNOWN',
]);
export const OcrTraceSchema = z.strictObject({
  adapterId: IdSchema,
  runId: IdSchema,
  imageId: IdSchema,
  rawText: z.string().min(1).max(20000),
  confidence: z.number().min(0).max(1).nullable(),
  recognizedLabel: z.string(),
  recognizedValue: z.number().finite().nullable(),
  unit: z.string(),
  box: z
    .strictObject({
      x0: z.number().nonnegative(),
      y0: z.number().nonnegative(),
      x1: z.number().nonnegative(),
      y1: z.number().nonnegative(),
    })
    .optional(),
  crop: z.strictObject({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().positive().max(100),
    height: z.number().positive().max(100),
  }),
  rotation: z.union([
    z.literal(0),
    z.literal(90),
    z.literal(180),
    z.literal(270),
  ]),
  scale: z.union([z.literal(1), z.literal(2)]),
});
export type OcrTrace = z.infer<typeof OcrTraceSchema>;
export const ValueModeSchema = z.enum(['MANUAL', 'CHENG_YIN', 'MAX']);

const valueBase = { gameVersionId: IdSchema, note: Text.optional() };
export const ResolvedValueSchema = z.discriminatedUnion('status', [
  z.strictObject({
    ...valueBase,
    status: z.literal('UNKNOWN'),
    gameVersionId: IdSchema.nullable(),
    value: z.null(),
    reason: Text,
  }),
  z.strictObject({
    ...valueBase,
    status: z.literal('RECORDED'),
    value: NumberValue,
    sourceIds: z.array(IdSchema).min(1),
  }),
  z.strictObject({
    ...valueBase,
    status: z.literal('MANUAL_CONFIRMED'),
    gameVersionId: IdSchema.nullable(),
    value: NumberValue,
    confirmation: z.strictObject({
      origin: z.enum(['MANUAL', 'SCREENSHOT']),
      confirmedAt: Timestamp,
      evidenceIds: z.array(IdSchema).min(1),
    }),
  }),
  z.strictObject({
    ...valueBase,
    status: z.literal('ESTIMATED'),
    value: NumberValue,
    formulaId: IdSchema,
    modelVersion: Text,
    estimatedAt: Timestamp,
    inputs: z.record(IdSchema, NumberValue),
    sourceIds: z.array(IdSchema).min(1),
  }),
]);

export const GameVersionSchema = z
  .strictObject({
    id: IdSchema,
    region: z.literal('GLOBAL'),
    label: Text,
    availableLevels: z.array(Level),
    levelCap: Level.nullable(),
  })
  .superRefine((version, ctx) => {
    if (
      new Set(version.availableLevels).size !== version.availableLevels.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['availableLevels'],
        message: 'Duplicate legal level',
      });
    if (
      version.levelCap !== null &&
      version.availableLevels.some((level) => level > version.levelCap!)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['availableLevels'],
        message: 'Level exceeds declared cap',
      });
  });

export const PathCandidateSchema = z.strictObject({
  id: IdSchema,
  zhTW: Text,
  en: Text,
  martialArts: z.array(Text).length(2),
  role: z.enum(['DPS', 'HEAL', 'TANK', 'SUPPORT']),
  mechanicsHint: z.array(IdSchema),
  translationVerified: z.boolean(),
  formulaStatus: FormulaStatusSchema,
});
export const PathCatalogSchema = z
  .strictObject({
    schemaVersion: Text,
    region: z.literal('GLOBAL'),
    sourceStatus: z.literal('COMMUNITY_CROSSCHECK_REQUIRED'),
    paths: z.array(PathCandidateSchema),
  })
  .superRefine((catalog, ctx) => {
    const seen = new Set<string>();
    catalog.paths.forEach((path, i) => {
      if (seen.has(path.id))
        ctx.addIssue({
          code: 'custom',
          path: ['paths', i, 'id'],
          message: 'Duplicate path ID',
        });
      seen.add(path.id);
    });
  });

const entityBase = { id: IdSchema, gameVersionId: IdSchema };
export const PathSchema = PathCandidateSchema.extend({
  gameVersionId: IdSchema,
  martialArtIds: z.array(IdSchema).max(2),
  formulaIds: z.array(IdSchema),
  requiredHandlerIds: z.array(IdSchema).optional(),
}).superRefine((path, ctx) => {
  if (new Set(path.martialArtIds).size !== path.martialArtIds.length)
    ctx.addIssue({
      code: 'custom',
      path: ['martialArtIds'],
      message: 'Duplicate martial art',
    });
  if (
    path.formulaStatus === 'VERIFIED' &&
    (path.martialArtIds.length !== 2 || path.formulaIds.length === 0)
  )
    ctx.addIssue({
      code: 'custom',
      path: ['formulaStatus'],
      message:
        'Verified path requires two martial arts and a formula reference',
    });
});

export const SourceSchema = z.strictObject({
  ...entityBase,
  region: z.literal('GLOBAL'),
  title: Text,
  url: z.url(),
  retrievedAt: Timestamp,
  rawHash: z.string().regex(/^[a-f0-9]{64}$/),
  licenseStatus: z.enum(['AUTHORIZED', 'MANUAL_ONLY', 'UNKNOWN']),
  confidence: z.enum(['OFFICIAL', 'CROSSCHECKED', 'COMMUNITY', 'UNKNOWN']),
});
export const StatDefinitionSchema = z.strictObject({
  ...entityBase,
  name: Text,
  unit: Text,
  description: Text,
});
export const StatValueSchema = z.strictObject({
  statId: IdSchema,
  value: ResolvedValueSchema,
});
const Stats = z.array(StatValueSchema).superRefine((stats, ctx) => {
  const seen = new Set<string>();
  stats.forEach((stat, i) => {
    if (seen.has(stat.statId))
      ctx.addIssue({
        code: 'custom',
        path: [i, 'statId'],
        message: 'Duplicate stat',
      });
    seen.add(stat.statId);
  });
});
export const MartialArtSchema = z.strictObject({
  ...entityBase,
  name: Text,
  translationVerified: z.boolean(),
  skillIds: z.array(IdSchema),
});
export const FormulaSchema = z.strictObject({
  ...entityBase,
  implementationId: IdSchema,
  statBindings: z.record(IdSchema, IdSchema).optional(),
  evidence: z
    .strictObject({
      status: z.enum(['VERIFIED', 'ESTIMATED', 'UNKNOWN']),
      sourceIds: z.array(IdSchema).min(1),
      modelVersion: Text,
      reviewedAt: Timestamp,
    })
    .optional(),
  formulaVersion: Text,
  parameters: z.record(IdSchema, ResolvedValueSchema),
});
export const CombatSkillSchema = z
  .strictObject({
    castDurationMs: Milliseconds.nullable(),
    cooldownMs: Milliseconds.nullable(),
    cooldownStart: z.enum(['CAST_START', 'CAST_END']),
    cooldownGroupId: IdSchema,
    scaling: z.enum(['SNAPSHOT', 'DYNAMIC']),
    hitsPersistAfterSwitch: z.boolean(),
    swordEnergyMode: z.enum(['NOT_USED', 'REQUIRE_MINIMUM']),
    resourceChanges: z.array(
      z.strictObject({ resourceId: IdSchema, delta: ResolvedValueSchema }),
    ),
    effects: z.array(
      z.strictObject({
        id: IdSchema,
        offsetMs: Milliseconds.nullable(),
        kind: z.enum(['APPLY_BUFF', 'REMOVE_BUFF', 'APPLY_DOT', 'REMOVE_DOT']),
        targetId: IdSchema,
      }),
    ),
  })
  .superRefine((profile, ctx) => {
    if (
      new Set(profile.resourceChanges.map((r) => r.resourceId)).size !==
        profile.resourceChanges.length ||
      new Set(profile.effects.map((e) => e.id)).size !== profile.effects.length
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate combat resource/effect ID',
      });
  });
export const CombatRulesSchema = z
  .strictObject({
    ruleVersion: Text,
    evidence: z.strictObject({
      status: z.enum(['VERIFIED', 'ESTIMATED', 'UNKNOWN']),
      sourceIds: z.array(IdSchema).min(1),
      modelVersion: Text,
      reviewedAt: Timestamp,
    }),
    switchDurationMs: Milliseconds.nullable(),
    swordEnergyResourceId: IdSchema.nullable(),
    resources: z.array(
      z.strictObject({
        id: IdSchema,
        maximum: ResolvedValueSchema,
        initial: ResolvedValueSchema,
      }),
    ),
    buffs: z.array(
      z.strictObject({
        id: IdSchema,
        name: Text,
        durationMs: Milliseconds.nullable(),
        multiplier: ResolvedValueSchema,
        reapply: z.enum(['REFRESH', 'REJECT']),
      }),
    ),
    dots: z.array(
      z.strictObject({
        id: IdSchema,
        name: Text,
        durationMs: Milliseconds.nullable(),
        intervalMs: z.number().int().positive().safe().nullable(),
        firstTickMs: Milliseconds.nullable(),
        skillId: IdSchema,
        variantId: IdSchema.nullable(),
        scaling: z.enum(['SNAPSHOT', 'DYNAMIC']),
        reapply: z.enum(['REPLACE', 'REJECT']),
      }),
    ),
  })
  .superRefine((rules, ctx) => {
    for (const key of ['resources', 'buffs', 'dots'] as const)
      if (new Set(rules[key].map((r) => r.id)).size !== rules[key].length)
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Duplicate combat rule ID',
        });
  });
export const SkillHitSchema = z.strictObject({
  id: IdSchema,
  offsetMs: Milliseconds.nullable(),
  coefficient: ResolvedValueSchema,
  flatDamage: ResolvedValueSchema,
});
export const SkillVariantSchema = z
  .strictObject({
    id: IdSchema,
    name: Text,
    applicability: z.strictObject({
      characterLevels: z.array(Level).min(1),
      martialArtLevels: z.array(Level).min(1),
    }),
    chargeMs: Milliseconds.nullable(),
    combat: CombatSkillSchema.optional(),
    requiredStateIds: z.array(IdSchema),
    swordEnergy: ResolvedValueSchema,
    hits: z.array(SkillHitSchema),
    events: z.array(
      z.strictObject({
        id: IdSchema,
        kind: z.enum([
          'SWORD_ENERGY',
          'WEAPON_SWITCH',
          'STATE_APPLY',
          'STATE_REMOVE',
        ]),
        offsetMs: Milliseconds.nullable(),
        targetMartialArtId: IdSchema.nullable(),
        stateId: IdSchema.nullable(),
        amount: ResolvedValueSchema,
      }),
    ),
  })
  .superRefine((variant, ctx) => {
    for (const key of ['hits', 'events'] as const)
      if (
        new Set(variant[key].map((item) => item.id)).size !==
        variant[key].length
      )
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Duplicate variant event/hit ID',
        });
  });
export const SkillSchema = z
  .strictObject({
    ...entityBase,
    name: Text,
    martialArtId: IdSchema,
    formulaId: IdSchema.nullable(),
    cooldownMs: Milliseconds.nullable(),
    applicability: z
      .strictObject({
        characterLevels: z.array(Level).min(1),
        martialArtLevels: z.array(Level).min(1),
      })
      .optional(),
    castTimeMs: Milliseconds.nullable(),
    hits: z.array(SkillHitSchema),
    variants: z.array(SkillVariantSchema).optional(),
    combat: CombatSkillSchema.optional(),
  })
  .superRefine((skill, ctx) => {
    const seen = new Set<string>();
    skill.hits.forEach((hit, i) => {
      if (seen.has(hit.id))
        ctx.addIssue({
          code: 'custom',
          path: ['hits', i, 'id'],
          message: 'Duplicate hit ID',
        });
      seen.add(hit.id);
    });
  });

export const EquipmentLegalitySchema = z
  .strictObject({
    ruleVersion: Text,
    verified: z.boolean(),
    sourceIds: z.array(IdSchema).min(1),
    minAffixes: z.number().int().nonnegative(),
    maxAffixes: z.number().int().nonnegative(),
    tuningStages: z.array(z.number().int().nonnegative().nullable()).min(1),
    exclusionGroups: z.array(z.array(IdSchema).min(2)),
  })
  .refine(
    (rule) => rule.minAffixes <= rule.maxAffixes,
    'Invalid affix count range',
  );
export const ChengYinModelSchema = z.strictObject({
  formulaId: IdSchema,
  modelVersion: Text,
  registeredAt: Timestamp,
  ratio: z.number().finite().min(0).max(1),
  sourceIds: z.array(IdSchema).min(1),
  precision: z.number().int().min(0).max(15).nullable(),
  precisionVerified: z.boolean(),
});
export const EquipmentDefinitionSchema = z.strictObject({
  ...entityBase,
  name: Text,
  slotId: IdSchema,
  tierId: IdSchema,
  quality: IdSchema,
  requiredLevel: Level.nullable(),
  setId: IdSchema.optional(),
  baseStats: Stats,
  allowedAffixIds: z.array(IdSchema),
  legality: EquipmentLegalitySchema.optional(),
});
export const AffixDefinitionSchema = z.strictObject({
  ...entityBase,
  statId: IdSchema,
  name: Text,
});
export const AffixCapRuleSchema = z.strictObject({
  ...entityBase,
  tierId: IdSchema,
  quality: IdSchema,
  affixId: IdSchema,
  tuningStage: z.number().int().nonnegative().safe().nullable(),
  maximum: ResolvedValueSchema,
  chengYinValue: ResolvedValueSchema,
  unit: Text,
  step: z.number().finite().positive().nullable(),
  roundingRule: z.enum(['ROUND', 'FLOOR', 'TRUNCATE', 'NONE']).nullable(),
  minimum: ResolvedValueSchema.optional(),
  precisionVerified: z.boolean().optional(),
  chengYinModel: ChengYinModelSchema.optional(),
});
export const EquipmentAffixSchema = z
  .strictObject({
    affixId: IdSchema,
    valueMode: ValueModeSchema,
    maxOnChengYinConfirmed: z.boolean().optional(),
    current: ResolvedValueSchema,
    effective: ResolvedValueSchema,
    maximum: ResolvedValueSchema,
    observation: z
      .strictObject({
        rawText: Text,
        rawName: Text.optional(),
        ocr: OcrTraceSchema.optional(),
        value: NumberValue.nullable(),
        origin: z.enum(['MANUAL', 'SCREENSHOT']),
        manuallyConfirmed: z.boolean(),
      })
      .optional(),
  })
  .superRefine((affix, ctx) => {
    if (
      affix.observation?.origin === 'SCREENSHOT' &&
      !affix.observation.manuallyConfirmed &&
      affix.current.status === 'MANUAL_CONFIRMED' &&
      affix.current.confirmation.origin === 'SCREENSHOT'
    )
      ctx.addIssue({
        code: 'custom',
        path: ['current'],
        message: 'Unconfirmed OCR cannot be manually confirmed',
      });
  });

export const EquipmentInstanceSchema = z
  .strictObject({
    ...entityBase,
    gameVersionId: IdSchema.nullable(),
    name: z.string().trim().min(1).max(100).optional(),
    equipmentLevel: Level.optional(),
    createdAt: Timestamp.optional(),
    updatedAt: Timestamp.optional(),
    imageIds: z.array(IdSchema).optional(),
    ocrMetadata: z
      .array(z.strictObject({ field: Text, trace: OcrTraceSchema }))
      .optional(),
    baseObservations: z
      .array(
        z.strictObject({
          statId: IdSchema,
          rawName: Text.optional(),
          ocr: OcrTraceSchema.optional(),
          rawText: z.string(),
          value: NumberValue.nullable(),
          manuallyConfirmed: z.boolean(),
        }),
      )
      .optional(),
    definitionId: IdSchema.optional(),
    slotId: IdSchema.optional(),
    tierId: IdSchema.nullable(),
    quality: IdSchema.nullable(),
    isChengYin: z.boolean(),
    tuningStage: z.number().int().nonnegative().safe().nullable(),
    creationMethod: z.enum(['SCREENSHOT', 'MANUAL', 'GENERATED']),
    generation: z
      .strictObject({
        algorithmVersion: Text,
        mode: z.enum([
          'PERFECT_LEGAL',
          'TARGET_AFFIX',
          'RANDOM_LEGAL',
          'MODIFY_OWNED',
        ]),
        seed: z.number().int().min(0).max(4294967295).nullable(),
        requestJson: z.string(),
        note: Text,
      })
      .optional(),
    derivedFromId: IdSchema.optional(),
    evidenceIds: z.array(IdSchema),
    baseStats: Stats,
    effectiveBaseStats: Stats.optional(),
    onlyExplicit: z.boolean().optional(),
    affixes: z.array(EquipmentAffixSchema),
    validation: z.strictObject({
      status: z.enum(['VALID', 'INVALID', 'UNVERIFIED']),
      reasons: z.array(Text),
      ruleVersion: Text.optional(),
    }),
  })
  .superRefine((item, ctx) => {
    const seen = new Set<string>();
    item.affixes.forEach((affix, i) => {
      if (seen.has(affix.affixId))
        ctx.addIssue({
          code: 'custom',
          path: ['affixes', i, 'affixId'],
          message: 'Duplicate affix',
        });
      seen.add(affix.affixId);
    });
    checkNestedVersions(item, item.gameVersionId, ctx);
  });

function checkNestedVersions(
  value: unknown,
  version: string | null,
  ctx: z.RefinementCtx,
  path: (string | number)[] = [],
): void {
  if (Array.isArray(value))
    value.forEach((child, i) =>
      checkNestedVersions(child, version, ctx, [...path, i]),
    );
  else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (
        key === 'gameVersionId' &&
        (typeof child === 'string' || child === null) &&
        child !== version
      )
        ctx.addIssue({
          code: 'custom',
          path: [...path, key],
          message: 'Cross-version data is forbidden',
        });
      else checkNestedVersions(child, version, ctx, [...path, key]);
    }
  }
}

export const GameDataReleaseSchema = z
  .strictObject({
    schemaVersion: z.literal('1.0.0'),
    purpose: z.enum(['GAME_DATA', 'SYNTHETIC_TEST']),
    version: GameVersionSchema,
    paths: z.array(PathSchema),
    martialArts: z.array(MartialArtSchema),
    stats: z.array(StatDefinitionSchema),
    sources: z.array(SourceSchema),
    formulas: z.array(FormulaSchema),
    skills: z.array(SkillSchema),
    equipment: z.array(EquipmentDefinitionSchema),
    affixes: z.array(AffixDefinitionSchema),
    affixCaps: z.array(AffixCapRuleSchema),
    equipmentSets: z
      .array(
        z.strictObject({
          ...entityBase,
          name: Text,
          verified: z.boolean(),
          sourceIds: z.array(IdSchema).min(1),
          bonuses: z.array(
            z.strictObject({
              pieces: z.number().int().positive().safe(),
              stats: Stats,
            }),
          ),
        }),
      )
      .optional(),
    combat: CombatRulesSchema.optional(),
  })
  .superRefine((release, ctx) => {
    checkNestedVersions(release, release.version.id, ctx);
    const collections = [
      'paths',
      'martialArts',
      'stats',
      'sources',
      'formulas',
      'skills',
      'equipment',
      'affixes',
      'affixCaps',
    ] as const;
    const ids = Object.fromEntries(
      collections.map((key) => [
        key,
        new Set(release[key].map((item) => item.id)),
      ]),
    ) as Record<(typeof collections)[number], Set<string>>;
    for (const key of collections) {
      const seen = new Set<string>();
      release[key].forEach((item, i) => {
        if (seen.has(item.id))
          ctx.addIssue({
            code: 'custom',
            path: [key, i, 'id'],
            message: 'Duplicate entity ID',
          });
        seen.add(item.id);
      });
    }
    const ref = (
      collection: (typeof collections)[number],
      id: string,
      path: (string | number)[],
    ) => {
      if (!ids[collection].has(id))
        ctx.addIssue({
          code: 'custom',
          path,
          message: 'Unresolved ' + collection + ' reference: ' + id,
        });
    };
    release.paths.forEach((item, i) => {
      item.martialArtIds.forEach((id, j) =>
        ref('martialArts', id, ['paths', i, 'martialArtIds', j]),
      );
      item.formulaIds.forEach((id, j) =>
        ref('formulas', id, ['paths', i, 'formulaIds', j]),
      );
    });
    release.martialArts.forEach((item, i) =>
      item.skillIds.forEach((id, j) => {
        ref('skills', id, ['martialArts', i, 'skillIds', j]);
        const skill = release.skills.find((skill) => skill.id === id);
        if (skill && skill.martialArtId !== item.id)
          ctx.addIssue({
            code: 'custom',
            path: ['martialArts', i, 'skillIds', j],
            message: 'Skill belongs to another martial art',
          });
      }),
    );
    release.formulas.forEach((formula, i) => {
      Object.entries(formula.statBindings ?? {}).forEach(([key, id]) =>
        ref('stats', id, ['formulas', i, 'statBindings', key]),
      );
    });
    release.skills.forEach((item, i) => {
      ref('martialArts', item.martialArtId, ['skills', i, 'martialArtId']);
      if (
        new Set((item.variants ?? []).map((v) => v.id)).size !==
        (item.variants ?? []).length
      )
        ctx.addIssue({
          code: 'custom',
          path: ['skills', i, 'variants'],
          message: 'Duplicate variant ID',
        });
      item.variants?.forEach((variant, j) => {
        variant.applicability.characterLevels.forEach((level, k) => {
          if (!release.version.availableLevels.includes(level))
            ctx.addIssue({
              code: 'custom',
              path: [
                'skills',
                i,
                'variants',
                j,
                'applicability',
                'characterLevels',
                k,
              ],
              message: 'Variant level is not legal for version',
            });
        });
        variant.events.forEach((event, k) => {
          if (event.targetMartialArtId !== null)
            ref('martialArts', event.targetMartialArtId, [
              'skills',
              i,
              'variants',
              j,
              'events',
              k,
            ]);
          if (
            (event.kind === 'WEAPON_SWITCH' &&
              event.targetMartialArtId === null) ||
            ((event.kind === 'STATE_APPLY' || event.kind === 'STATE_REMOVE') &&
              event.stateId === null)
          )
            ctx.addIssue({
              code: 'custom',
              path: ['skills', i, 'variants', j, 'events', k],
              message: 'Missing event target',
            });
        });
      });
      item.applicability?.characterLevels.forEach((level, j) => {
        if (!release.version.availableLevels.includes(level))
          ctx.addIssue({
            code: 'custom',
            path: ['skills', i, 'applicability', 'characterLevels', j],
            message: 'Skill applicability level is not legal in this version',
          });
      });
      if (item.formulaId !== null)
        ref('formulas', item.formulaId, ['skills', i, 'formulaId']);
    });
    release.affixes.forEach((item, i) =>
      ref('stats', item.statId, ['affixes', i, 'statId']),
    );
    release.equipment.forEach((item, i) => {
      if (
        item.requiredLevel !== null &&
        !release.version.availableLevels.includes(item.requiredLevel)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['equipment', i, 'requiredLevel'],
          message: 'Equipment level is not in version legal levels',
        });
      item.allowedAffixIds.forEach((id, j) =>
        ref('affixes', id, ['equipment', i, 'allowedAffixIds', j]),
      );
    });
    release.affixCaps.forEach((item, i) => {
      ref('affixes', item.affixId, ['affixCaps', i, 'affixId']);
      if (item.chengYinModel)
        ref('formulas', item.chengYinModel.formulaId, [
          'affixCaps',
          i,
          'chengYinModel',
          'formulaId',
        ]);
    });
    release.equipment.forEach((item, i) =>
      item.legality?.exclusionGroups.forEach((group, j) =>
        group.forEach((id, k) =>
          ref('affixes', id, [
            'equipment',
            i,
            'legality',
            'exclusionGroups',
            j,
            k,
          ]),
        ),
      ),
    );
    const sets = release.equipmentSets ?? [];
    if (new Set(sets.map((set) => set.id)).size !== sets.length)
      ctx.addIssue({
        code: 'custom',
        path: ['equipmentSets'],
        message: 'Duplicate set ID',
      });
    sets.forEach((set, i) => {
      set.sourceIds.forEach((id) =>
        ref('sources', id, ['equipmentSets', i, 'sourceIds']),
      );
      if (new Set(set.bonuses.map((b) => b.pieces)).size !== set.bonuses.length)
        ctx.addIssue({
          code: 'custom',
          path: ['equipmentSets', i],
          message: 'Duplicate set threshold',
        });
      set.bonuses.forEach((bonus, j) =>
        bonus.stats.forEach((stat) =>
          ref('stats', stat.statId, ['equipmentSets', i, 'bonuses', j]),
        ),
      );
    });
    release.equipment.forEach((item, i) => {
      if (item.setId && !sets.some((set) => set.id === item.setId))
        ctx.addIssue({
          code: 'custom',
          path: ['equipment', i, 'setId'],
          message: 'Unknown equipment set',
        });
    });
    if (release.combat) {
      const rules = release.combat;
      const resourceIds = new Set(rules.resources.map((r) => r.id));
      const buffIds = new Set(rules.buffs.map((b) => b.id));
      const dotIds = new Set(rules.dots.map((d) => d.id));
      const problem = (message: string) =>
        ctx.addIssue({ code: 'custom', path: ['combat'], message });
      if (
        rules.swordEnergyResourceId !== null &&
        !resourceIds.has(rules.swordEnergyResourceId)
      )
        problem('Unknown sword energy resource');
      rules.dots.forEach((dot) => {
        ref('skills', dot.skillId, ['combat', 'dots', dot.id]);
        if (
          dot.variantId !== null &&
          !release.skills
            .find((s) => s.id === dot.skillId)
            ?.variants?.some((v) => v.id === dot.variantId)
        )
          problem('Unknown DOT variant');
      });
      release.skills.forEach((skill) => {
        const profiles = [
          skill.combat,
          ...(skill.variants ?? []).map((v) => v.combat),
        ];
        profiles.forEach((profile) => {
          profile?.resourceChanges.forEach((r) => {
            if (!resourceIds.has(r.resourceId))
              problem('Unknown combat resource');
          });
          profile?.effects.forEach((effect) => {
            if (
              !(effect.kind.endsWith('BUFF') ? buffIds : dotIds).has(
                effect.targetId,
              )
            )
              problem('Unknown combat effect target');
          });
        });
        skill.variants?.forEach((variant) => {
          variant.requiredStateIds.forEach((id) => {
            if (!buffIds.has(id)) problem('Unknown required state');
          });
          variant.events.forEach((event) => {
            if (
              (event.kind === 'STATE_APPLY' || event.kind === 'STATE_REMOVE') &&
              !buffIds.has(event.stateId!)
            )
              problem('Unknown state event target');
            if (
              event.kind === 'SWORD_ENERGY' &&
              rules.swordEnergyResourceId === null
            )
              problem('Missing sword energy resource mapping');
          });
        });
      });
    }
    const visit = (value: unknown, path: (string | number)[] = []) => {
      if (Array.isArray(value))
        value.forEach((child, i) => visit(child, [...path, i]));
      else if (value !== null && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        if (Array.isArray(object.sourceIds))
          object.sourceIds.forEach((id, i) =>
            ref('sources', id as string, [...path, 'sourceIds', i]),
          );
        if (typeof object.statId === 'string')
          ref('stats', object.statId, [...path, 'statId']);
        if (
          object.status === 'ESTIMATED' &&
          typeof object.formulaId === 'string'
        )
          ref('formulas', object.formulaId, [...path, 'formulaId']);
        Object.entries(object).forEach(([key, child]) =>
          visit(child, [...path, key]),
        );
      }
    };
    visit(release);
  });

export type ResolvedValue = z.infer<typeof ResolvedValueSchema>;
export type GameVersion = z.infer<typeof GameVersionSchema>;
export type PathCandidate = z.infer<typeof PathCandidateSchema>;
export type PathCatalog = z.infer<typeof PathCatalogSchema>;
export type Path = z.infer<typeof PathSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type StatDefinition = z.infer<typeof StatDefinitionSchema>;
export type MartialArt = z.infer<typeof MartialArtSchema>;
export type Formula = z.infer<typeof FormulaSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type EquipmentDefinition = z.infer<typeof EquipmentDefinitionSchema>;
export type EquipmentInstance = z.infer<typeof EquipmentInstanceSchema>;
export type EquipmentAffix = z.infer<typeof EquipmentAffixSchema>;
export type AffixDefinition = z.infer<typeof AffixDefinitionSchema>;
export type AffixCapRule = z.infer<typeof AffixCapRuleSchema>;
export type GameDataRelease = z.infer<typeof GameDataReleaseSchema>;

export type CombatRules = z.infer<typeof CombatRulesSchema>;
export type CombatSkill = z.infer<typeof CombatSkillSchema>;
