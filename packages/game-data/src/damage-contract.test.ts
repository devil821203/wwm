import { describe, expect, it } from 'vitest';
import { GameDataReleaseSchema } from './schemas.js';
import { releaseFixture, testTime } from './test/fixtures.js';
describe('S08 formula evidence and applicability contracts', () => {
  it('keeps old releases compatible', () => {
    expect(GameDataReleaseSchema.safeParse(releaseFixture()).success).toBe(
      true,
    );
  });
  it('validates bound stat and evidence source references', () => {
    const f = releaseFixture();
    f.formulas[0].statBindings = { attack: 'not-a-stat' };
    expect(GameDataReleaseSchema.safeParse(f).success).toBe(false);
    f.formulas[0].statBindings = { attack: 'synthetic-attack' };
    f.formulas[0].evidence = {
      status: 'VERIFIED',
      sourceIds: ['missing'],
      modelVersion: 'fixture',
      reviewedAt: testTime,
    };
    expect(GameDataReleaseSchema.safeParse(f).success).toBe(false);
  });
  it('rejects skill applicability outside version legal levels', () => {
    const f = releaseFixture();
    f.skills[0].applicability = { characterLevels: [4], martialArtLevels: [1] };
    expect(GameDataReleaseSchema.safeParse(f).success).toBe(false);
  });
});
