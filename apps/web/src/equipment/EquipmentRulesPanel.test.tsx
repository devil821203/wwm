import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EquipmentRulesPanel from './EquipmentRulesPanel';
import { rulesFixture } from '../../../../packages/game-data/src/test/equipment-rules-fixture';
import { applyManualRows, rowsFrom } from './editor-model';
describe('S07 equipment rule preview', () => {
  it('labels estimates and exposes formula inputs, while legal MAX needs an explicit action', async () => {
    const f = rulesFixture();
    const maximum = vi.fn();
    const user = userEvent.setup();
    render(
      <EquipmentRulesPanel
        disabled={false}
        getEquipment={() => f.item}
        release={f.release}
        onlyExplicit={false}
        onOnlyExplicit={vi.fn()}
        onMaximum={maximum}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: '預覽有效值與合法性' }),
    );
    const preview = screen.getByLabelText('有效值預覽');
    expect(within(preview).getByText('94 · 預估值')).toBeVisible();
    expect(preview).toHaveTextContent('包含預估資料');
    expect(preview).toHaveTextContent('synthetic-model-1');
    expect(maximum).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: '填入已驗證合法滿值' }),
    );
    expect(maximum).toHaveBeenCalledOnce();
  });
  it('disables legal MAX with missing rules and supports explicit-only filter', async () => {
    const f = rulesFixture();
    delete f.definition.legality;
    const filter = vi.fn();
    const user = userEvent.setup();
    render(
      <EquipmentRulesPanel
        disabled={false}
        getEquipment={() => f.item}
        release={f.release}
        onlyExplicit={true}
        onOnlyExplicit={filter}
        onMaximum={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: '預覽有效值與合法性' }),
    );
    expect(
      screen.getByRole('button', { name: '填入已驗證合法滿值' }),
    ).toBeDisabled();
    await user.click(screen.getByLabelText('僅使用明確資料（禁止推估）'));
    expect(filter).toHaveBeenCalledWith(false);
  });
  it('persists exclusive modes without overwriting the current value or original evidence', () => {
    const f = rulesFixture();
    const rows = rowsFrom(f.item, 'affix', f.release);
    rows[0].valueMode = 'MAX';
    rows[0].maxOnChengYinConfirmed = true;
    const item = applyManualRows(structuredClone(f.item), [], rows, f.item);
    expect(item.affixes[0].valueMode).toBe('MAX');
    expect(item.affixes[0].current).toEqual(f.item.affixes[0].current);
  });
});
