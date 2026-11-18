import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { rulesFixture } from '../../packages/game-data/src/test/equipment-rules-fixture.js';
const at = '2026-11-17T00:00:00+08:00';
test('合成規則：承音預估、明確資料篩選、合法MAX與原值備份', async ({
  page,
}, testInfo) => {
  const f = rulesFixture();
  f.item.name = 'S07 合成裝備（非遊戲資料）';
  const archive = {
    format: 'WWM_PLAYER_ARCHIVE',
    schemaVersion: '1.0.0',
    exportedAt: at,
    characters: [],
    builds: [],
    equipment: [f.item],
    overrides: [],
    dataReleases: [f.release],
  };
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'synthetic-rules.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByRole('button', { name: /S07 合成裝備.*手動/ }).click();
  const preview = page.getByLabel('有效值預覽');
  await page.getByRole('button', { name: '預覽有效值與合法性' }).click();
  await expect(preview.getByText('94 · 預估值', { exact: true })).toBeVisible();
  await expect(preview).toContainText('包含預估資料');
  await expect(
    preview.getByText('80 · 資料庫數值', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path:
      'management/tests/artifacts/S07-' +
      (testInfo.project.name.startsWith('desktop') ? 'desktop' : 'mobile') +
      '.png',
    fullPage: true,
  });
  await page.getByLabel('僅使用明確資料（禁止推估）').check();
  await expect(preview).toHaveCount(0);
  await page.getByRole('button', { name: '預覽有效值與合法性' }).click();
  await expect(preview).toContainText('無法計算');
  await page.getByRole('button', { name: '填入已驗證合法滿值' }).click();
  await expect(page.getByLabel('有效值模式 1')).toHaveValue('MAX');
  await page.getByRole('button', { name: '預覽有效值與合法性' }).click();
  await expect(preview).toContainText('合法性：VALID');
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，已通過版本規則驗證。',
  );
  await page.reload();
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByRole('button', { name: /S07 合成裝備.*手動/ }).click();
  await expect(page.getByLabel('有效值模式 1')).toHaveValue('MAX');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const file = await downloading;
  const backup = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(backup.equipment[0].affixes[0].current.status).toBe('UNKNOWN');
  expect(backup.equipment[0].affixes[0].effective).toMatchObject({
    status: 'RECORDED',
    value: 100,
  });
  expect(backup.equipment[0].effectiveBaseStats[0].value.value).toBe(80);
  expect(backup.equipment[0].validation.status).toBe('VALID');
});
