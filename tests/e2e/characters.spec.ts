import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('角色與配置可持久化並用JSON備份還原', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '裝備庫', exact: true }).click();
  await page.getByLabel('裝備名稱（玩家標籤）').fill('測試配裝');
  await page.getByRole('button', { name: '確認並儲存裝備' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '裝備已儲存，尚未完成合法值驗證。',
  );
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await expect(page.getByLabel('角色名稱')).toBeVisible();
  await page.getByLabel('角色名稱').fill('燕雲測試俠客');
  await page.getByLabel('角色流派').selectOption('silkbind_wings');
  await expect(page.getByLabel('角色可用等級')).toBeDisabled();
  await page.getByRole('button', { name: '建立角色', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('角色已建立。');
  await page.getByRole('button', { name: '編輯角色', exact: true }).click();
  await page.getByLabel('角色名稱').fill('燕雲備份俠客');
  await page.getByRole('button', { name: '儲存角色', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('角色已儲存。');
  await page.getByLabel('配置名稱').fill('首套配置');
  await page.getByLabel('配置備註').fill('已含裝備面板，不重複加總。');
  await page.getByRole('checkbox', { name: /測試配裝/ }).check();
  await page
    .getByLabel('心法名稱（每行一個）')
    .fill('易水歌\n無名心法\n千山法\n凝神章');
  await page.getByLabel('面板項目名稱').fill('會心率（實算）');
  await page.getByLabel('面板項目數值').fill('25.8');
  await page.getByLabel('面板項目單位').selectOption('%');
  await page.getByRole('button', { name: '新增面板紀錄' }).click();
  await page
    .getByLabel('面板是否已包含裝備')
    .selectOption('EQUIPMENT_INCLUDED');
  await page.getByRole('button', { name: '儲存配置', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('配置已儲存。');
  await page.getByRole('button', { name: '複製配置', exact: true }).click();
  await expect(page.getByLabel('配置名稱')).toHaveValue('首套配置 副本');

  await page.reload();
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /燕雲備份俠客/ }),
  ).toBeVisible();
  await expect(page.getByLabel('配置備註')).toHaveValue(
    '已含裝備面板，不重複加總。',
  );
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const download = await downloading;
  const backup = await readFile((await download.path())!, 'utf8');
  const saved = JSON.parse(backup);
  expect(saved.builds).toHaveLength(2);
  expect(saved.builds[0].equipmentIds).toHaveLength(1);
  expect(saved.builds[0].recordedInnerWays).toEqual([
    '易水歌',
    '無名心法',
    '千山法',
    '凝神章',
  ]);
  expect(saved.builds[0].recordedPanel[0]).toMatchObject({
    label: '會心率（實算）',
    value: 25.8,
    unit: '%',
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '刪除角色', exact: true }).click();
  await expect(
    page.getByText('還沒有角色，從右側建立第一位俠客。'),
  ).toBeVisible();

  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await expect(page.getByRole('heading', { name: '備份預覽' })).toBeVisible();
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await expect(
    page.getByRole('button', { name: /燕雲備份俠客/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '首套配置 副本', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('無效備份不破壞角色', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('角色名稱').fill('保留角色');
  await page.getByRole('button', { name: '建立角色', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('角色已建立。');
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":"99"}'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: /保留角色/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '匯入已檢查備份' }),
  ).toHaveCount(0);
});
test('匯入版本只列合法等級，手動面板零值可保存', async ({ page }) => {
  const at = '2026-11-17T00:00:00+08:00';
  const version = 'synthetic-browser';
  const backup = {
    format: 'WWM_PLAYER_ARCHIVE',
    schemaVersion: '1.0.0',
    exportedAt: at,
    characters: [],
    builds: [],
    equipment: [],
    overrides: [],
    dataReleases: [
      {
        schemaVersion: '1.0.0',
        purpose: 'SYNTHETIC_TEST',
        version: {
          id: version,
          region: 'GLOBAL',
          label: '瀏覽器合成測試',
          availableLevels: [2, 9],
          levelCap: 9,
        },
        paths: [
          {
            id: 'synthetic-path',
            gameVersionId: version,
            zhTW: '測試流派',
            en: 'Synthetic',
            martialArts: ['A', 'B'],
            role: 'DPS',
            mechanicsHint: [],
            translationVerified: false,
            formulaStatus: 'UNKNOWN',
            martialArtIds: ['synthetic-art'],
            formulaIds: [],
          },
        ],
        martialArts: [
          {
            id: 'synthetic-art',
            gameVersionId: version,
            name: '測試武學',
            translationVerified: false,
            skillIds: [],
          },
        ],
        stats: [
          {
            id: 'synthetic-attack',
            gameVersionId: version,
            name: '測試屬性',
            unit: 'points',
            description: 'Synthetic only',
          },
        ],
        sources: [],
        formulas: [],
        skills: [],
        equipment: [],
        affixes: [],
        affixCaps: [],
      },
    ],
  };
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'synthetic.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await page.getByLabel('角色名稱').fill('版本測試角色');
  await page.getByLabel('角色資料版本').selectOption(version);
  await expect(page.getByLabel('角色可用等級').locator('option')).toHaveCount(
    3,
  );
  await page.getByLabel('角色可用等級').selectOption('9');
  await page.getByRole('button', { name: '建立角色', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('角色已建立。');
  await page.getByLabel('面板屬性項目').selectOption('synthetic-attack');
  await page.getByLabel('面板數值（手動確認）').fill('0');
  await page.getByRole('button', { name: '套用手動面板值' }).click();
  await expect(page.getByText('測試屬性：0（手動輸入）')).toBeVisible();
  await page.getByLabel('配置武學').selectOption('synthetic-art');
  await page.getByLabel('武學等級（手動輸入，未校驗上限）').fill('3');
  await page.getByRole('button', { name: '套用武學等級' }).click();
  await page.getByRole('button', { name: '儲存配置', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('配置已儲存。');
  await page.reload();
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await expect(page.getByText('測試屬性：0（手動輸入）')).toBeVisible();
  await expect(page.getByText('測試武學：3（手動輸入）')).toBeVisible();
});

test('機體快照保存並隨備份還原', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('角色名稱').fill('快照角色');
  await page.getByRole('button', { name: '建立角色', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('角色已建立。');
  await page.getByRole('button', { name: '保存機體快照' }).click();
  await expect(page.getByRole('status')).toHaveText('機體快照已保存。');
  await page.reload();
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '機體快照' }).getByText(/預設配置/),
  ).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 JSON 備份' }).click();
  const download = await downloading;
  const backup = await readFile((await download.path())!, 'utf8');
  const saved = JSON.parse(backup);
  expect(saved.format).toBe('WWM_PLAYER_BACKUP');
  expect(saved.snapshots).toHaveLength(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '刪除角色', exact: true }).click();
  await page.getByLabel('匯入玩家備份').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await page.getByRole('button', { name: '匯入已檢查備份' }).click();
  await expect(page.getByRole('status')).toHaveText('備份已匯入。');
  await expect(
    page.getByRole('region', { name: '機體快照' }).getByText(/預設配置/),
  ).toBeVisible();
});
