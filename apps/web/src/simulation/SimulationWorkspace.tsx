import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { PlayerArchive } from '@wwm/game-data';
import type { SimulationRequest, SimulationResult } from '@wwm/combat-engine';
import { playerRepository } from '../player/database';
export default function SimulationWorkspace({
  initialBuildId = '',
}: { initialBuildId?: string } = {}) {
  const loaded = useLiveQuery(async () => {
    try {
      return { archive: await playerRepository.snapshot(), error: '' };
    } catch {
      return { archive: null, error: '無法讀取本機配置' };
    }
  }, []);
  const [buildId, setBuildId] = useState(initialBuildId);
  return (
    <section className="character-workspace">
      <h1 className="page-title">模擬中心</h1>
      <p>
        使用已保存循環與版本化敵人倍率。敵人條件由公式參數提供；缺少時不補值。
      </p>
      {loaded?.error && <p role="alert">{loaded.error}</p>}
      <label htmlFor="simulation-build">模擬配置</label>
      <select
        id="simulation-build"
        value={buildId}
        onChange={(e) => setBuildId(e.target.value)}
      >
        <option value="">選擇配置</option>
        {loaded?.archive?.builds.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {loaded?.archive &&
        loaded.archive.builds.some((b) => b.id === buildId) && (
          <SimulationPanel
            key={JSON.stringify([buildId, loaded.archive])}
            archive={loaded.archive}
            buildId={buildId}
          />
        )}
    </section>
  );
}
export function SimulationPanel({
  archive,
  buildId,
}: {
  archive: PlayerArchive;
  buildId: string;
}) {
  const [mode, setMode] = useState<'EXPECTED' | 'MONTE_CARLO'>('EXPECTED');
  const [seed, setSeed] = useState('0'),
    [samples, setSamples] = useState('100');
  const [onlyExplicit, setOnlyExplicit] = useState(false);
  const [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SimulationResult>();
  const [snapshot, setSnapshot] = useState<SimulationRequest>();
  const worker = useRef<Worker | null>(null);
  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
    },
    [],
  );
  const clear = () => {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setResult(undefined);
    setStatus('');
  };
  function run() {
    clear();
    const build = archive.builds.find((b) => b.id === buildId)!;
    const character = archive.characters.find(
      (c) => c.id === build.characterId,
    )!;
    if (!build.rotation) {
      setStatus('請先在循環驗證頁保存循環');
      return;
    }
    if (
      !seed.trim() ||
      !samples.trim() ||
      !Number.isInteger(Number(seed)) ||
      Number(seed) < 0 ||
      Number(seed) > 4294967295 ||
      !Number.isInteger(Number(samples)) ||
      Number(samples) < 1 ||
      Number(samples) > 10000
    ) {
      setStatus('請輸入有效seed（0–4294967295）及樣本數（1–10000）');
      return;
    }
    const request: SimulationRequest = {
      mode,
      seed: Number(seed),
      samples: Number(samples),
      combat: {
        build,
        character,
        equipment: archive.equipment,
        release: archive.dataReleases.find(
          (r) => r.version.id === character.gameVersionId,
        ),
        plan: build.rotation,
        onlyExplicit,
        evaluatedAt: new Date().toISOString(),
      },
    };
    try {
      const current = new Worker(
        new URL('./simulation.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current = current;
      setBusy(true);
      setStatus('模擬中：0%');
      setSnapshot(request);
      current.onmessage = (event) => {
        if (worker.current !== current) return;
        const message = event.data;
        if (message.type === 'PROGRESS')
          setStatus(
            '模擬中：' +
              Math.round((message.completed / message.total) * 100) +
              '%',
          );
        else {
          if (message.type === 'RESULT') {
            setResult(message.result);
            setStatus('模擬完成');
          } else setStatus(message.message);
          current.terminate();
          worker.current = null;
          setBusy(false);
        }
      };
      current.onerror = () => {
        if (worker.current !== current) return;
        current.terminate();
        worker.current = null;
        setBusy(false);
        setStatus('Worker執行失敗，請重試');
      };
      current.postMessage(request);
    } catch {
      clear();
      setStatus('無法啟動Worker');
    }
  }
  return (
    <div className="panel">
      <p>固定 seed 可重現。時間窗與敵人倍率見完整快照。</p>
      <label htmlFor="simulation-mode">模擬模式</label>
      <select
        id="simulation-mode"
        value={mode}
        onChange={(e) => {
          clear();
          setMode(e.target.value as typeof mode);
        }}
      >
        <option value="EXPECTED">期望值</option>
        <option value="MONTE_CARLO">Monte Carlo</option>
      </select>
      <label htmlFor="simulation-seed">Seed</label>
      <input
        id="simulation-seed"
        type="number"
        value={seed}
        onChange={(e) => {
          clear();
          setSeed(e.target.value);
        }}
      />
      <label htmlFor="simulation-samples">樣本數</label>
      <input
        id="simulation-samples"
        type="number"
        min="1"
        max="10000"
        value={samples}
        onChange={(e) => {
          clear();
          setSamples(e.target.value);
        }}
      />
      <label>
        <input
          type="checkbox"
          checked={onlyExplicit}
          onChange={(e) => {
            clear();
            setOnlyExplicit(e.target.checked);
          }}
        />
        僅使用明確資料（DPS）
      </label>
      <div className="toolbar">
        <button className="secondary-button" disabled={busy} onClick={run}>
          開始模擬
        </button>
        <button
          className="secondary-button"
          disabled={!busy}
          onClick={() => {
            clear();
            setStatus('已取消，未保留部分DPS');
          }}
        >
          取消模擬
        </button>
      </div>
      <p role="status" aria-label="模擬進度">
        {status}
      </p>
      {result && <SimulationOutput result={result} request={snapshot!} />}
    </div>
  );
}
const format = (n: number | null) =>
  n === null
    ? '無法計算'
    : new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 3 }).format(n);
export function SimulationOutput({
  result,
  request,
}: {
  result: SimulationResult;
  request: SimulationRequest;
}) {
  const points = result.timeline;
  const max = Math.max(1, ...points.map((p) => p.cumulativeDamage));
  // At most 500 visible points; the download retains the full timeline.
  const shown = points.filter(
    (_, i) =>
      i % Math.max(1, Math.ceil(points.length / 500)) === 0 ||
      i === points.length - 1,
  );
  return (
    <section aria-label="模擬結果">
      <h2>{result.provenance.label}</h2>
      {result.purpose === 'SYNTHETIC_TEST' && (
        <p>合成測試結果，非遊戲真實DPS。</p>
      )}
      <p>
        平均DPS：<output aria-label="平均DPS">{format(result.meanDps)}</output>
      </p>
      <p>
        期望DPS：{format(result.expectedDps)} · 樣本數：{result.sampleCount} ·
        seed：{result.seed}
      </p>
      <p>抽樣標準差：{format(result.standardDeviation)}</p>
      <p>
        抽樣平均區間：
        {result.confidenceInterval?.map(format).join(' – ') ?? '不適用'}
      </p>
      <p>{result.intervalMethod}</p>
      {result.provenance.containsEstimates && (
        <ul aria-label="預估值依賴">
          {result.provenance.estimatedDependencies.map((id) => (
            <li key={id}>
              {id}：預估值（公式、參數、來源及模型版本見下方明細）
            </li>
          ))}
        </ul>
      )}
      <ul>
        {result.issues.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {result.meanDps !== null && (
        <>
          <h3>期望累積傷害</h3>
          <svg
            viewBox="0 0 600 220"
            role="img"
            aria-label="期望累積傷害曲線"
            style={{ width: '100%', height: 'auto' }}
          >
            <path d="M20 10V200H590" fill="none" stroke="currentColor" />
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              d={
                'M20 200 ' +
                shown
                  .map(
                    (p) =>
                      'H' +
                      (20 + (p.atMs / request.combat.plan.durationMs) * 570) +
                      ' V' +
                      (200 - (p.cumulativeDamage / max) * 180),
                  )
                  .join(' ') +
                ' H590'
              }
            />
          </svg>
          <p>
            橫軸：0–{request.combat.plan.durationMs}毫秒；縱軸：累積傷害0–
            {format(max)}。畫面抽樣約500點；完整時間序列可下載。
          </p>
          <h3>期望傷害占比（技能命中／DOT）</h3>
          <ul>
            {Object.entries(result.bySkill).map(([id, damage]) => (
              <li key={id}>
                {id}：{format(damage)}（
                {format(
                  result.expected.totalExpectedDamage
                    ? (damage / result.expected.totalExpectedDamage) * 100
                    : 0,
                )}
                %）
                <meter
                  min="0"
                  max={Math.max(1, result.expected.totalExpectedDamage ?? 0)}
                  value={damage}
                  aria-label={id + '傷害'}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        className="secondary-button"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob(
              [
                JSON.stringify(
                  { format: 'WWM_SIMULATION_SNAPSHOT', request, result },
                  null,
                  2,
                ),
              ],
              { type: 'application/json' },
            ),
          );
          const a = document.createElement('a');
          a.href = url;
          a.download = 'wwm-simulation.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        下載模擬快照
      </button>
      <details>
        <summary>版本、來源與預估值依賴</summary>
        <pre>
          {JSON.stringify(
            {
              algorithmVersion: result.algorithmVersion,
              context: result.expected.context,
              dependencies: result.expected.dependencies,
              provenance: result.provenance,
              warnings: result.expected.warnings,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}
