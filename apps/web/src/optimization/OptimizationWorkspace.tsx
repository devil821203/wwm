import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { PlayerArchive } from '@wwm/game-data';
import type { OptimizationRequest, OptimizationResult } from '@wwm/optimizer';
import { playerRepository } from '../player/database';
export default function OptimizationWorkspace({
  onSimulate,
}: {
  onSimulate?: (id: string) => void;
}) {
  const loaded = useLiveQuery(async () => {
    try {
      return { archive: await playerRepository.snapshot(), error: '' };
    } catch {
      return { archive: null, error: '無法讀取本機最佳化資料' };
    }
  }, []);
  const [buildId, setBuildId] = useState('');
  return (
    <section className="character-workspace">
      <h1 className="page-title">裝備最佳化</h1>
      <p>
        以同版本、基礎面板與已保存循環比較庫中候選。生成裝備可先從工坊入庫，缺少必要規則不以0排名。
      </p>
      {loaded?.error && <p role="alert">{loaded.error}</p>}
      <label htmlFor="optimization-build">最佳化配置</label>
      <select
        id="optimization-build"
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
      {loaded?.archive?.builds.some((b) => b.id === buildId) && (
        <OptimizationPanel
          key={JSON.stringify([buildId, loaded.archive])}
          archive={loaded.archive}
          buildId={buildId}
          onSimulate={onSimulate}
        />
      )}
    </section>
  );
}
export function OptimizationPanel({
  archive,
  buildId,
  onSimulate,
}: {
  archive: PlayerArchive;
  buildId: string;
  onSimulate?: (id: string) => void;
}) {
  const build = archive.builds.find((b) => b.id === buildId)!,
    character = archive.characters.find((c) => c.id === build.characterId)!;
  const release = archive.dataReleases.find(
    (r) => r.version.id === character.gameVersionId,
  );
  const inventory = archive.equipment.filter(
    (e) => e.gameVersionId === character.gameVersionId,
  );
  const availableSlots = [
    ...new Set(inventory.flatMap((e) => (e.slotId ? [e.slotId] : []))),
  ].sort();
  const [slots, setSlots] = useState(availableSlots),
    [locked, setLocked] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<string[]>([]),
    [costs, setCosts] = useState<Record<string, string>>({}),
    [budget, setBudget] = useState('');
  const [minimums, setMinimums] = useState<Record<string, string>>({}),
    [sets, setSets] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<'AUTO' | 'BEAM'>('AUTO'),
    [topK, setTopK] = useState('3'),
    [width, setWidth] = useState('20'),
    [limit, setLimit] = useState('1000');
  const [onlyExplicit, setOnlyExplicit] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('');
  const [result, setResult] = useState<OptimizationResult>(),
    [request, setRequest] = useState<OptimizationRequest>();
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
  const number = (text: string) => {
    if (!text.trim() || !Number.isFinite(Number(text)))
      throw new Error('請填完整有限數值，空白不當0');
    return Number(text);
  };
  function run() {
    clear();
    if (!build.rotation) {
      setStatus('請先保存循環');
      return;
    }
    if (build.panelMode !== 'BASE_ONLY') {
      setStatus('最佳化需要基礎面板，請先在角色配置確認');
      return;
    }
    try {
      const next: OptimizationRequest = {
        combat: {
          build,
          character,
          equipment: archive.equipment,
          release,
          plan: build.rotation,
          onlyExplicit,
          evaluatedAt: new Date().toISOString(),
        },
        slots,
        locked,
        excludedIds: excluded,
        minimumStats: Object.fromEntries(
          Object.entries(minimums)
            .filter(([, v]) => v.trim())
            .map(([id, v]) => [id, number(v)]),
        ),
        requiredSets: Object.fromEntries(
          Object.entries(sets)
            .filter(([, v]) => v.trim())
            .map(([id, v]) => [id, number(v)]),
        ),
        maximumCost: budget.trim() ? number(budget) : null,
        costs: Object.fromEntries(
          Object.entries(costs)
            .filter(([, v]) => v.trim())
            .map(([id, v]) => [id, number(v)]),
        ),
        method,
        topK: number(topK),
        beamWidth: number(width),
        maxEvaluations: number(limit),
        maxNodes: 50000,
      };
      const current = new Worker(
        new URL('./optimization.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current = current;
      setRequest(next);
      setBusy(true);
      setStatus('搜尋中');
      current.onmessage = (event) => {
        if (worker.current !== current) return;
        const message = event.data;
        if (message.type === 'PROGRESS') {
          const p = message.progress;
          setStatus(
            '搜尋中：' +
              p.phase +
              ' · 完整重算 ' +
              p.evaluated +
              ' · 已探索 ' +
              p.visited +
              '/' +
              p.total,
          );
        } else {
          if (message.type === 'RESULT') {
            setResult(message.result);
            setStatus('搜尋完成');
          } else setStatus(message.message);
          current.terminate();
          worker.current = null;
          setBusy(false);
        }
      };
      current.onerror = () => {
        if (worker.current !== current) return;
        clear();
        setStatus('Worker執行失敗，請重試');
      };
      current.postMessage(next);
    } catch (e) {
      clear();
      setStatus(e instanceof Error ? e.message : '無法啟動最佳化');
    }
  }
  return (
    <div className="panel">
      {release?.purpose === 'SYNTHETIC_TEST' && (
        <p>合成測試資料，非遊戲真實最優配裝。</p>
      )}
      <fieldset>
        <legend>搜尋部位與鎖定</legend>
        {availableSlots.map((slot) => (
          <div key={slot}>
            <label>
              <input
                type="checkbox"
                checked={slots.includes(slot)}
                onChange={(e) => {
                  clear();
                  setSlots((old) =>
                    e.target.checked
                      ? [...old, slot]
                      : old.filter((s) => s !== slot),
                  );
                  if (!e.target.checked)
                    setLocked((old) =>
                      Object.fromEntries(
                        Object.entries(old).filter(([s]) => s !== slot),
                      ),
                    );
                }}
              />
              搜尋 {slot}
            </label>
            <label htmlFor={'lock-' + slot}>鎖定 {slot}</label>
            <select
              id={'lock-' + slot}
              disabled={!slots.includes(slot)}
              value={locked[slot] ?? ''}
              onChange={(e) => {
                clear();
                setLocked((old) =>
                  e.target.value
                    ? { ...old, [slot]: e.target.value }
                    : Object.fromEntries(
                        Object.entries(old).filter(([s]) => s !== slot),
                      ),
                );
              }}
            >
              <option value="">不鎖定</option>
              {inventory
                .filter((e) => e.slotId === slot)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name ?? e.id}
                  </option>
                ))}
            </select>
          </div>
        ))}
      </fieldset>
      <p>
        每個選定部位選一件；未選部位會從候選配置移除。十件以下且組合不超5000時自動完整枚舉。
      </p>
      <label htmlFor="optimizer-budget">自訂成本上限（空白不限制）</label>
      <input
        id="optimizer-budget"
        type="number"
        min="0"
        value={budget}
        onChange={(e) => {
          clear();
          setBudget(e.target.value);
        }}
      />
      <details>
        <summary>庫存允許清單與自訂成本</summary>
        <p>成本是本次比較情境，非遊戲價格。啟用預算時，未知成本不能當0。</p>
        {inventory.map((e) => (
          <div key={e.id}>
            <label>
              <input
                type="checkbox"
                checked={!excluded.includes(e.id)}
                onChange={(event) => {
                  clear();
                  setExcluded((old) =>
                    event.target.checked
                      ? old.filter((id) => id !== e.id)
                      : [...old, e.id],
                  );
                }}
              />
              允許 {e.name ?? e.id}
            </label>
            <label htmlFor={'cost-' + e.id}>成本 {e.name ?? e.id}</label>
            <input
              id={'cost-' + e.id}
              type="number"
              min="0"
              value={costs[e.id] ?? ''}
              onChange={(event) => {
                clear();
                setCosts({ ...costs, [e.id]: event.target.value });
              }}
            />
          </div>
        ))}
      </details>
      <details>
        <summary>最低屬性與套裝件數</summary>
        {release?.stats.map((s) => (
          <div key={s.id}>
            <label htmlFor={'minimum-' + s.id}>
              最低 {s.name}（{s.unit}）
            </label>
            <input
              id={'minimum-' + s.id}
              type="number"
              step="any"
              value={minimums[s.id] ?? ''}
              onChange={(e) => {
                clear();
                setMinimums({ ...minimums, [s.id]: e.target.value });
              }}
            />
          </div>
        ))}
        {!release?.equipmentSets?.length && (
          <p>此版本尚無套裝效果資料，不提供虛構套裝選項。</p>
        )}
        {release?.equipmentSets?.map((set) => (
          <div key={set.id}>
            <label htmlFor={'set-' + set.id}>至少 {set.name} 件數</label>
            <input
              id={'set-' + set.id}
              type="number"
              min="1"
              step="1"
              value={sets[set.id] ?? ''}
              onChange={(e) => {
                clear();
                setSets({ ...sets, [set.id]: e.target.value });
              }}
            />
          </div>
        ))}
      </details>
      <label htmlFor="optimizer-method">搜尋方法</label>
      <select
        id="optimizer-method"
        value={method}
        onChange={(e) => {
          clear();
          setMethod(e.target.value as typeof method);
        }}
      >
        <option value="AUTO">自動（小型完整枚舉）</option>
        <option value="BEAM">Beam加局部搜尋（不保證全域最優）</option>
      </select>
      <label htmlFor="optimizer-k">Top-K</label>
      <input
        id="optimizer-k"
        type="number"
        min="1"
        max="20"
        value={topK}
        onChange={(e) => {
          clear();
          setTopK(e.target.value);
        }}
      />
      <label htmlFor="optimizer-width">Beam寬度</label>
      <input
        id="optimizer-width"
        type="number"
        min="1"
        max="100"
        value={width}
        onChange={(e) => {
          clear();
          setWidth(e.target.value);
        }}
      />
      <label htmlFor="optimizer-limit">完整重算上限</label>
      <input
        id="optimizer-limit"
        type="number"
        min="1"
        max="5000"
        value={limit}
        onChange={(e) => {
          clear();
          setLimit(e.target.value);
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
        僅使用明確資料（最佳化）
      </label>
      <div className="toolbar">
        <button className="secondary-button" disabled={busy} onClick={run}>
          開始最佳化
        </button>
        <button
          className="secondary-button"
          disabled={!busy}
          onClick={() => {
            clear();
            setStatus('已取消，未保存部分排名或修改配置');
          }}
        >
          取消最佳化
        </button>
      </div>
      <p role="status" aria-label="最佳化進度">
        {status}
      </p>
      {result && request && (
        <OptimizationOutput
          result={result}
          request={request}
          onApply={async (ids) => {
            if (busy) return;
            setBusy(true);
            try {
              const id = await playerRepository.saveOptimizedBuild(
                request,
                ids,
              );
              setStatus('已另存候選配置，原配置保留');
              onSimulate?.(id);
            } catch (e) {
              setStatus(e instanceof Error ? e.message : '另存失敗');
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}
    </div>
  );
}
const format = (n: number | null) =>
  n === null
    ? '無法計算／不適用'
    : new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 3 }).format(n);
export function OptimizationOutput({
  result,
  request,
  onApply,
  busy,
}: {
  result: OptimizationResult;
  request: OptimizationRequest;
  onApply: (ids: string[]) => Promise<void>;
  busy: boolean;
}) {
  return (
    <section aria-label="最佳化結果">
      <h2>{result.status === 'BLOCKED' ? '無可用排名' : '完整循環重算排名'}</h2>
      <p>
        {result.optimalityProven ? '已完整遍歷本次候選範圍' : '未證明全域最優'}
      </p>
      <p>{result.scope}</p>
      <p>
        方法：{result.method} · 完整組合 {result.totalCombinations} · 已探索{' '}
        {result.visited} · 完整重算 {result.evaluated} · 覆蓋率{' '}
        {format(result.coverage * 100)}%
      </p>
      <p>原配置DPS：{format(result.baselineDps)}</p>
      <ul>
        {result.issues.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {result.top.map((row, i) => (
        <article
          key={JSON.stringify(row.equipmentIds)}
          aria-label={'最佳化候選 ' + (i + 1)}
        >
          <h3>
            候選 {i + 1} · {row.simulation.provenance.label}
          </h3>
          <p>
            DPS：
            <span aria-label={'候選DPS ' + (i + 1)}>
              {format(row.meanDps)}
            </span>{' '}
            · 差值 {format(row.deltaDps)} · 收益 {format(row.gainPercent)}% ·
            自訂成本 {format(row.cost)}
          </p>
          <ul>
            {row.equipmentIds.map((id) => (
              <li key={id}>
                {request.combat.equipment.find((e) => e.id === id)?.name ?? id}{' '}
                · {id}
              </li>
            ))}
          </ul>
          {row.simulation.provenance.containsEstimates && (
            <ul aria-label="最佳化預估依賴">
              {row.simulation.provenance.estimatedDependencies.map((id) => (
                <li key={id}>{id}：預估值</li>
              ))}
            </ul>
          )}
          <details>
            <summary>來源、版本與完整循環</summary>
            <pre>{JSON.stringify(row.simulation, null, 2)}</pre>
          </details>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void onApply(row.equipmentIds)}
          >
            另存候選 {i + 1} 並前往模擬
          </button>
        </article>
      ))}
      <details>
        <summary>排除與缺失原因（最多100項）</summary>
        <ul>
          {result.rejected.map((r, i) => (
            <li key={i}>
              {r.id}：{r.reason}
            </li>
          ))}
        </ul>
      </details>
      <button
        className="secondary-button"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob(
              [
                JSON.stringify(
                  { format: 'WWM_OPTIMIZATION_SNAPSHOT', request, result },
                  null,
                  2,
                ),
              ],
              { type: 'application/json' },
            ),
          );
          const a = document.createElement('a');
          a.href = url;
          a.download = 'wwm-optimization.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        下載最佳化快照
      </button>
    </section>
  );
}
