import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import EquipmentWorkshop from './EquipmentWorkshop';
import { generationFixture } from '../../../../packages/game-data/src/test/generation-fixture';
describe('S12 equipment workshop', () => {
  it('does not invent a data version or generate without a confirmation', () => {
    render(
      <EquipmentWorkshop releases={[]} equipment={[]} onOpen={() => {}} />,
    );
    expect(screen.getByText(/沒有版本化裝備規則/)).toBeVisible();
    expect(screen.getByRole('button', { name: '預覽生成候選' })).toBeDisabled();
  });
  it('previews chengyin estimates, opens shared editor and clears stale output', async () => {
    const user = userEvent.setup(),
      f = generationFixture(),
      open = vi.fn();
    render(
      <EquipmentWorkshop releases={[f.release]} equipment={[]} onOpen={open} />,
    );
    await user.selectOptions(
      screen.getByLabelText('生成資料版本'),
      f.release.version.id,
    );
    await user.selectOptions(
      screen.getByLabelText('生成裝備定義'),
      f.definitionId,
    );
    await user.selectOptions(screen.getByLabelText('使用角色等級'), '3');
    await user.selectOptions(screen.getByLabelText('生成調律階段'), '0');
    await user.click(screen.getByLabelText('Synthetic affix'));
    await user.selectOptions(
      screen.getByLabelText('生成詞條模式'),
      'CHENG_YIN',
    );
    await user.click(
      screen.getByLabelText('確認這些是模擬設定，非遊戲實測或取得證明'),
    );
    await user.click(screen.getByRole('button', { name: '預覽生成候選' }));
    expect(screen.getByLabelText('生成預覽')).toHaveTextContent('預估值');
    expect(screen.getByLabelText('生成預覽')).toHaveTextContent('94');
    await user.click(
      screen.getByRole('button', { name: '以共用編輯器開啟候選 1' }),
    );
    expect(open.mock.calls[0][0].creationMethod).toBe('GENERATED');
    await user.click(screen.getByLabelText('僅使用明確資料（生成）'));
    expect(screen.queryByLabelText('生成預覽')).toBeNull();
    await user.click(screen.getByRole('button', { name: '預覽生成候選' }));
    expect(screen.getByLabelText('生成預覽')).toHaveTextContent('未知');
  });
});
