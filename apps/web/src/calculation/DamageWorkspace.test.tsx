import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DamageCalculator } from './DamageWorkspace';
import {
  damageArchive,
  unknown,
} from '../../../../packages/stat-engine/src/test/fixtures';
describe('S08 damage trace UI', () => {
  it('shows estimated dependencies, clears stale results when filtering and keeps DPS unavailable', async () => {
    const archive = damageArchive();
    archive.dataReleases[0].affixCaps[0].chengYinValue = unknown();
    const user = userEvent.setup();
    render(<DamageCalculator archive={archive} buildId="synthetic-build" />);
    await user.selectOptions(
      screen.getByLabelText('單技能'),
      'synthetic-skill',
    );
    await user.click(
      screen.getByRole('button', { name: '計算單技能期望傷害' }),
    );
    const result = screen.getByLabelText('單技能計算結果');
    expect(within(result).getByLabelText('期望傷害數值')).not.toHaveTextContent(
      '無法計算',
    );
    expect(within(result).getByLabelText('期望傷害數值')).toHaveTextContent(
      '393.39',
    );
    expect(result).toHaveTextContent('包含預估資料 · 預估值');
    expect(result).toHaveTextContent('尚無可信 DPS');
    expect(result).toHaveTextContent('synthetic-ratio-1');
    await user.click(screen.getByLabelText('僅使用明確資料（傷害計算）'));
    expect(screen.queryByLabelText('單技能計算結果')).toBeNull();
    await user.click(
      screen.getByRole('button', { name: '計算單技能期望傷害' }),
    );
    expect(screen.getByLabelText('期望傷害數值')).toHaveTextContent('無法計算');
  });
  it('lists concrete missing formula evidence without fabricating a number', async () => {
    const archive = damageArchive();
    delete archive.dataReleases[0].formulas[0].evidence;
    const user = userEvent.setup();
    render(<DamageCalculator archive={archive} buildId="synthetic-build" />);
    await user.selectOptions(
      screen.getByLabelText('單技能'),
      'synthetic-skill',
    );
    await user.click(
      screen.getByRole('button', { name: '計算單技能期望傷害' }),
    );
    expect(screen.getByLabelText('期望傷害數值')).toHaveTextContent('無法計算');
    expect(screen.getByLabelText('阻擋原因')).toHaveTextContent('公式尚缺驗證');
  });
});
