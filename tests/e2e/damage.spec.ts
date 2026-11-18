import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  damageArchive,
  unknown,
  recorded,
} from '../../packages/stat-engine/src/test/fixtures.js';
async function importFixture(
  page: Page,
  archive: ReturnType<typeof damageArchive>,
) {
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'synthetic-damage.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await page.getByRole('button', { name: '傷害與溯源', exact: true }).click();
  await page.getByLabel('計算配置').selectOption('synthetic-build');
  await page
    .getByLabel('單技能', { exact: true })
    .selectOption('synthetic-skill');
}
test('合成傷害：屬性來源、預估傳播、明確資料篩選與可重現快照', async ({
  page,
}, testInfo) => {
  const archive = damageArchive();
  archive.dataReleases[0].affixCaps[0].chengYinValue = unknown();
  await importFixture(page, archive);
  await page.getByRole('button', { name: '計算單技能期望傷害' }).click();
  const result = page.getByLabel('單技能計算結果');
  await expect(result.getByLabel('期望傷害數值')).not.toHaveText('無法計算');
  expect(
    Number(await result.getByLabel('期望傷害數值').textContent()),
  ).toBeCloseTo(393.39);
  await expect(result).toContainText('包含預估資料 · 預估值');
  await expect(result).toContainText('尚無可信 DPS');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載此次計算紀錄' }).click();
  const download = await downloadEvent;
  const record = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(record.format).toBe('WWM_DAMAGE_CALCULATION');
  expect(record.result.meanDps).toBeNull();
  expect(record.result.provenance.estimatedDependencies).toContain(
    'gear:synthetic-instance:affix:attack-affix',
  );
  expect(record.request.release.purpose).toBe('SYNTHETIC_TEST');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path:
      'management/tests/artifacts/S08-' +
      (testInfo.project.name.startsWith('desktop') ? 'desktop' : 'mobile') +
      '.png',
    fullPage: true,
  });
  await page.getByLabel('僅使用明確資料（傷害計算）').check();
  await expect(result).toHaveCount(0);
  await page.getByRole('button', { name: '計算單技能期望傷害' }).click();
  await expect(result.getByLabel('期望傷害數值')).toHaveText('無法計算');
  await page.reload();
  await page.getByRole('button', { name: '傷害與溯源', exact: true }).click();
  await page.getByLabel('計算配置').selectOption('synthetic-build');
  await page
    .getByLabel('單技能', { exact: true })
    .selectOption('synthetic-skill');
  await page.getByRole('button', { name: '計算單技能期望傷害' }).click();
  expect(
    Number(await page.getByLabel('期望傷害數值').textContent()),
  ).toBeCloseTo(record.result.expectedDamage);
});
test('已含裝備面板不重複加總；面板語意未知時阻擋', async ({ page }) => {
  const archive = damageArchive();
  archive.builds[0].panelMode = 'EQUIPMENT_INCLUDED';
  archive.builds[0].stats[0].value = recorded(274);
  await importFixture(page, archive);
  await page.getByRole('button', { name: '計算單技能期望傷害' }).click();
  expect(
    Number(await page.getByLabel('期望傷害數值').textContent()),
  ).toBeCloseTo(393.39);
  await expect(page.getByLabel('單技能計算結果')).toContainText(
    '未再次加上裝備數值',
  );
  // Import a separate character/build without overwriting existing records.
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  const missing = damageArchive();
  missing.characters[0].id = 'missing-character';
  missing.builds[0].id = 'missing-build';
  missing.builds[0].characterId = 'missing-character';
  missing.builds[0].panelMode = 'UNKNOWN';
  missing.builds[0].equipmentIds = [];
  missing.equipment = [];
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'missing-input.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(missing)),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await page.getByRole('button', { name: '傷害與溯源', exact: true }).click();
  await page.getByLabel('計算配置').selectOption('missing-build');
  await page
    .getByLabel('單技能', { exact: true })
    .selectOption('synthetic-skill');
  await page.getByRole('button', { name: '計算單技能期望傷害' }).click();
  await expect(page.getByLabel('期望傷害數值')).toHaveText('無法計算');
  await expect(page.getByLabel('阻擋原因')).toContainText(
    '尚未確認面板是否包含裝備',
  );
});
