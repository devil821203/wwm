import { expect, test } from '@playwright/test';

test('production 首頁可啟動且不顯示虛構傷害', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('燕雲十六聲 · 傷害計算器');
  await expect(
    page.getByRole('heading', { name: '尚無可信 DPS' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /查看計算準備狀態/ }).click();
  await expect(page).toHaveURL(/#workspace$/);
  await page.getByRole('button', { name: /查看缺失資料/ }).click();
  await expect(page.getByText('技能係數與傷害公式')).toBeVisible();
  await page.getByRole('button', { name: /收起缺失資料/ }).click();
  await expect(page.getByText('技能係數與傷害公式')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
