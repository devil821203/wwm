import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('資料尚未就緒的首頁', () => {
  it('不提供虛構 DPS、版本或等級', () => {
    render(<App />);
    expect(screen.getByText('尚無可信 DPS')).toBeVisible();
    expect(screen.getByLabelText('尚無 DPS 結果')).toHaveTextContent('— DPS');
    expect(screen.getByLabelText('遊戲資料版本')).toBeDisabled();
    expect(screen.getByLabelText('角色等級')).toBeDisabled();
  });
  it('可展開及收起必要資料缺失清單', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /查看缺失資料/ }));
    expect(screen.getByText('技能係數與傷害公式')).toBeVisible();
    expect(
      screen.getByRole('button', { name: /收起缺失資料/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: /收起缺失資料/ }));
    expect(screen.queryByText('技能係數與傷害公式')).not.toBeInTheDocument();
  });
});
