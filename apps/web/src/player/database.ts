import type { OptimizationRequest } from '@wwm/optimizer';
import { Dexie, type Table } from 'dexie';
import {
  BuildSchema,
  MeasurementSchema,
  type Measurement,
  EquipmentInstanceSchema,
  EquipmentImageSchema,
  CharacterSchema,
  PlayerArchiveSchema,
  canonicalJson,
  resolveEquipment,
  parsePlayerArchive,
  type Build,
  type Character,
  type EquipmentInstance,
  type GameDataRelease,
  type InstanceOverride,
  type PlayerArchive,
  type EquipmentImage,
  type EquipmentEdit,
} from '@wwm/game-data';

export class PlayerDatabase extends Dexie {
  characters!: Table<Character, string>;
  measurements!: Table<Measurement, string>;
  equipmentImages!: Table<EquipmentImage, string>;
  equipmentHistory!: Table<EquipmentEdit, string>;
  builds!: Table<Build, string>;
  equipment!: Table<EquipmentInstance, string>;
  overrides!: Table<InstanceOverride, string>;
  dataReleases!: Table<GameDataRelease, string>;

  constructor(name = 'wwm-player-v1') {
    super(name);
    this.version(1).stores({
      characters: '&id, name, pathId, gameVersionId',
      builds: '&id, characterId',
      equipment: '&id, gameVersionId',
      overrides: '&id, instanceId',
      dataReleases: '&version.id',
    });
    this.version(2).stores({
      equipmentImages: '&id, equipmentId',
      equipmentHistory: '&id, equipmentId',
    });
    this.version(3).stores({ measurements: '&id, kind, recordedAt' });
  }
}

export class PlayerRepository {
  constructor(readonly db: PlayerDatabase) {}
  private tables() {
    return [
      this.db.characters,
      this.db.builds,
      this.db.equipment,
      this.db.overrides,
      this.db.dataReleases,
      this.db.equipmentImages,
      this.db.equipmentHistory,
      this.db.measurements,
    ];
  }
  private async read(): Promise<PlayerArchive> {
    const [
      characters,
      builds,
      equipment,
      overrides,
      dataReleases,
      equipmentImages,
      equipmentHistory,
      measurements,
    ] = await Promise.all([
      this.db.characters.toArray(),
      this.db.builds.toArray(),
      this.db.equipment.toArray(),
      this.db.overrides.toArray(),
      this.db.dataReleases.toArray(),
      this.db.equipmentImages.toArray(),
      this.db.equipmentHistory.toArray(),
      this.db.measurements.toArray(),
    ]);
    return PlayerArchiveSchema.parse({
      format: 'WWM_PLAYER_ARCHIVE',
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      characters,
      builds,
      equipment,
      overrides,
      dataReleases,
      equipmentImages,
      equipmentHistory,
      measurements,
    });
  }
  snapshot() {
    return this.db.transaction('r', this.tables(), () => this.read());
  }
  private async mutate(change: (state: PlayerArchive) => void) {
    return this.db.transaction('rw', this.tables(), async () => {
      const before = await this.read();
      const next = structuredClone(before);
      change(next);
      const valid = PlayerArchiveSchema.parse(next);
      const update = async <T>(
        table: Table<T, string>,
        oldItems: T[],
        newItems: T[],
        key: (item: T) => string,
      ) => {
        if (canonicalJson(oldItems) === canonicalJson(newItems)) return;
        const ids = new Set(newItems.map(key));
        await table.bulkDelete(oldItems.map(key).filter((id) => !ids.has(id)));
        if (newItems.length) await table.bulkPut(newItems);
      };
      await update(
        this.db.measurements,
        before.measurements ?? [],
        valid.measurements ?? [],
        (item) => item.id,
      );
      await update(
        this.db.equipmentImages,
        before.equipmentImages ?? [],
        valid.equipmentImages ?? [],
        (item) => item.id,
      );
      await update(
        this.db.equipmentHistory,
        before.equipmentHistory ?? [],
        valid.equipmentHistory ?? [],
        (item) => item.id,
      );
      await update(
        this.db.characters,
        before.characters,
        valid.characters,
        (item) => item.id,
      );
      await update(
        this.db.builds,
        before.builds,
        valid.builds,
        (item) => item.id,
      );
      await update(
        this.db.equipment,
        before.equipment,
        valid.equipment,
        (item) => item.id,
      );
      await update(
        this.db.overrides,
        before.overrides,
        valid.overrides,
        (item) => item.id,
      );
      await update(
        this.db.dataReleases,

        before.dataReleases,
        valid.dataReleases,
        (item) => item.version.id,
      );
    });
  }
  async createCharacter(
    input: Pick<
      Character,
      'name' | 'pathId' | 'gameVersionId' | 'level' | 'realm'
    >,
  ) {
    const at = new Date().toISOString();
    const character = CharacterSchema.parse({
      ...input,
      id: crypto.randomUUID(),
      createdAt: at,
      updatedAt: at,
    });
    const build = this.newBuild(character.id, '預設配置');
    await this.mutate((state) => {
      state.characters.push(character);
      state.builds.push(build);
    });
    return character.id;
  }
  async updateCharacter(character: Character) {
    const parsed = CharacterSchema.parse({
      ...character,
      updatedAt: new Date().toISOString(),
    });
    await this.mutate((state) => {
      const index = state.characters.findIndex((item) => item.id === parsed.id);
      if (index < 0) throw new Error('找不到角色，請重新載入。');
      const original = state.characters[index];
      if (
        original.pathId !== parsed.pathId ||
        original.gameVersionId !== parsed.gameVersionId
      )
        throw new Error(
          '角色版本與流派不能直接變更；請建立新角色以保留原配置。',
        );
      if (original.updatedAt !== character.updatedAt)
        throw new Error('角色已在其他頁面更新，請重新選取後再儲存。');
      if (parsed.createdAt !== original.createdAt)
        throw new Error('不能變更建立時間。');
      parsed.updatedAt = new Date(
        Math.max(Date.now(), Date.parse(original.updatedAt) + 1),
      ).toISOString();
      state.characters[index] = parsed;
    });
  }
  async deleteCharacter(id: string) {
    await this.mutate((state) => {
      if (!state.characters.some((item) => item.id === id))
        throw new Error('找不到角色。');
      state.characters = state.characters.filter((item) => item.id !== id);
      state.builds = state.builds.filter((item) => item.characterId !== id);
    });
  }
  private newBuild(characterId: string, name: string): Build {
    const at = new Date().toISOString();
    return BuildSchema.parse({
      id: crypto.randomUUID(),
      characterId,
      name,
      panelMode: 'UNKNOWN',
      stats: [],
      equipmentIds: [],
      martialArts: [],
      innerWays: [],
      mysticSkillIds: [],
      talentIds: [],
      notes: '',
      createdAt: at,
      updatedAt: at,
    });
  }
  async createBuild(characterId: string, name: string) {
    const build = this.newBuild(characterId, name);
    await this.mutate((state) => {
      state.builds.push(build);
    });
    return build.id;
  }
  async updateBuild(build: Build) {
    const parsed = BuildSchema.parse({
      ...build,
      updatedAt: new Date().toISOString(),
    });
    await this.mutate((state) => {
      const index = state.builds.findIndex((item) => item.id === parsed.id);
      if (index < 0) throw new Error('找不到配置，請重新載入。');
      if (state.builds[index].characterId !== parsed.characterId)
        throw new Error('不能變更配置所屬角色。');
      if (state.builds[index].updatedAt !== build.updatedAt)
        throw new Error('配置已在其他頁面更新，請重新選取後再儲存。');
      if (parsed.createdAt !== state.builds[index].createdAt)
        throw new Error('不能變更建立時間。');
      parsed.updatedAt = new Date(
        Math.max(Date.now(), Date.parse(state.builds[index].updatedAt) + 1),
      ).toISOString();
      state.builds[index] = parsed;
    });
  }
  async copyBuild(id: string) {
    const copyId = crypto.randomUUID();
    await this.mutate((state) => {
      const original = state.builds.find((item) => item.id === id);
      if (!original) throw new Error('找不到要複製的配置。');
      const at = new Date().toISOString();
      state.builds.push({
        ...structuredClone(original),
        id: copyId,
        name: original.name.slice(0, 95) + ' 副本',
        createdAt: at,
        updatedAt: at,
      });
    });
    return copyId;
  }
  async saveOptimizedBuild(
    request: OptimizationRequest,
    equipmentIds: string[],
  ) {
    const { optimize } = await import('@wwm/optimizer');
    const id = crypto.randomUUID();
    await this.mutate((state) => {
      const current = state.builds.find(
        (b) => b.id === request.combat.build.id,
      );
      const character = state.characters.find(
        (c) => c.id === request.combat.character.id,
      );
      const release = state.dataReleases.find(
        (r) => r.version.id === request.combat.plan.gameVersionId,
      );
      const keyed = (items: { id: string }[]) =>
        Object.fromEntries(items.map((item) => [item.id, item]));
      if (
        !current ||
        canonicalJson(current) !== canonicalJson(request.combat.build) ||
        canonicalJson(character) !== canonicalJson(request.combat.character) ||
        canonicalJson(release) !== canonicalJson(request.combat.release) ||
        canonicalJson(keyed(state.equipment)) !==
          canonicalJson(keyed(request.combat.equipment))
      )
        throw new Error('配置、庫存或版本已更新，請重跑最佳化，未另存配置。');
      if (
        equipmentIds.length !== request.slots.length ||
        new Set(equipmentIds).size !== equipmentIds.length
      )
        throw new Error('候選裝備數量不符');
      const locked = { ...request.locked };
      for (const equipmentId of equipmentIds) {
        const item = state.equipment.find((e) => e.id === equipmentId);
        if (
          !item?.slotId ||
          !request.slots.includes(item.slotId) ||
          (request.locked[item.slotId] &&
            request.locked[item.slotId] !== equipmentId)
        )
          throw new Error('候選違反部位或鎖定約束');
        locked[item.slotId] = equipmentId;
      }
      if (Object.keys(locked).length !== request.slots.length)
        throw new Error('候選缺少部位');
      const checked = optimize({ ...request, locked });
      if (
        !checked.top.some(
          (row) =>
            canonicalJson([...row.equipmentIds].sort()) ===
            canonicalJson([...equipmentIds].sort()),
        )
      )
        throw new Error('候選未通過目前約束與完整循環重算');
      const at = new Date().toISOString();
      state.builds.push(
        BuildSchema.parse({
          ...current,
          id,
          name: (current.name + ' · 最佳化候選').slice(0, 100),
          equipmentIds: [...equipmentIds],
          createdAt: at,
          updatedAt: at,
        }),
      );
    });
    return id;
  }
  async deleteBuild(id: string) {
    await this.mutate((state) => {
      state.builds = state.builds.filter((item) => item.id !== id);
    });
  }
  async saveEquipment(
    input: EquipmentInstance,
    images: EquipmentImage[],
    expected?: EquipmentInstance,
  ) {
    const parsed = EquipmentInstanceSchema.parse(input);
    if (images.length > 3) throw new Error('每件裝備最多保存 3 張原圖。');
    const checkedImages = images.map((image) =>
      EquipmentImageSchema.parse(image),
    );
    await this.mutate((state) => {
      const previous = state.equipment.find((item) => item.id === parsed.id);
      if (
        previous &&
        (!expected || canonicalJson(previous) !== canonicalJson(expected))
      )
        throw new Error('裝備已在其他頁面更新，請重新開啟編輯器。');
      if (!previous && expected) throw new Error('裝備已被刪除，未儲存。');
      if (
        previous &&
        previous.gameVersionId !== parsed.gameVersionId &&
        state.builds.some((build) => build.equipmentIds.includes(parsed.id))
      )
        throw new Error('此裝備仍被配置使用，請先解除配裝再變更版本。');
      const at = new Date(
        Math.max(
          Date.now(),
          Date.parse(previous?.updatedAt ?? '1970-01-01') + 1,
        ),
      ).toISOString();
      parsed.createdAt = previous?.createdAt ?? at;
      parsed.updatedAt = at;
      Object.assign(
        parsed,
        resolveEquipment(
          parsed,
          state.dataReleases.find(
            (release) => release.version.id === parsed.gameVersionId,
          ),
          { estimatedAt: at },
        ).equipment,
      );
      parsed.imageIds = checkedImages.map((image) => image.id);
      if (previous) {
        state.equipmentHistory = [
          ...(state.equipmentHistory ?? []),
          {
            id: crypto.randomUUID(),
            equipmentId: parsed.id,
            at,
            previousJson: JSON.stringify(previous),
          },
        ];
      }
      state.equipment = [
        ...state.equipment.filter((item) => item.id !== parsed.id),
        parsed,
      ];
      state.equipmentImages = [
        ...(state.equipmentImages ?? []).filter(
          (image) => image.equipmentId !== parsed.id,
        ),
        ...checkedImages,
      ];
    });
    return parsed.id;
  }
  async copyEquipment(id: string) {
    const copyId = crypto.randomUUID();
    await this.mutate((state) => {
      const original = state.equipment.find((item) => item.id === id);
      if (!original) throw new Error('找不到要複製的裝備。');
      const at = new Date().toISOString();
      const images = (state.equipmentImages ?? [])
        .filter((image) => image.equipmentId === id)
        .map((image) => ({
          ...image,
          id: crypto.randomUUID(),
          equipmentId: copyId,
          savedAt: at,
        }));
      state.equipment.push({
        ...structuredClone(original),
        id: copyId,
        name: (original.name ?? '裝備').slice(0, 95) + ' 副本',
        creationMethod: 'MANUAL',
        derivedFromId: id,
        imageIds: images.map((image) => image.id),
        createdAt: at,
        updatedAt: at,
      });
      state.equipmentImages = [...(state.equipmentImages ?? []), ...images];
    });
    return copyId;
  }
  async deleteEquipment(id: string) {
    await this.mutate((state) => {
      state.equipment = state.equipment.filter((item) => item.id !== id);
      state.builds = state.builds.map((build) =>
        build.equipmentIds.includes(id)
          ? {
              ...build,
              equipmentIds: build.equipmentIds.filter((item) => item !== id),
              updatedAt: new Date(
                Math.max(Date.now(), Date.parse(build.updatedAt) + 1),
              ).toISOString(),
            }
          : build,
      );
      state.overrides = state.overrides.filter(
        (item) => item.instanceId !== id,
      );
      state.equipmentImages = (state.equipmentImages ?? []).filter(
        (item) => item.equipmentId !== id,
      );
      state.equipmentHistory = (state.equipmentHistory ?? []).filter(
        (item) => item.equipmentId !== id,
      );
    });
  }
  async assignEquipment(buildId: string, equipmentId: string) {
    await this.mutate((state) => {
      const item = state.equipment.find((entry) => entry.id === equipmentId);
      const build = state.builds.find((entry) => entry.id === buildId);
      const character = state.characters.find(
        (entry) => entry.id === build?.characterId,
      );
      if (!item || !build || !character)
        throw new Error('找不到配裝所需的角色、配置或裝備。');
      if (
        item.gameVersionId === null ||
        item.gameVersionId !== character.gameVersionId
      )
        throw new Error('裝備與角色必須為同一個已知版本。');
      if (!item.slotId)
        throw new Error('裝備部位尚未確認，請先在編輯器補上部位。');
      const previousIds = build.equipmentIds.filter(
        (id) =>
          state.equipment.find((entry) => entry.id === id)?.slotId !==
          item.slotId,
      );
      build.equipmentIds = [...previousIds, equipmentId];
      build.updatedAt = new Date(
        Math.max(Date.now(), Date.parse(build.updatedAt) + 1),
      ).toISOString();
    });
  }
  async removeEquipment(buildId: string, equipmentId: string) {
    await this.mutate((state) => {
      const build = state.builds.find((item) => item.id === buildId);
      if (!build) throw new Error('找不到配置。');
      build.equipmentIds = build.equipmentIds.filter(
        (id) => id !== equipmentId,
      );
      build.updatedAt = new Date(
        Math.max(Date.now(), Date.parse(build.updatedAt) + 1),
      ).toISOString();
    });
  }
  async saveMeasurement(input: Measurement) {
    const parsed = MeasurementSchema.parse(input);
    await this.mutate((state) => {
      state.measurements ??= [];
      const existing = state.measurements.find((m) => m.id === parsed.id);
      if (existing && canonicalJson(existing) !== canonicalJson(parsed))
        throw new Error('實測紀錄為不可變快照；請另建紀錄，未覆寫原資料。');
      if (!existing) state.measurements.push(parsed);
    });
    return parsed.id;
  }
  async deleteMeasurement(id: string) {
    await this.mutate((state) => {
      state.measurements = (state.measurements ?? []).filter(
        (m) => m.id !== id,
      );
    });
  }
  async exportJson() {
    return JSON.stringify(await this.snapshot(), null, 2);
  }
  async importJson(input: unknown) {
    const imported = parsePlayerArchive(input);
    await this.mutate((state) => {
      const merge = <T>(
        oldItems: T[],
        newItems: T[],
        key: (item: T) => string,
      ) => {
        const existing = new Map(oldItems.map((item) => [key(item), item]));
        for (const item of newItems) {
          const old = existing.get(key(item));
          if (old && canonicalJson(old) !== canonicalJson(item))
            throw new Error('ID 衝突，未匯入任何資料：' + key(item));
          if (!old) oldItems.push(structuredClone(item));
        }
      };
      state.measurements ??= [];
      merge(state.measurements, imported.measurements ?? [], (item) => item.id);
      state.equipmentImages ??= [];
      state.equipmentHistory ??= [];
      merge(
        state.equipmentImages,
        imported.equipmentImages ?? [],
        (item) => item.id,
      );
      merge(
        state.equipmentHistory,
        imported.equipmentHistory ?? [],
        (item) => item.id,
      );
      merge(state.characters, imported.characters, (item) => item.id);
      merge(state.builds, imported.builds, (item) => item.id);
      merge(state.equipment, imported.equipment, (item) => item.id);
      merge(state.overrides, imported.overrides, (item) => item.id);
      merge(
        state.dataReleases,
        imported.dataReleases,
        (item) => item.version.id,
      );
    });
  }
}
export const playerDatabase = new PlayerDatabase();
export const playerRepository = new PlayerRepository(playerDatabase);
