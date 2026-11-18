import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OcrPanel from './OcrPanel';
const images = [
  {
    id: 'fixture',
    equipmentId: 'item',
    name: 'fixture.png',
    dataUrl: 'data:image/png;base64,AAAA',
    width: 10,
    height: 10,
    savedAt: '2026-11-17T00:00:00+08:00',
  },
];
describe('OCR candidate review UI', () => {
  it('requires an explicit add action and exposes unknown confidence', async () => {
    const add = vi.fn(() => 'Added for review');
    const user = userEvent.setup();
    render(
      <OcrPanel
        images={images}
        disabled={false}
        onAdd={add}
        onMetadata={() => false}
      />,
    );
    await user.selectOptions(screen.getByLabelText('辨識方式'), 'text');
    await user.type(
      screen.getByLabelText('外部辨識或人工抄錄文字'),
      '詞條\nAttack 0',
    );
    await user.click(screen.getByRole('button', { name: '解析文字候選' }));
    await screen.findByLabelText('候選名稱 1');
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByText('辨識信心：未知')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: '加入候選 1（未確認）' }),
    );
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Attack', text: '0' }),
      'affix',
    );
  });
  it('does not claim metadata was applied when a manual value is protected', async () => {
    const user = userEvent.setup();
    render(
      <OcrPanel
        images={images}
        disabled={false}
        onAdd={() => ''}
        onMetadata={() => false}
      />,
    );
    await user.selectOptions(screen.getByLabelText('辨識方式'), 'text');
    await user.type(
      screen.getByLabelText('外部辨識或人工抄錄文字'),
      'Name: OCR Name',
    );
    await user.click(screen.getByRole('button', { name: '解析文字候選' }));
    await user.click(
      await screen.findByRole('button', { name: '填入裝備名稱候選' }),
    );
    expect(
      screen.getByText('已有資料或曾手動修改，保留原值；請於欄位自行修正。'),
    ).toBeVisible();
  });
});
