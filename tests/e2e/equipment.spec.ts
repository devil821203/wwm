import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
async function backup(page: Page) {
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const download = await downloading;
  return JSON.parse(await readFile((await download.path())!, 'utf8'));
}
test('無截圖也能手動校對並保存未知版本裝備', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await expect(page.getByLabel('裝備等級')).toHaveValue('100');
  await page.getByLabel('裝備名稱（玩家標籤）').fill('人工測試裝備');
  await page.getByRole('button', { name: '新增基礎屬性', exact: true }).click();
  await page.getByLabel('基礎屬性名稱 1').fill('測試攻擊');
  await page.getByLabel('基礎屬性數值 1（原單位）').fill('0');
  await page.getByRole('checkbox', { name: '已確認基礎屬性 1' }).check();
  await page.getByRole('button', { name: '新增既有詞條', exact: true }).click();
  await page.getByLabel('既有詞條名稱 1').selectOption('其他（手動輸入）');
  await page.getByLabel('手動輸入詞條名稱 1').fill('測試詞條');
  await page.getByLabel('既有詞條數值 1（原單位）').fill('12.345');
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，尚未完成合法值驗證。',
  );
  const first = await backup(page);
  expect(first.equipment[0].gameVersionId).toBeNull();
  expect(first.equipment[0].equipmentLevel).toBe(100);
  expect(first.equipment[0].baseStats[0].value).toMatchObject({
    status: 'MANUAL_CONFIRMED',
    value: 0,
  });
  expect(first.equipment[0].affixes[0].current.status).toBe('UNKNOWN');
  expect(first.equipment[0].affixes[0].observation.value).toBe(12.345);
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByRole('button', { name: /人工測試裝備.*手動/ }).click();
  await page.getByRole('checkbox', { name: '已確認既有詞條 1' }).check();
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，尚未完成合法值驗證。',
  );
  await page.reload();
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByRole('button', { name: /人工測試裝備.*手動/ }).click();
  await expect(page.getByLabel('既有詞條數值 1（原單位）')).toHaveValue(
    '12.345',
  );
  await page.getByRole('button', { name: '複製裝備' }).click();
  await expect(page.getByRole('status')).toHaveText('裝備已複製。');
  expect((await backup(page)).equipment).toHaveLength(2);
});
test('截圖本機預覽須同意才保存，備份可還原原圖', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByRole('button', { name: '新增截圖裝備' }).click();
  await page.getByLabel('裝備名稱（玩家標籤）').fill('截圖校對草稿');
  const upload = page.getByLabel('選擇裝備截圖（PNG／JPEG／WebP，最多 3 張）');
  await upload.setInputFiles({
    name: 'bad.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await upload.setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(page.getByAltText('裝備原圖：fixture.png')).toBeVisible();
  await expect(
    page.getByRole('checkbox', {
      name: '我同意將原圖保存在本機，並包含於 JSON 備份',
    }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，尚未完成合法值驗證。',
  );
  expect((await backup(page)).equipmentImages).toHaveLength(0);
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByRole('button', { name: /截圖校對草稿.*截圖/ }).click();
  await upload.setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await page
    .getByRole('checkbox', {
      name: '我同意將原圖保存在本機，並包含於 JSON 備份',
    })
    .check();
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，尚未完成合法值驗證。',
  );
  const saved = await backup(page);
  expect(saved.equipmentImages).toHaveLength(1);
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByRole('button', { name: /截圖校對草稿.*截圖/ }).click();
  await expect(page.getByAltText('裝備原圖：fixture.png')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '刪除裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已刪除，配置引用已解除。',
  );
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByRole('button', { name: /截圖校對草稿.*截圖/ }).click();
  await expect(page.getByAltText('裝備原圖：fixture.png')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('詞條下拉選擇保留數值，切換名稱後須重新核對', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByLabel('裝備名稱（玩家標籤）').fill('詞條下拉測試');
  await page.getByRole('button', { name: '新增既有詞條', exact: true }).click();
  await page.getByLabel('既有詞條名稱 1').selectOption('最大外功攻擊');
  await page.getByLabel('既有詞條數值 1（原單位）').fill('73.1');
  await page.getByRole('checkbox', { name: '已確認既有詞條 1' }).check();
  await page.getByLabel('既有詞條名稱 1').selectOption('會意率');
  await expect(
    page.getByRole('checkbox', { name: '已確認既有詞條 1' }),
  ).not.toBeChecked();
  await expect(page.getByLabel('既有詞條數值 1（原單位）')).toHaveValue('73.1');
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，尚未完成合法值驗證。',
  );
  const archive = await backup(page);
  expect(archive.equipment[0].affixes[0].observation).toMatchObject({
    rawName: '會意率',
    value: 73.1,
    manuallyConfirmed: false,
  });
  expect(archive.equipment[0].affixes[0].current.status).toBe('UNKNOWN');
});
