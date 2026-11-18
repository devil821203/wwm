import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { generationFixture } from '../../packages/game-data/src/test/generation-fixture.js';
async function load(page: Page) {
  const f = generationFixture();
  const character = {
    id: 'generator-character',
    name: '生成測試角色',
    pathId: 'synthetic-path',
    gameVersionId: f.release.version.id,
    level: 3,
    realm: '',
    createdAt: f.evaluatedAt,
    updatedAt: f.evaluatedAt,
  };
  const build = {
    id: 'generator-build',
    characterId: character.id,
    name: '生成測試配置',
    panelMode: 'BASE_ONLY',
    stats: [],
    equipmentIds: [],
    martialArts: [],
    innerWays: [],
    mysticSkillIds: [],
    talentIds: [],
    notes: '',
    createdAt: f.evaluatedAt,
    updatedAt: f.evaluatedAt,
  };
  const archive = {
    format: 'WWM_PLAYER_ARCHIVE',
    schemaVersion: '1.0.0',
    exportedAt: f.evaluatedAt,
    characters: [character],
    builds: [build],
    equipment: [],
    overrides: [],
    dataReleases: [f.release],
  };
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'synthetic-generation.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByLabel('生成資料版本').selectOption(f.release.version.id);
  await page.getByLabel('生成裝備定義').selectOption(f.definitionId);
  await page.getByLabel('使用角色等級').selectOption('3');
  await page.getByLabel('生成調律階段').selectOption('0');
  await page.getByLabel('確認這些是模擬設定，非遊戲實測或取得證明').check();
}
test('生成滿值、共用編輯器入庫、配裝送模擬及備份稽核', async ({
  page,
}, testInfo) => {
  await load(page);
  await page.getByLabel('生成方式').selectOption('PERFECT_LEGAL');
  await page.getByRole('button', { name: '預覽生成候選' }).click();
  await expect(page.getByLabel('生成預覽')).toContainText('合法候選已生成');
  await expect(page.getByLabel('生成預覽')).toContainText('未依DPS排名');
  await expect(page.getByLabel('生成預覽')).toContainText('80');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'management/tests/artifacts/S12-' + testInfo.project.name + '.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '以共用編輯器開啟候選 1', exact: true })
    .click();
  await expect(page.getByLabel('有效值模式 1')).toHaveValue('MAX');
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，已通過版本規則驗證。',
  );
  await page
    .getByLabel('加入同版本配置（待驗證）')
    .selectOption('generator-build');
  await page.getByRole('button', { name: '加入配置', exact: true }).click();
  await page.getByRole('button', { name: '以此配置前往模擬中心' }).click();
  await expect(page.getByLabel('模擬配置')).toHaveValue('generator-build');
  await page.getByRole('button', { name: '開始模擬' }).click();
  await expect(page.getByRole('status', { name: '模擬進度' })).toHaveText(
    '請先在循環驗證頁保存循環',
  );
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const download = await event,
    archive = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(archive.equipment).toHaveLength(1);
  expect(archive.equipment[0].creationMethod).toBe('GENERATED');
  expect(archive.equipment[0].affixes[0].effective.value).toBe(100);
  expect(archive.equipment[0].generation.mode).toBe('PERFECT_LEGAL');
  expect(archive.builds[0].equipmentIds).toEqual([archive.equipment[0].id]);
});
test('承音推估與僅明確資料、隨機seed及微調原件保留', async ({ page }) => {
  await load(page);
  await page.getByLabel('Synthetic affix', { exact: true }).check();
  await page.getByLabel('生成詞條模式').selectOption('CHENG_YIN');
  await page.getByRole('button', { name: '預覽生成候選' }).click();
  await expect(page.getByLabel('生成預覽')).toContainText('94 · 預估值');
  await page.getByLabel('僅使用明確資料（生成）').check();
  await expect(page.getByLabel('生成預覽')).toHaveCount(0);
  await page.getByRole('button', { name: '預覽生成候選' }).click();
  await expect(page.getByLabel('生成預覽')).toContainText('未知');
  await page.getByLabel('生成方式').selectOption('RANDOM_LEGAL');
  await page.getByLabel('生成詞條模式').selectOption('MANUAL');
  await page.getByRole('button', { name: '預覽生成候選' }).click();
  const first = await page
    .getByLabel('生成預覽')
    .locator('article ul')
    .innerText();
  await page.getByRole('button', { name: '預覽生成候選' }).click();
  expect(
    await page.getByLabel('生成預覽').locator('article ul').innerText(),
  ).toBe(first);
  await page
    .getByRole('button', { name: '以共用編輯器開啟候選 1', exact: true })
    .click();
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，已通過版本規則驗證。',
  );
  await page.getByLabel('生成方式').selectOption('MODIFY_OWNED');
  await page.getByLabel('微調原件').selectOption({ index: 1 });
  await page.getByLabel('生成詞條模式').selectOption('MAX');
  await page.getByLabel('Synthetic affix', { exact: true }).check();
  await page.getByRole('button', { name: '預覽生成候選' }).click();
  await expect(page.getByLabel('生成預覽')).toContainText('100');
  await page
    .getByRole('button', { name: '以共用編輯器開啟候選 1', exact: true })
    .click();
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，已通過版本規則驗證。',
  );
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const download = await event,
    backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.equipment).toHaveLength(2);
  const original = backup.equipment.find(
    (e: { generation: { mode: string } }) =>
      e.generation.mode === 'RANDOM_LEGAL',
  );
  const derived = backup.equipment.find(
    (e: { generation: { mode: string } }) =>
      e.generation.mode === 'MODIFY_OWNED',
  );
  expect(derived.derivedFromId).toBe(original.id);
  expect(derived.affixes[0].effective.value).toBe(100);
  expect(original.affixes[0].current.value).toBe(
    original.affixes[0].effective.value,
  );
});
