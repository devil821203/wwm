import { rulesFixture } from './equipment-rules-fixture.js';
import { testTime, recorded } from './fixtures.js';
import type { GenerationRequest } from '../equipment-generation.js';
export function generationFixture(): GenerationRequest {
  const { release, definition, cap } = rulesFixture();
  definition.allowedAffixIds.push('second-affix');
  release.affixes.push({
    ...release.affixes[0],
    id: 'second-affix',
    name: 'Synthetic second',
  });
  release.affixCaps.push({
    ...structuredClone(cap),
    id: 'second-cap',
    affixId: 'second-affix',
    maximum: recorded(20),
  });
  return {
    release,
    mode: 'TARGET_AFFIX',
    definitionId: definition.id,
    level: 3,
    tuningStage: 0,
    valueMode: 'MAX',
    onlyExplicit: false,
    scenarioConfirmed: true,
    seed: 0,
    idPrefix: 'generated-synthetic',
    evaluatedAt: testTime,
    affixes: [{ id: 'synthetic-affix', value: null }],
    mutableAffixIds: [],
  };
}
