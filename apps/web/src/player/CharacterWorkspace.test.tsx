import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CharacterWorkspace from './CharacterWorkspace';
import { playerDatabase, playerRepository } from './database';

beforeEach(async () => {
  await playerDatabase.transaction(
    'rw',
    [
      playerDatabase.characters,
      playerDatabase.builds,
      playerDatabase.equipment,
      playerDatabase.overrides,
      playerDatabase.dataReleases,
    ],
    async () => {
      await Promise.all([
        playerDatabase.characters.clear(),
        playerDatabase.builds.clear(),
        playerDatabase.equipment.clear(),
        playerDatabase.overrides.clear(),
        playerDatabase.dataReleases.clear(),
      ]);
    },
  );
});
describe('角色與配置畫面', () => {
  it('creates a candidate-path draft and stores its default Build', async () => {
    const user = userEvent.setup();
    render(<CharacterWorkspace />);
    await screen.findByLabelText('角色名稱');
    expect(
      screen.getByLabelText('角色流派').querySelectorAll('option'),
    ).toHaveLength(11);
    expect(screen.getByLabelText('角色可用等級')).toBeDisabled();
    await user.type(screen.getByLabelText('角色名稱'), '畫面測試俠客');
    await user.click(screen.getByRole('button', { name: '建立角色' }));
    await screen.findByText('角色已建立。');
    expect((await playerRepository.snapshot()).characters[0]).toMatchObject({
      name: '畫面測試俠客',
      level: null,
    });
    expect(await screen.findByLabelText('配置名稱')).toHaveValue('預設配置');
  });
  it('shows saved panel and inner ways while blocking unsupported DPS', async () => {
    const id = await playerRepository.createCharacter({
      name: '面板角色',
      pathId: 'bellstrike_splendor',
      gameVersionId: null,
      level: null,
      realm: '',
    });
    const build = (await playerRepository.snapshot()).builds.find(
      (item) => item.characterId === id,
    )!;
    await playerRepository.updateBuild({
      ...build,
      panelMode: 'EQUIPMENT_INCLUDED',
      recordedInnerWays: ['易水歌'],
      recordedPanel: [
        { id: 'test-panel', label: '會心率（實算）', value: 25.8, unit: '%' },
      ],
    });
    render(<CharacterWorkspace />);
    const summary = await screen.findByRole('region', {
      name: '目前配置屬性與期望DPS',
    });
    expect(summary).toHaveTextContent('易水歌');
    expect(summary).toHaveTextContent('25.8%');
    expect(summary).toHaveTextContent('無法計算');
    expect(summary).toHaveTextContent('尚未對照版本資料');
    expect(summary).toHaveTextContent('預估值');
    expect(
      screen.queryByRole('button', { name: '開始模擬' }),
    ).not.toBeInTheDocument();
  });
  it('shows storage errors and keeps unsaved input instead of claiming success', async () => {
    const user = userEvent.setup();
    render(<CharacterWorkspace />);
    await screen.findByLabelText('角色名稱');
    vi.spyOn(playerRepository, 'createCharacter').mockRejectedValueOnce(
      new Error('儲存空間不足'),
    );
    await user.type(screen.getByLabelText('角色名稱'), '尚未保存');
    await user.click(screen.getByRole('button', { name: '建立角色' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('儲存空間不足');
    expect(screen.getByLabelText('角色名稱')).toHaveValue('尚未保存');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '建立角色' })).toBeEnabled(),
    );
  });
});
