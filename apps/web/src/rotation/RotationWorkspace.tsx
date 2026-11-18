import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RotationPlanSchema,
  type PlayerArchive,
  type RotationPlan,
  type RotationAction,
} from '@wwm/game-data';
import { runRotation, type CombatRequest } from '@wwm/combat-engine';
import { playerRepository } from '../player/database';
type Row = {
  key: string;
  at: string;
  kind: 'CAST' | 'SWITCH';
  target: string;
  variant: string;
  requiredBuff: string[];
  forbiddenBuff: string[];
  resource: string;
  minimum: string;
};
const row = (): Row => ({
  key: crypto.randomUUID(),
  at: '0',
  kind: 'CAST',
  target: '',
  variant: '',
  requiredBuff: [],
  forbiddenBuff: [],
  resource: '',
  minimum: '',
});
const number = (text: string) => {
  if (text.trim() === '' || !Number.isFinite(Number(text)))
    throw new Error('請輸入完整的有限數值，空白不當作0。');
  return Number(text);
};
const display = (value: number | null) =>
  value === null
    ? '無法計算'
    : new Intl.NumberFormat('zh-TW', {
        maximumSignificantDigits: 10,
        useGrouping: false,
      }).format(value);
export default function RotationWorkspace() {
  const loaded = useLiveQuery(async () => {
    try {
      return { data: await playerRepository.snapshot(), error: '' };
    } catch {
      return { data: null, error: '無法讀取本機配置。' };
    }
  }, []);
  const [buildId, setBuildId] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="character-workspace" aria-labelledby="rotation-title">
      <span className="eyebrow">ROTATION / ORDER AND STATE</span>
      <h1 id="rotation-title" className="page-title">
        循環事件驗證
      </h1>
      <p className="intro">
        依所選版本的施放、冷卻與效果規則驗證循環。時間使用整數毫秒；視窗結束時的傷害不計入，Buff
        到期時立即失效。
      </p>
      <div role="status">{notice}</div>
      {loaded?.error && <p role="alert">{loaded.error}</p>}
      <label htmlFor="rotation-build">循環配置</label>
      <select
        id="rotation-build"
        disabled={busy}
        value={buildId}
        onChange={(e) => {
          setBuildId(e.target.value);
          setNotice('');
        }}
      >
        <option value="">選擇配置</option>
        {loaded?.data?.builds.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {loaded?.data &&
        buildId &&
        loaded.data.builds.some((b) => b.id === buildId) && (
          <RotationEditor
            key={JSON.stringify([buildId, loaded.data])}
            archive={loaded.data}
            buildId={buildId}
            busy={busy}
            onSave={async (plan) => {
              setBusy(true);
              try {
                const build = loaded.data!.builds.find(
                  (b) => b.id === buildId,
                )!;
                await playerRepository.updateBuild({
                  ...build,
                  rotation: plan,
                });
                setNotice('循環已保存；保存不代表已通過驗證。');
              } catch (reason) {
                setNotice(
                  reason instanceof Error ? reason.message : '保存失敗',
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
    </section>
  );
}
export function RotationEditor({
  archive,
  buildId,
  busy,
  onSave,
}: {
  archive: PlayerArchive;
  buildId: string;
  busy: boolean;
  onSave: (plan: RotationPlan) => Promise<void>;
}) {
  const build = archive.builds.find((b) => b.id === buildId)!,
    character = archive.characters.find((c) => c.id === build.characterId)!;
  const release = archive.dataReleases.find(
      (r) => r.version.id === character.gameVersionId,
    ),
    saved = build.rotation;
  const path = release?.paths.find((p) => p.id === character.pathId),
    skills =
      release?.skills.filter((s) =>
        path?.martialArtIds.includes(s.martialArtId),
      ) ?? [];
  const [name, setName] = useState(saved?.name ?? '循環草稿'),
    [mode, setMode] = useState<'FIXED' | 'PRIORITY'>(saved?.mode ?? 'FIXED');
  const [duration, setDuration] = useState(String(saved?.durationMs ?? 60000)),
    [interval, setInterval] = useState(
      String(saved?.decisionIntervalMs ?? 100),
    );
  const [initialArt, setInitialArt] = useState(
      saved?.initialMartialArtId ?? '',
    ),
    [onlyExplicit, setOnlyExplicit] = useState(saved?.onlyExplicit ?? false);
  const [rows, setRows] = useState<Row[]>(() =>
    saved
      ? (saved.mode === 'FIXED'
          ? saved.actions.map((a) => ({
              action: a.action,
              at: a.atMs,
              rule: undefined,
            }))
          : saved.priorityRules.map((rule) => ({
              action: rule.action,
              at: 0,
              rule,
            }))
        ).map(({ action, at, rule }) => ({
          ...row(),
          at: String(at),
          kind: action.kind,
          target: action.kind === 'CAST' ? action.skillId : action.martialArtId,
          variant: action.kind === 'CAST' ? (action.variantId ?? '') : '',
          requiredBuff: rule?.requiredBuffIds ?? [],
          forbiddenBuff: rule?.forbiddenBuffIds ?? [],
          resource: rule?.resourceId ?? '',
          minimum:
            rule?.minimum === null || rule?.minimum === undefined
              ? ''
              : String(rule.minimum),
        }))
      : [],
  );
  const [error, setError] = useState(''),
    [result, setResult] = useState<ReturnType<typeof runRotation>>();
  const [lastRequest, setLastRequest] = useState<CombatRequest>();
  function change(operation: () => void) {
    operation();
    setResult(undefined);
    setError('');
  }
  const update = (key: string, patch: Partial<Row>) =>
    change(() =>
      setRows((old) =>
        old.map((r) => (r.key === key ? { ...r, ...patch } : r)),
      ),
    );
  function plan(): RotationPlan {
    const action = (r: Row): RotationAction =>
      r.kind === 'CAST'
        ? { kind: 'CAST', skillId: r.target, variantId: r.variant || null }
        : { kind: 'SWITCH', martialArtId: r.target };
    const parsed = RotationPlanSchema.safeParse({
      id: saved?.id ?? crypto.randomUUID(),
      name,
      gameVersionId: character.gameVersionId,
      durationMs: number(duration),
      mode,
      initialMartialArtId: initialArt,
      onlyExplicit,
      decisionIntervalMs: mode === 'PRIORITY' ? number(interval) : null,
      actions:
        mode === 'FIXED'
          ? rows.map((r) => ({ atMs: number(r.at), action: action(r) }))
          : [],
      priorityRules:
        mode === 'PRIORITY'
          ? rows.map((r) => ({
              action: action(r),
              requiredBuffIds: r.requiredBuff,
              forbiddenBuffIds: r.forbiddenBuff,
              resourceId: r.resource || null,
              minimum: r.resource ? number(r.minimum) : null,
            }))
          : [],
    });
    if (!parsed.success)
      throw new Error(
        '請核對版本、時間、初始武學、技能/變體與優先序條件；毫秒需為非負整數，動作須在時間窗內。',
      );
    return parsed.data;
  }
  const arts = build.martialArts.filter((a) =>
    path?.martialArtIds.includes(a.id),
  );
  return (
    <div className="panel rotation-editor">
      <p>
        {release?.purpose === 'SYNTHETIC_TEST'
          ? '合成測試資料，非遊戲真實循環。'
          : '規則缺失時只保留草稿，不使用替代係數。'}
      </p>
      {!release?.combat && <p>此版本缺少戰鬥規則，無法驗證循環。</p>}
      <fieldset disabled={busy}>
        <label htmlFor="rotation-name">循環名稱</label>
        <input
          id="rotation-name"
          value={name}
          onChange={(e) => change(() => setName(e.target.value))}
        />
        <label htmlFor="rotation-mode">循環模式</label>
        <select
          id="rotation-mode"
          value={mode}
          onChange={(e) => change(() => setMode(e.target.value as typeof mode))}
        >
          <option value="FIXED">固定時間動作</option>
          <option value="PRIORITY">由上至下優先序</option>
        </select>
        <label htmlFor="rotation-duration">時間窗（毫秒）</label>
        <input
          id="rotation-duration"
          type="number"
          min="1"
          step="1"
          value={duration}
          onChange={(e) => change(() => setDuration(e.target.value))}
        />
        {mode === 'PRIORITY' && (
          <>
            <label htmlFor="rotation-interval">決策間隔（毫秒）</label>
            <input
              id="rotation-interval"
              type="number"
              min="1"
              step="1"
              value={interval}
              onChange={(e) => change(() => setInterval(e.target.value))}
            />
          </>
        )}
        <label htmlFor="rotation-art">初始武學</label>
        <select
          id="rotation-art"
          value={initialArt}
          onChange={(e) => change(() => setInitialArt(e.target.value))}
        >
          <option value="">明確選擇武學</option>
          {arts.map((a) => (
            <option key={a.id} value={a.id}>
              {release?.martialArts.find((d) => d.id === a.id)?.name ?? a.id}
            </option>
          ))}
        </select>
        <label className="check-label">
          <input
            type="checkbox"
            checked={onlyExplicit}
            onChange={(e) => change(() => setOnlyExplicit(e.target.checked))}
          />
          僅使用明確資料（循環驗證）
        </label>
        {rows.map((r, i) => (
          <div key={r.key} className="manual-row">
            <h3>動作 {i + 1}</h3>
            {mode === 'FIXED' && (
              <>
                <label htmlFor={r.key + '-time'}>
                  動作時間 {i + 1}（毫秒）
                </label>
                <input
                  id={r.key + '-time'}
                  type="number"
                  min="0"
                  step="1"
                  value={r.at}
                  onChange={(e) => update(r.key, { at: e.target.value })}
                />
              </>
            )}
            <label htmlFor={r.key + '-kind'}>動作種類 {i + 1}</label>
            <select
              id={r.key + '-kind'}
              value={r.kind}
              onChange={(e) =>
                update(r.key, {
                  kind: e.target.value as Row['kind'],
                  target: '',
                  variant: '',
                })
              }
            >
              <option value="CAST">施放技能</option>
              <option value="SWITCH">切換武學</option>
            </select>
            <label htmlFor={r.key + '-target'}>動作目標 {i + 1}</label>
            <select
              id={r.key + '-target'}
              value={r.target}
              onChange={(e) =>
                update(r.key, { target: e.target.value, variant: '' })
              }
            >
              <option value="">選擇版本項目</option>
              {r.kind === 'CAST'
                ? skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                : arts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {release?.martialArts.find((d) => d.id === a.id)?.name ??
                        a.id}
                    </option>
                  ))}
            </select>
            {r.kind === 'CAST' &&
              !!skills.find((s) => s.id === r.target)?.variants?.length && (
                <>
                  <label htmlFor={r.key + '-variant'}>動作變體 {i + 1}</label>
                  <select
                    id={r.key + '-variant'}
                    value={r.variant}
                    onChange={(e) => update(r.key, { variant: e.target.value })}
                  >
                    <option value="">明確選擇變體</option>
                    {skills
                      .find((s) => s.id === r.target)
                      ?.variants?.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                </>
              )}
            {mode === 'PRIORITY' && (
              <>
                {(['requiredBuff', 'forbiddenBuff'] as const).map((key) => (
                  <div key={key}>
                    <label htmlFor={r.key + key}>
                      {key === 'requiredBuff' ? '需要狀態' : '排除狀態'} {i + 1}
                    </label>
                    <select
                      multiple
                      id={r.key + key}
                      value={r[key]}
                      onChange={(e) =>
                        update(r.key, {
                          [key]: Array.from(
                            e.target.selectedOptions,
                            (o) => o.value,
                          ).filter(Boolean),
                        })
                      }
                    >
                      <option value="">無此條件</option>
                      {release?.combat?.buffs.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <label htmlFor={r.key + '-resource'}>資源條件 {i + 1}</label>
                <select
                  id={r.key + '-resource'}
                  value={r.resource}
                  onChange={(e) =>
                    update(r.key, { resource: e.target.value, minimum: '' })
                  }
                >
                  <option value="">無資源門檻</option>
                  {release?.combat?.resources.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                    </option>
                  ))}
                </select>
                {r.resource && (
                  <>
                    <label htmlFor={r.key + '-minimum'}>最低資源 {i + 1}</label>
                    <input
                      id={r.key + '-minimum'}
                      type="number"
                      min="0"
                      step="any"
                      value={r.minimum}
                      onChange={(e) =>
                        update(r.key, { minimum: e.target.value })
                      }
                    />
                  </>
                )}
              </>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                change(() =>
                  setRows((old) => old.filter((v) => v.key !== r.key)),
                )
              }
            >
              移除動作 {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary-button"
          onClick={() => change(() => setRows((old) => [...old, row()]))}
        >
          新增循環動作
        </button>
        <p className="field-note">
          同毫秒依加入事件的先後順序；動作表由上至下。Buff／DOT在到期毫秒先失效，區間為起點含、終點不含。優先序依決策間隔檢查，最多驗證10000筆事件。
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="toolbar">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              try {
                const current = plan();
                const request: CombatRequest = {
                  build,
                  character,
                  release,
                  equipment: archive.equipment,
                  plan: current,
                  onlyExplicit,
                  evaluatedAt: new Date().toISOString(),
                };
                setLastRequest(request);
                setResult(runRotation(request));
                setError('');
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : '驗證失敗');
              }
            }}
          >
            驗證循環事件
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={async () => {
              try {
                await onSave(plan());
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : '保存失敗');
              }
            }}
          >
            保存循環
          </button>
        </div>
      </fieldset>
      {result && (
        <section aria-label="循環驗證結果">
          <h2>
            {result.status === 'VALID' ? '事件驗證通過' : '無法完成事件驗證'} ·{' '}
            {result.provenance.label}
          </h2>
          <p>
            期望總傷害：
            <span aria-label="循環總傷害">
              {display(result.totalExpectedDamage)}
            </span>
          </p>
          <p>{result.note}</p>
          <ul>
            {result.issues.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <details open>
            <summary>事件明細</summary>
            <ol className="rotation-trace">
              {result.trace.slice(0, 200).map((event) => (
                <li key={event.sequence}>
                  {event.atMs}ms · {event.kind} · {event.detail}
                  {event.damage !== null
                    ? ' · 傷害 ' + display(event.damage)
                    : ''}
                </li>
              ))}
            </ol>
          </details>
          {result.trace.length > 200 && (
            <p>畫面顯示前200筆事件，完整事件保留於下載紀錄。</p>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const file = new Blob(
                [
                  JSON.stringify(
                    {
                      format: 'WWM_ROTATION_TRACE',
                      request: lastRequest,
                      result,
                    },
                    null,
                    2,
                  ),
                ],
                { type: 'application/json' },
              );
              const url = URL.createObjectURL(file),
                anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = 'wwm-rotation-trace.json';
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            下載完整循環紀錄
          </button>
          <details>
            <summary>來源與最終狀態</summary>
            <pre>
              {JSON.stringify(
                {
                  dependencies: result.dependencies,
                  provenance: result.provenance,
                  state: result.finalState,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </section>
      )}
    </div>
  );
}
