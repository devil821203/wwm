import { expect, test } from '@playwright/test';

test('鳴金·虹試算顯示所選配置', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '角色與配置', exact: true }).click();
  await page.getByLabel('角色名稱').fill('試算角色');
  await page.getByRole('button', { name: '建立角色', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('角色已建立。');
  await page.getByLabel('心法名稱（每行一個）').fill('易水歌');
  await page.getByLabel('面板項目名稱').fill('會心率（實算）');
  await page.getByLabel('面板項目數值').fill('25.8');
  await page.getByLabel('面板項目單位').selectOption('%');
  await page.getByRole('button', { name: '新增面板紀錄' }).click();
  await page.getByRole('button', { name: '儲存配置', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('配置已儲存。');
  await page.getByRole('button', { name: '鳴金·虹試算' }).click();
  await expect(
    page.getByRole('heading', { name: '鳴金·虹試算' }),
  ).toBeVisible();
  await page
    .getByLabel('選擇鳴金·虹配置')
    .selectOption({ label: '試算角色 · 預設配置' });
  const summary = page.getByRole('region', { name: '目前配置屬性與期望DPS' });
  await expect(summary).toContainText('易水歌');
  await expect(summary).toContainText('25.8%');
  await expect(summary).toContainText('無法計算');
  await expect(page.getByLabel('預估平均 DPS')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
