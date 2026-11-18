import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { optimize } from '@wwm/optimizer';
import { OptimizationPanel, OptimizationOutput } from './OptimizationWorkspace';
import {
  optimizerArchive,
  optimizerFixture,
} from '../../../../packages/optimizer/src/test/fixtures';
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
describe('S13 optimization UI', () => {
  it('cancels, isolates stale worker messages, restarts and terminates on unmount', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const user = userEvent.setup(),
      view = render(
        <OptimizationPanel
          archive={optimizerArchive()}
          buildId="synthetic-build"
        />,
      );
    await user.click(screen.getByRole('button', { name: '開始最佳化' }));
    const first = FakeWorker.instances[0];
    expect(first.postMessage.mock.calls[0][0].combat.build.panelMode).toBe(
      'BASE_ONLY',
    );
    await user.click(screen.getByRole('button', { name: '取消最佳化' }));
    expect(first.terminate).toHaveBeenCalled();
    first.onmessage?.({ data: { type: 'ERROR', message: 'stale' } });
    expect(screen.queryByText('stale')).toBeNull();
    await user.click(screen.getByRole('button', { name: '開始最佳化' }));
    view.unmount();
    expect(FakeWorker.instances[1].terminate).toHaveBeenCalled();
  });
  it('shows conditional scope, full DPS and explicit estimated dependency text', () => {
    const request = optimizerFixture();
    request.combat.release!.formulas[0].evidence!.status = 'ESTIMATED';
    render(
      <OptimizationOutput
        result={optimize(request)}
        request={request}
        onApply={async () => {}}
        busy={false}
      />,
    );
    expect(screen.getByLabelText('候選DPS 1')).toHaveTextContent('930');
    expect(screen.getByLabelText('最佳化候選 1')).toHaveTextContent(
      '包含預估資料',
    );
    expect(screen.getAllByLabelText('最佳化預估依賴')[0]).toHaveTextContent(
      '預估值',
    );
    expect(screen.getByLabelText('最佳化結果')).toHaveTextContent('僅本次輸入');
  });
  it('requires base panel and a saved rotation without launching a worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const archive = optimizerArchive();
    archive.builds[0].panelMode = 'EQUIPMENT_INCLUDED';
    render(<OptimizationPanel archive={archive} buildId="synthetic-build" />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '開始最佳化' }));
    expect(
      screen.getByRole('status', { name: '最佳化進度' }),
    ).toHaveTextContent('基礎面板');
    expect(FakeWorker.instances).toEqual([]);
  });
});
