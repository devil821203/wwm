import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EquipmentCards from './EquipmentCards';
import { emptyEquipment, unknownValue } from './editor-model';
import { combatArchive } from '../../../../packages/combat-engine/src/test/fixtures';

describe('裝備卡片', () => {
  it('顯示待核對的截圖詞條，篩選部位並開啟編輯', async () => {
    const user = userEvent.setup();
    const item = {
      ...emptyEquipment(),
      id: 'draft-head',
      name: '截圖冠冑',
      slotId: 'head',
      creationMethod: 'SCREENSHOT' as const,
      affixes: [
        {
          affixId: 'draft-affix',
          valueMode: 'MANUAL' as const,
          current: unknownValue(null),
          effective: unknownValue(null),
          maximum: unknownValue(null),
          observation: {
            rawName: '會意率',
            rawText: '會意率 4.9%',
            value: 4.9,
            origin: 'SCREENSHOT' as const,
            manuallyConfirmed: false,
          },
        },
      ],
    };
    const open = vi.fn();
    render(
      <EquipmentCards
        equipment={[item]}
        images={[]}
        builds={[]}
        releases={[]}
        onOpen={open}
      />,
    );
    expect(screen.getByText('會意率')).toBeInTheDocument();
    expect(screen.getByText('（待核對）')).toBeVisible();
    expect(screen.getByText('+4.9%')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '劍' }));
    expect(screen.queryByText('截圖冠冑')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '冠冑' }));
    await user.click(screen.getByRole('button', { name: /截圖冠冑/ }));
    expect(open).toHaveBeenCalledWith(item);
  });
  it('已配裝篩選只顯示實際被配置引用的裝備', async () => {
    const archive = combatArchive();
    const item = archive.equipment[0];
    archive.builds[0].equipmentIds = [item.id];
    render(
      <EquipmentCards
        equipment={[item, { ...item, id: 'unused' }]}
        images={[]}
        builds={archive.builds}
        releases={archive.dataReleases}
        onOpen={vi.fn()}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '已配裝' }));
    expect(screen.getByText('顯示 1 件')).toBeVisible();
  });
});
