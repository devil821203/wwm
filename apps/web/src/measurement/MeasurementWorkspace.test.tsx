import type { Measurement } from '@wwm/game-data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MeasurementForm, MeasurementReport } from './MeasurementWorkspace';
import { createMeasurement, type MeasurementFields } from './input-model';
import {
  damageArchive,
  measurementFixture,
} from '../../../../packages/stat-engine/src/test/fixtures';
const fields: MeasurementFields = {
  label: 'Synthetic observation',
  kind: 'SINGLE_SKILL',
  skillId: 'synthetic-skill',
  variantId: '',
  enemyName: 'Synthetic enemy',
  enemyLevel: '3',
  enemyConditions: 'Fixed synthetic multiplier',
  conditions: 'Fixed full casts',
  sampling: 'UNFILTERED_CAST_TOTAL',
  samplesText: '0\n393.39',
  source: 'Synthetic text source',
  evidenceKind: 'TEXT',
  comparisonContextConfirmed: true,
  confirmed: true,
};
describe('S09 observation UI and input', () => {
  it('preserves zero and original precision, refusing ambiguous input', () => {
    const a = damageArchive();
    expect(createMeasurement(a, 'synthetic-build', fields).samples).toEqual([
      0, 393.39,
    ]);
    expect(() =>
      createMeasurement(a, 'synthetic-build', {
        ...fields,
        samplesText: '12,34',
      }),
    ).toThrow('每行');
    expect(() =>
      createMeasurement(a, 'synthetic-build', { ...fields, confirmed: false }),
    ).toThrow('核對');
  });
  it('saves explicit form input without changing coefficient data', async () => {
    const archive = damageArchive();
    const save = vi.fn(async (measurement: Measurement) => {
      void measurement;
    });
    const before = JSON.stringify(archive);
    const user = userEvent.setup();
    render(
      <MeasurementForm
        archive={archive}
        buildId="synthetic-build"
        busy={false}
        onSave={save}
      />,
    );
    await user.type(screen.getByLabelText('紀錄名稱'), '合成觀察');
    await user.selectOptions(
      screen.getByLabelText('實測技能'),
      'synthetic-skill',
    );
    await user.type(screen.getByLabelText('固定敵人'), '合成敵人');
    await user.type(
      screen.getByLabelText('敵人防禦、抗性與狀態說明'),
      'Synthetic conditions',
    );
    await user.type(
      screen.getByLabelText('固定狀態／施放流程'),
      'Full casts only',
    );
    await user.type(
      screen.getByLabelText('傷害樣本（每行一筆，0可保留）'),
      '0\n393.39',
    );
    await user.type(
      screen.getByLabelText('文字來源或截圖參照（不自動保存圖片）'),
      'Synthetic source',
    );
    await user.click(
      screen.getByLabelText('已逐筆核對版本、面板、條件與傷害樣本'),
    );
    await user.click(screen.getByRole('button', { name: '保存實測快照' }));
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0]).toMatchObject({
      samples: [0, 393.39],
      status: 'OBSERVATION_ONLY',
      confirmed: true,
    });
    expect(JSON.stringify(archive)).toBe(before);
  });
  it('labels every report as uncalibrated and shows zero denominator handling', () => {
    const m = measurementFixture();
    m.samples = [0, 0];
    render(<MeasurementReport measurement={m} />);
    expect(screen.getByLabelText('實測比較結果')).toHaveTextContent(
      '觀察比較，未校準',
    );
    expect(screen.getByLabelText('實測比較結果')).toHaveTextContent(
      '零值排除：2',
    );
    expect(screen.getByLabelText('實測比較結果')).toHaveTextContent(
      '不回寫主資料',
    );
  });
});
