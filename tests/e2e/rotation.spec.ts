import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  combatArchive,
  combatFixture,
  utility,
} from '../../packages/combat-engine/src/test/fixtures.js';
async function load(page: Page, archive = combatArchive()) {
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'synthetic-combat.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await page.getByRole('button', { name: '循環驗證', exact: true }).click();
  await page.getByLabel('循環配置').selectOption('synthetic-build');
}
test('合成固定循環：事件、下載、保存與備份還原', async ({
  page,
  browser,
}, testInfo) => {
  await load(page);
  await page.getByRole('button', { name: '驗證循環事件' }).click();
  await expect(page.getByLabel('循環總傷害')).toHaveText('1674');
  await expect(page.getByLabel('循環驗證結果')).toContainText('1050ms');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path:
      'management/tests/artifacts/S10-' +
      (testInfo.project.name.startsWith('desktop') ? 'desktop' : 'mobile') +
      '.png',
    fullPage: true,
  });
  const traceEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載完整循環紀錄' }).click();
  const traceFile = await traceEvent;
  const trace = JSON.parse(await readFile((await traceFile.path())!, 'utf8'));
  expect(trace.format).toBe('WWM_ROTATION_TRACE');
  expect(trace.result.meanDps).toBeNull();
  expect(trace.result.finalState.resources.energy).toBe(4);
  await page.getByLabel('循環名稱', { exact: true }).fill('合成循環修正版');
  await page.getByRole('button', { name: '保存循環', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    '循環已保存；保存不代表已通過驗證。',
  );
  await page.reload();
  await page.getByRole('button', { name: '循環驗證', exact: true }).click();
  await page.getByLabel('循環配置').selectOption('synthetic-build');
  await expect(page.getByLabel('循環名稱', { exact: true })).toHaveValue(
    '合成循環修正版',
  );
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  const backupEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const backupFile = await backupEvent;
  const backup = JSON.parse(await readFile((await backupFile.path())!, 'utf8'));
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: page.viewportSize() ?? undefined,
  });
  try {
    const restored = await context.newPage();
    await load(restored, backup);
    await expect(restored.getByLabel('循環名稱', { exact: true })).toHaveValue(
      '合成循環修正版',
    );
    await restored.getByRole('button', { name: '驗證循環事件' }).click();
    await expect(restored.getByLabel('循環總傷害')).toHaveText('1674');
  } finally {
    await context.close();
  }
});
test('冷卻拒絕與優先序循環', async ({ page }) => {
  await load(page);
  await page.getByLabel('動作時間 2（毫秒）').fill('500');
  await page.getByRole('button', { name: '驗證循環事件' }).click();
  await expect(page.getByLabel('循環總傷害')).toHaveText('無法計算');
  await expect(page.getByLabel('循環驗證結果')).toContainText('冷卻');
  await page.getByLabel('循環模式').selectOption('PRIORITY');
  await expect(page.getByLabel('循環驗證結果')).toHaveCount(0);
  await page.getByRole('button', { name: '驗證循環事件' }).click();
  await expect(page.getByLabel('循環總傷害')).toHaveText('1674');
});
test('Buff及DOT由版本規則執行並顯示到期事件', async ({ page }) => {
  const f = combatFixture();
  const a = utility(f, 'buff-dot', [
    { id: 'buff', offsetMs: 0, kind: 'APPLY_BUFF', targetId: 'boost' },
    { id: 'dot', offsetMs: 0, kind: 'APPLY_DOT', targetId: 'burn' },
  ]);
  f.plan.actions = [
    { atMs: 0, action: a },
    {
      atMs: 1000,
      action: { kind: 'CAST', skillId: 'synthetic-skill', variantId: null },
    },
  ];
  f.build.rotation = f.plan;
  await load(page, {
    ...combatArchive(),
    builds: [f.build],
    dataReleases: [f.release],
  });
  await page.getByRole('button', { name: '驗證循環事件' }).click();
  await expect(page.getByLabel('循環總傷害')).toHaveText('3906');
  await expect(page.getByLabel('循環驗證結果')).toContainText('DOT_EXPIRE');
  await expect(page.getByLabel('循環驗證結果')).toContainText('BUFF_EXPIRE');
});
