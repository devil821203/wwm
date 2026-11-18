import { describe, expect, it } from 'vitest';
import {
  EquipmentInstanceSchema,
  ResolvedValueSchema,
  GameDataReleaseSchema,
} from './schemas.js';
import { EquipmentImageSchema } from './equipment-evidence.js';
import { PlayerArchiveSchema } from './player-schemas.js';
import {
  equipmentFixture,
  recorded,
  releaseFixture,
  testTime,
} from './test/fixtures.js';
describe('equipment drafts and image evidence', () => {
  it('allows unknown version/tier/quality without inventing identifiers', () => {
    const item = equipmentFixture();
    item.gameVersionId = null;
    item.tierId = null;
    item.quality = null;
    item.affixes = [];
    expect(EquipmentInstanceSchema.parse(item).gameVersionId).toBeNull();
  });
  it('allows versionless manual or unknown values, but not recorded or estimated evidence', () => {
    expect(
      ResolvedValueSchema.safeParse({
        gameVersionId: null,
        status: 'UNKNOWN',
        value: null,
        reason: 'Unspecified version',
      }).success,
    ).toBe(true);
    expect(
      ResolvedValueSchema.safeParse({ ...recorded(0), gameVersionId: null })
        .success,
    ).toBe(false);
    expect(
      ResolvedValueSchema.safeParse({
        gameVersionId: null,
        status: 'MANUAL_CONFIRMED',
        value: 0,
        confirmation: {
          origin: 'MANUAL',
          confirmedAt: testTime,
          evidenceIds: ['manual-test'],
        },
      }).success,
    ).toBe(true);
  });
  it('rejects unversioned numeric values inside a known data release', () => {
    const release = releaseFixture();
    release.skills[0].hits[0].coefficient = {
      gameVersionId: null,
      status: 'UNKNOWN',
      value: null,
      reason: 'Missing version',
    };
    expect(GameDataReleaseSchema.safeParse(release).success).toBe(false);
  });
  it('keeps old backups without images compatible and rejects missing image references', () => {
    const item = equipmentFixture();
    const archive = {
      format: 'WWM_PLAYER_ARCHIVE',
      schemaVersion: '1.0.0',
      exportedAt: testTime,
      characters: [],
      builds: [],
      equipment: [item],
      overrides: [],
      dataReleases: [],
    };
    expect(PlayerArchiveSchema.safeParse(archive).success).toBe(true);
    item.imageIds = ['missing'];
    expect(PlayerArchiveSchema.safeParse(archive).success).toBe(false);
  });
  it('rejects remote URLs, SVG and malformed base64 images', () => {
    const base = {
      id: 'image',
      equipmentId: 'equipment',
      name: 'test.png',
      width: 1,
      height: 1,
      savedAt: testTime,
    };
    for (const dataUrl of [
      'https://example.invalid/image.png',
      'data:image/svg+xml;base64,AAAA',
      'data:image/png;base64,<script>',
    ])
      expect(EquipmentImageSchema.safeParse({ ...base, dataUrl }).success).toBe(
        false,
      );
  });
});
