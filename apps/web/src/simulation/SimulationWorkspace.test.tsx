import { simulate, type SimulationRequest } from '@wwm/combat-engine';
import { combatFixture } from '../../../../packages/combat-engine/src/test/fixtures';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulationOutput, SimulationPanel } from './SimulationWorkspace';
import { combatArchive } from '../../../../packages/combat-engine/src/test/fixtures';
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
});
describe('S11 worker lifecycle', () => {
  it('cancels, isolates old messages, restarts and terminates on unmount', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const user = userEvent.setup();
    const view = render(
      <SimulationPanel archive={combatArchive()} buildId="synthetic-build" />,
    );
    await user.click(screen.getByRole('button', { name: '開始模擬' }));
    const first = FakeWorker.instances[0];
    expect(first.postMessage.mock.calls[0][0].seed).toBe(0);
    await user.click(screen.getByRole('button', { name: '取消模擬' }));
    expect(first.terminate).toHaveBeenCalled();
    first.onmessage?.({ data: { type: 'ERROR', message: 'stale error' } });
    expect(screen.queryByText('stale error')).toBeNull();
    await user.click(screen.getByRole('button', { name: '開始模擬' }));
    expect(FakeWorker.instances).toHaveLength(2);
    view.unmount();
    expect(FakeWorker.instances[1].terminate).toHaveBeenCalled();
  });
  it('labels estimated dependencies individually and hides charts when blocked', () => {
    const combat = combatFixture();
    combat.build.panelMode = 'EQUIPMENT_INCLUDED';
    combat.build.equipmentIds = [];
    combat.equipment = [];
    combat.release.combat!.evidence.status = 'ESTIMATED';
    const request: SimulationRequest = {
      combat,
      mode: 'EXPECTED',
      seed: 0,
      samples: 1,
    };
    const view = render(
      <SimulationOutput request={request} result={simulate(request)} />,
    );
    expect(screen.getByRole('heading', { name: '包含預估資料' })).toBeVisible();
    expect(screen.getByLabelText('預估值依賴')).toHaveTextContent('預估值');
    expect(screen.getByRole('img')).toBeVisible();
    combat.onlyExplicit = true;
    view.rerender(
      <SimulationOutput request={request} result={simulate(request)} />,
    );
    expect(screen.getByLabelText('平均DPS')).toHaveTextContent('無法計算');
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('requires saved rotation and rejects blank seed', async () => {
    const user = userEvent.setup(),
      archive = combatArchive();
    delete archive.builds[0].rotation;
    render(<SimulationPanel archive={archive} buildId="synthetic-build" />);
    await user.click(screen.getByRole('button', { name: '開始模擬' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      '請先在循環驗證頁保存循環',
    );
  });
});
