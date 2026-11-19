import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { optimizerArchive } from '../../packages/optimizer/src/test/fixtures.js';
async function load(page: Page, archive = optimizerArchive()) {
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'synthetic-optimizer.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await page.getByRole('button', { name: '裝備最佳化', exact: true }).click();
  await page.getByLabel('最佳化配置').selectOption('synthetic-build');
}
test('小型庫存完整排名、鎖定約束、另存配置送模擬與快照', async ({
  page,
}, testInfo) => {
  await load(page);
  await page.getByRole('button', { name: '開始最佳化' }).click();
  await expect(page.getByLabel('候選DPS 1')).toHaveText('930');
  await expect(page.getByLabel('最佳化結果')).toContainText(
    '已完整遍歷本次候選範圍',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'management/tests/artifacts/S13-' + testInfo.project.name + '.png',
    fullPage: true,
  });
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載最佳化快照' }).click();
  const file = await downloading,
    snapshot = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(snapshot.format).toBe('WWM_OPTIMIZATION_SNAPSHOT');
  expect(snapshot.result.optimalityProven).toBe(true);
  expect(snapshot.result.visited).toBe(4);
  await page.getByLabel('鎖定 head').selectOption('head-0');
  await expect(page.getByLabel('最佳化結果')).toHaveCount(0);
  await page.getByRole('button', { name: '開始最佳化' }).click();
  await expect(page.getByLabel('候選DPS 1')).toHaveText('730');
  await page.getByRole('button', { name: '另存候選 1 並前往模擬' }).click();
  await expect(
    page.getByRole('heading', { name: '模擬中心', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('模擬配置')).not.toHaveValue('synthetic-build');
  await page.getByRole('button', { name: '開始模擬' }).click();
  await expect(page.getByLabel('平均DPS')).toHaveText('730');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  const backupEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const backupFile = await backupEvent,
    backup = JSON.parse(await readFile((await backupFile.path())!, 'utf8'));
  expect(backup.builds).toHaveLength(2);
  expect(
    backup.builds.find((b: { id: string }) => b.id === 'synthetic-build')
      .equipmentIds,
  ).toEqual(['head-0', 'weapon-0']);
  expect(backup.equipment).toHaveLength(4);
});
test('Beam無最優宣稱、預算缺值不當零、取消後可重啟', async ({ page }) => {
  await load(page);
  await page.getByLabel('搜尋方法').selectOption('BEAM');
  await page.getByRole('button', { name: '開始最佳化' }).click();
  await expect(page.getByLabel('候選DPS 1')).toHaveText('930');
  await expect(page.getByLabel('最佳化結果')).toContainText('未證明全域最優');
  await page.getByLabel('自訂成本上限（空白不限制）').fill('0');
  await page.getByRole('button', { name: '開始最佳化' }).click();
  await expect(page.getByLabel('最佳化結果')).toContainText('無可用排名');
  await expect(page.getByLabel('候選DPS 1')).toHaveCount(0);
  await page.getByLabel('自訂成本上限（空白不限制）').fill('');
  // Hold exactly one Worker request so cancellation occurs while it is active.
  // Restore the native method immediately, allowing the next search to run normally.
  await page.evaluate(() => {
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function () {
      Worker.prototype.postMessage = original;
    };
  });
  await page.getByRole('button', { name: '開始最佳化' }).click();
  await page.getByRole('button', { name: '取消最佳化' }).click();
  await expect(page.getByRole('status', { name: '最佳化進度' })).toHaveText(
    '已取消，未保存部分排名或修改配置',
  );
  await page.getByRole('button', { name: '開始最佳化' }).click();
  await expect(page.getByLabel('候選DPS 1')).toHaveText('930');
});

test('真實 Worker 長搜尋收到進度後可取消且不寫入配置', async ({ page }) => {
  const archive = optimizerArchive();
  const originalBuild = structuredClone(archive.builds[0]);
  const originals = structuredClone(archive.equipment);
  for (const slot of ['head', 'weapon']) {
    const template = originals.find((item) => item.slotId === slot)!;
    for (let i = 0; i < 150; i++) {
      archive.equipment.push({
        ...structuredClone(template),
        id: `${slot}-extra-${i}`,
        name: `合成 ${slot} ${i}`,
      });
    }
  }
  await load(page, archive);
  await page.getByRole('button', { name: '開始最佳化' }).click();
  await expect(page.getByRole('status', { name: '最佳化進度' })).toContainText(
    '搜尋中：',
  );
  await page.getByRole('button', { name: '取消最佳化' }).click();
  await expect(page.getByRole('status', { name: '最佳化進度' })).toHaveText(
    '已取消，未保存部分排名或修改配置',
  );
  await expect(page.getByLabel('最佳化結果')).toHaveCount(0);
  await page.getByLabel('鎖定 head').selectOption('head-0');
  await page.getByLabel('鎖定 weapon').selectOption('weapon-0');
  await page.getByRole('button', { name: '開始最佳化' }).click();
  await expect(page.getByLabel('候選DPS 1')).toBeVisible();
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const backup = JSON.parse(
    await readFile((await (await download).path())!, 'utf8'),
  );
  expect(backup.builds).toHaveLength(1);
  expect(backup.builds[0]).toEqual(originalBuild);
  expect(backup.equipment).toHaveLength(archive.equipment.length);
});
