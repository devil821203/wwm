import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
async function uploadFixture(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 330;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.font = 'bold 48px Arial';
    ctx.fillText('AFFIXES', 40, 65);
    ctx.font = '64px Arial';
    ctx.fillText('Test Attack 12.5', 40, 165);
    ctx.fillText('Test Zero 0', 40, 265);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page
    .getByLabel('選擇裝備截圖（PNG／JPEG／WebP，最多 3 張）')
    .setInputFiles({
      name: 'synthetic-ocr-fixture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
  await expect(
    page.getByAltText('裝備原圖：synthetic-ocr-fixture.png'),
  ).toBeVisible();
}
async function exportBackup(page: Page) {
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const download = await downloading;
  return JSON.parse(await readFile((await download.path())!, 'utf8'));
}
test('真實本機OCR提供候選，不外傳圖片且不覆蓋人工修正', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  const external: string[] = [];
  context.on('request', (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && !url.startsWith('http://127.0.0.1:4173/'))
      external.push(url);
  });
  await page.goto('/');
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByLabel('裝備名稱（玩家標籤）').fill('OCR合成測試裝備');
  await uploadFixture(page);
  await page.getByLabel('辨識語言').selectOption('eng');
  await page.getByRole('button', { name: '開始本機辨識' }).click();
  await expect(page.getByText('辨識候選已列出，尚未更動編輯器。')).toBeVisible({
    timeout: 45000,
  });
  await expect(page.getByLabel('候選名稱 1')).toHaveValue('Test Attack');
  await expect(page.getByLabel('候選數值 1（原單位）')).toHaveValue('12.5');
  await page.getByRole('button', { name: '加入候選 1（未確認）' }).click();
  await expect(
    page.getByRole('checkbox', { name: '已確認既有詞條 1' }),
  ).not.toBeChecked();
  await page.getByLabel('既有詞條數值 1（原單位）').fill('99');
  await page.getByRole('checkbox', { name: '已確認既有詞條 1' }).check();
  // The second real Worker run loads both local language models.
  await page.getByLabel('辨識語言').selectOption('chi_tra+eng');
  await page.getByRole('button', { name: '開始本機辨識' }).click();
  await expect(page.getByText('辨識候選已列出，尚未更動編輯器。')).toBeVisible({
    timeout: 45000,
  });
  await page.getByRole('button', { name: '加入候選 1（未確認）' }).click();
  await expect(
    page.getByText('已有同名欄位，保留原值；請在編輯器手動修正。'),
  ).toBeVisible();
  await expect(page.getByLabel('既有詞條數值 1（原單位）')).toHaveValue('99');
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，尚未完成合法值驗證。',
  );
  const backup = await exportBackup(page);
  expect(backup.equipment[0].affixes[0].current).toMatchObject({
    status: 'MANUAL_CONFIRMED',
    value: 99,
  });
  expect(backup.equipment[0].affixes[0].observation.ocr).toMatchObject({
    adapterId: 'tesseract-local-v7',
    recognizedValue: 12.5,
  });
  expect(backup.equipment[0].affixes[0].observation.ocr.box.x1).toBeGreaterThan(
    0,
  );
  expect(external).toEqual([]);
});
test('OCR引擎失敗時可改用文字候選，未確認仍為未知', async ({ page }) => {
  await page.route('**/ocr-assets/worker.min.js', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByLabel('裝備名稱（玩家標籤）').fill('保留人工標籤');
  await uploadFixture(page);
  await page.getByRole('button', { name: '開始本機辨識' }).click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel('裝備名稱（玩家標籤）')).toHaveValue(
    '保留人工標籤',
  );
  await page.getByLabel('辨識方式').selectOption('text');
  await page
    .getByLabel('外部辨識或人工抄錄文字')
    .fill('Name: OCR Candidate\n詞條\nTest Attack 0');
  await page.getByRole('button', { name: '解析文字候選' }).click();
  await page.getByRole('button', { name: '填入裝備名稱候選' }).click();
  await expect(page.getByLabel('裝備名稱（玩家標籤）')).toHaveValue(
    '保留人工標籤',
  );
  await page.getByRole('button', { name: '加入候選 1（未確認）' }).click();
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，尚未完成合法值驗證。',
  );
  const backup = await exportBackup(page);
  expect(backup.equipment[0].affixes[0].current).toMatchObject({
    status: 'UNKNOWN',
    value: null,
  });
  expect(backup.equipment[0].affixes[0].observation.ocr.confidence).toBeNull();
});
