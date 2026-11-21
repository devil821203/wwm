import { expect, test } from '@playwright/test';

test('鳴金·虹固定試算結果可在桌面與手機閱讀', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '鳴金·虹試算' }).click();
  await expect(
    page.getByRole('heading', { name: '鳴金·虹試算' }),
  ).toBeVisible();
  await expect(page.getByLabel('預估平均 DPS')).toHaveText('56,382 DPS');
  await expect(page.getByText('包含預估資料')).toBeVisible();
  await expect(page.getByText(/更改角色配置不會自動更新結果/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
