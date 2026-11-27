import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import SplendorPreview from './SplendorPreview';
import { playerDatabase, playerRepository } from '../player/database';

afterEach(async () => {
  await playerDatabase.delete();
});
describe('鳴金·虹試算配置', () => {
  it('切換配置時顯示所選面板並阻止沿用固定 DPS', async () => {
    const characterId = await playerRepository.createCharacter({
      name: '測試角色',
      pathId: 'bellstrike_splendor',
      gameVersionId: null,
      level: null,
      realm: '',
    });
    const first = (await playerRepository.snapshot()).builds[0];
    await playerRepository.updateBuild({
      ...first,
      name: '甲配置',
      recordedPanel: [
        { id: 'stat-a', label: '會心率（實算）', value: 25.8, unit: '%' },
      ],
      recordedInnerWays: ['易水歌'],
    });
    const secondId = await playerRepository.createBuild(characterId, '乙配置');
    const second = (await playerRepository.snapshot()).builds.find(
      (build) => build.id === secondId,
    )!;
    await playerRepository.updateBuild({
      ...second,
      recordedPanel: [
        { id: 'stat-b', label: '會心率（實算）', value: 39.2, unit: '%' },
      ],
      recordedInnerWays: ['千山法'],
    });
    const user = userEvent.setup();
    render(<SplendorPreview />);
    const select = await screen.findByLabelText('選擇鳴金·虹配置');
    await screen.findByRole('option', { name: '測試角色 · 甲配置' });
    await user.selectOptions(select, first.id);
    let summary = screen.getByRole('region', { name: '目前配置屬性與期望DPS' });
    expect(summary).toHaveTextContent('25.8%');
    expect(summary).toHaveTextContent('易水歌');
    expect(summary).toHaveTextContent('無法計算');
    expect(within(summary).queryByText('56,382')).not.toBeInTheDocument();
    await user.selectOptions(select, secondId);
    summary = screen.getByRole('region', { name: '目前配置屬性與期望DPS' });
    expect(summary).toHaveTextContent('39.2%');
    expect(summary).toHaveTextContent('千山法');
    expect(summary).not.toHaveTextContent('25.8%');
  });
});
