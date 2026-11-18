import { BuildSchema, CharacterSchema } from './player-entities.js';
export { BuildSchema, CharacterSchema } from './player-entities.js';
import { MeasurementSchema } from './measurement-schemas.js';
import {
  EquipmentImageSchema,
  EquipmentEditSchema,
} from './equipment-evidence.js';
import { z } from 'zod';
import { EquipmentInstanceSchema, GameDataReleaseSchema } from './schemas.js';
import { InstanceOverrideSchema } from './governance-schemas.js';

const Timestamp = z.iso.datetime({ offset: true });
export const PlayerArchiveSchema = z
  .strictObject({
    format: z.literal('WWM_PLAYER_ARCHIVE'),
    schemaVersion: z.literal('1.0.0'),
    exportedAt: Timestamp,
    characters: z.array(CharacterSchema),
    builds: z.array(BuildSchema),
    equipment: z.array(EquipmentInstanceSchema),
    overrides: z.array(InstanceOverrideSchema),
    equipmentImages: z.array(EquipmentImageSchema).optional(),
    equipmentHistory: z.array(EquipmentEditSchema).optional(),
    dataReleases: z.array(GameDataReleaseSchema),
    measurements: z.array(MeasurementSchema).optional(),
  })
  .superRefine((archive, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    for (const key of [
      'characters',
      'builds',
      'equipment',
      'overrides',
    ] as const) {
      const ids = archive[key].map((item) => item.id);
      if (new Set(ids).size !== ids.length) issue([key], 'Duplicate ID');
    }
    if (
      new Set((archive.measurements ?? []).map((m) => m.id)).size !==
      (archive.measurements ?? []).length
    )
      issue(['measurements'], 'Duplicate measurement ID');
    const releases = new Map(
      archive.dataReleases.map((release) => [release.version.id, release]),
    );
    if (releases.size !== archive.dataReleases.length)
      issue(['dataReleases'], 'Duplicate data version');
    const characters = new Map(
      archive.characters.map((character) => [character.id, character]),
    );
    const equipment = new Map(archive.equipment.map((item) => [item.id, item]));
    archive.characters.forEach((character, i) => {
      if (character.gameVersionId === null) return;
      const release = releases.get(character.gameVersionId);
      if (!release)
        issue(['characters', i, 'gameVersionId'], 'Missing data version');
      else {
        if (!release.paths.some((path) => path.id === character.pathId))
          issue(['characters', i, 'pathId'], 'Path absent from data version');
        if (
          character.level !== null &&
          !release.version.availableLevels.includes(character.level)
        )
          issue(['characters', i, 'level'], 'Level is not legal for version');
      }
    });
    archive.builds.forEach((build, i) => {
      const character = characters.get(build.characterId);
      if (!character) {
        issue(['builds', i, 'characterId'], 'Missing character');
        return;
      }
      const duplicate = (ids: string[], field: string) => {
        if (new Set(ids).size !== ids.length)
          issue(['builds', i, field], 'Duplicate reference');
      };
      duplicate(
        build.stats.map((stat) => stat.statId),
        'stats',
      );
      duplicate(build.equipmentIds, 'equipmentIds');
      duplicate(
        build.martialArts.map((art) => art.id),
        'martialArts',
      );
      duplicate(
        build.innerWays.map((way) => way.id),
        'innerWays',
      );
      duplicate(build.mysticSkillIds, 'mysticSkillIds');
      duplicate(build.talentIds, 'talentIds');
      const release =
        character.gameVersionId === null
          ? undefined
          : releases.get(character.gameVersionId);
      if (
        build.rotation &&
        build.rotation.gameVersionId !== character.gameVersionId
      )
        issue(['builds', i, 'rotation'], 'Rotation version mismatch');
      const selectedPath = release?.paths.find(
        (path) => path.id === character.pathId,
      );
      build.martialArts.forEach((art, j) => {
        if (!selectedPath?.martialArtIds.includes(art.id))
          issue(
            ['builds', i, 'martialArts', j],
            'Martial art does not belong to path',
          );
      });
      build.stats.forEach((stat, j) => {
        if (!release?.stats.some((definition) => definition.id === stat.statId))
          issue(['builds', i, 'stats', j], 'Stat definition missing');
        if (stat.value.gameVersionId !== character.gameVersionId)
          issue(['builds', i, 'stats', j], 'Stat version mismatch');
      });
      build.equipmentIds.forEach((id, j) => {
        const item = equipment.get(id);
        if (!item) issue(['builds', i, 'equipmentIds', j], 'Missing equipment');
        else if (
          item.gameVersionId === null ||
          character.gameVersionId === null ||
          item.gameVersionId !== character.gameVersionId
        )
          issue(['builds', i, 'equipmentIds', j], 'Equipment version mismatch');
      });
      if (
        character.gameVersionId === null &&
        (build.martialArts.length ||
          build.innerWays.length ||
          build.mysticSkillIds.length ||
          build.talentIds.length)
      )
        issue(
          ['builds', i],
          'Draft cannot claim versioned martial arts or traits',
        );
    });
    for (const key of ['equipmentImages', 'equipmentHistory'] as const) {
      const items = archive[key] ?? [];
      if (new Set(items.map((item) => item.id)).size !== items.length)
        issue([key], 'Duplicate evidence ID');
      items.forEach((item, i) => {
        if (!equipment.has(item.equipmentId))
          issue([key, i], 'Missing equipment for evidence');
      });
    }
    archive.equipment.forEach((item, i) => {
      for (const id of item.imageIds ?? []) {
        if (
          !(archive.equipmentImages ?? []).some(
            (image) => image.id === id && image.equipmentId === item.id,
          )
        )
          issue(['equipment', i, 'imageIds'], 'Missing stored image');
      }
    });
    archive.overrides.forEach((override, i) => {
      const item = equipment.get(override.instanceId);
      if (!item)
        issue(['overrides', i, 'instanceId'], 'Missing equipment instance');
      else if (override.scope.gameVersionId !== item.gameVersionId)
        issue(['overrides', i], 'Override version mismatch');
    });
  });

export type Character = z.infer<typeof CharacterSchema>;
export type Build = z.infer<typeof BuildSchema>;
export type PlayerArchive = z.infer<typeof PlayerArchiveSchema>;
export function parsePlayerArchive(input: unknown): PlayerArchive {
  return PlayerArchiveSchema.parse(
    typeof input === 'string' ? JSON.parse(input) : input,
  );
}
