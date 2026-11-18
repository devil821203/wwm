import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  combatArchive,
  recorded,
} from '../../packages/combat-engine/src/test/fixtures.js';
test('Worker模擬：期望、seed重現、取消、快照及來源', async ({
  page,
}, testInfo) => {
  const archive = combatArchive();
  archive.builds[0].panelMode = 'EQUIPMENT_INCLUDED';
  archive.builds[0].equipmentIds = [];
  archive.equipment = [];
  const parameters = archive.dataReleases[0].formulas[0].parameters;
  parameters['normal-probability'] = recorded(0.5);
  parameters['miss-probability'] = recorded(0.5);
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'synthetic-simulation.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await page.getByRole('button', { name: '模擬中心', exact: true }).click();
  await page.getByLabel('模擬配置').selectOption('synthetic-build');
  await page.getByRole('button', { name: '開始模擬' }).click();
  await expect(page.getByLabel('平均DPS')).not.toHaveText('無法計算');
  await expect(
    page.getByRole('img', { name: '期望累積傷害曲線' }),
  ).toBeVisible();
  await page.getByLabel('模擬模式').selectOption('MONTE_CARLO');
  const snapshots = [];
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '開始模擬' }).click();
    await expect(page.getByRole('status', { name: '模擬進度' })).toHaveText(
      '模擬完成',
    );
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: '下載模擬快照' }).click();
    const download = await event;
    snapshots.push(
      JSON.parse(await readFile((await download.path())!, 'utf8')),
    );
  }
  expect(snapshots[0].result.samples).toEqual(snapshots[1].result.samples);
  expect(snapshots[0].result.sampleCount).toBe(100);
  expect(snapshots[0].result.meanDps).not.toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'management/tests/artifacts/S11-' + testInfo.project.name + '.png',
    fullPage: true,
  });
  await page.getByLabel('樣本數').fill('10000');
  await page.getByRole('button', { name: '開始模擬' }).click();
  await page.getByRole('button', { name: '取消模擬' }).click();
  await expect(page.getByRole('status', { name: '模擬進度' })).toHaveText(
    '已取消，未保留部分DPS',
  );
  await expect(page.getByLabel('平均DPS')).toHaveCount(0);
  await page.getByLabel('樣本數').fill('2');
  await page.getByRole('button', { name: '開始模擬' }).click();
  await expect(page.getByRole('status', { name: '模擬進度' })).toHaveText(
    '模擬完成',
  );
});
