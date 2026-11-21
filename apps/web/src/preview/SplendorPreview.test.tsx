import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('鳴金·虹試算紀錄', () => {
  it('可由主選單查看預估結果和固定紀錄限制', async () => {
    render(<App />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '鳴金·虹試算' }));
    expect(
      await screen.findByRole('heading', { name: '鳴金·虹試算' }),
    ).toBeVisible();
    expect(screen.getByLabelText('預估平均 DPS')).toHaveTextContent('56,382');
    expect(screen.getByText('包含預估資料')).toBeVisible();
    expect(screen.getByText(/更改角色配置不會自動更新結果/)).toBeVisible();
    expect(screen.getByText(/易水歌、無名心法、千山法、凝神章/)).toBeVisible();
  });
});
