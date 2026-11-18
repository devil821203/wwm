import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type PlayerArchive, type Measurement } from '@wwm/game-data';
import { bellstrikeCoverage, compareMeasurement } from '@wwm/stat-engine';
import { playerRepository } from '../player/database';
import { createMeasurement, type MeasurementFields } from './input-model';
const format = (v: number | null) =>
  v === null
    ? '無法比較'
    : v !== 0 && Math.abs(v) < 0.000001
      ? v.toExponential(5)
      : new Intl.NumberFormat('zh-TW', {
          maximumSignificantDigits: 10,
          useGrouping: false,
        }).format(v);
export default function MeasurementWorkspace() {
  const loaded = useLiveQuery(async () => {
    try {
      return { data: await playerRepository.snapshot(), error: '' };
    } catch {
      return { data: null, error: '無法讀取本機實測紀錄。' };
    }
  }, []);
  const [buildId, setBuildId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const archive = loaded?.data;
  const eligible =
    archive?.builds.filter((b) =>
      archive.characters.some(
        (c) => c.id === b.characterId && c.pathId === 'bellstrike_splendor',
      ),
    ) ?? [];
  const build = eligible.find((b) => b.id === buildId);
  const character = archive?.characters.find(
    (c) => c.id === build?.characterId,
  );
  const release = archive?.dataReleases.find(
    (r) => r.version.id === character?.gameVersionId,
  );
  const coverage = bellstrikeCoverage(release);
  const selected = archive?.measurements?.find((m) => m.id === selectedId);
  async function save(measurement: Measurement) {
    setBusy(true);
    setError('');
    try {
      await playerRepository.saveMeasurement(measurement);
      setSelectedId(measurement.id);
      setNotice('實測快照已保存，未變更任何技能係數。');
    } catch {
      setError('無法保存實測快照，未變更既有紀錄。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="character-workspace"
      aria-labelledby="measurement-title"
    >
      <span className="eyebrow">MEASUREMENT / OBSERVE BEFORE CALIBRATING</span>
      <h1 id="measurement-title" className="page-title">
        鳴金·虹實測
      </h1>
      <p className="intro">
        需求預設武學：無名劍法＋無名槍法。固定角色面板、敵人與施放條件後記錄觀察；技能
        ID 與數值以所選版本為準。
      </p>
      <p className="field-note">
        目前未附真實遊戲係數或三組遊戲實測。紀錄僅為觀察，不自動校準公式；截圖參照不會自動保存圖片。
      </p>
      <div role="status">{notice}</div>
      {(error || loaded?.error) && <p role="alert">{error || loaded?.error}</p>}
      <label htmlFor="measurement-build">實測配置</label>
      <select
        id="measurement-build"
        value={buildId}
        onChange={(e) => setBuildId(e.target.value)}
        disabled={busy}
      >
        <option value="">選擇鳴金·虹配置</option>
        {eligible.map((b) => (
          <option key={b.id} value={b.id}>
            {archive?.characters.find((c) => c.id === b.characterId)?.name} /{' '}
            {b.name}
          </option>
        ))}
      </select>
      <details>
        <summary>版本技能與缺失資料</summary>
        {coverage.missing.map((reason) => (
          <p key={reason}>{reason}</p>
        ))}
        {coverage.skills.map((skill) => (
          <div key={skill.id}>
            <h3>{skill.name}</h3>
            {skill.variants.map((v) => (
              <p key={v.id}>
                {v.name}：
                {v.missing.length
                  ? v.missing.join('、')
                  : '已宣告係數與時間欄位；不代表實測校準'}
              </p>
            ))}
          </div>
        ))}
      </details>
      {!eligible.length && (
        <p>
          尚無鳴金·虹配置，請先建立角色或匯入版本化備份；不提供虛構技能選項。
        </p>
      )}
      {archive && build && (
        <MeasurementForm
          key={JSON.stringify([buildId, archive])}
          archive={archive}
          buildId={buildId}
          busy={busy}
          onSave={save}
        />
      )}
      <div className="panel measurement-records">
        <h2>實測紀錄（{archive?.measurements?.length ?? 0}）</h2>
        {(archive?.measurements ?? []).map((m) => (
          <button
            className="secondary-button"
            key={m.id}
            disabled={busy}
            onClick={() => setSelectedId(m.id)}
          >
            {m.label} ·{' '}
            {m.purpose === 'SYNTHETIC_TEST' ? '合成測試' : '遊戲觀察'}
          </button>
        ))}
        {selected && (
          <>
            <MeasurementReport measurement={selected} />
            <button
              className="danger-button"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('刪除此實測快照？其他角色及技能資料不變。'))
                  return;
                setBusy(true);
                try {
                  await playerRepository.deleteMeasurement(selected.id);
                  setSelectedId('');
                  setNotice('實測紀錄已刪除。');
                } catch {
                  setError('刪除失敗，請重新載入紀錄。');
                } finally {
                  setBusy(false);
                }
              }}
            >
              刪除此實測紀錄
            </button>
          </>
        )}
        <p className="field-note">
          快照不可覆寫；修正時另存新紀錄。刪除角色不刪除歷史快照，玩家 JSON
          備份包含實測紀錄。
        </p>
      </div>
    </section>
  );
}
export function MeasurementForm({
  archive,
  buildId,
  busy,
  onSave,
}: {
  archive: PlayerArchive;
  buildId: string;
  busy: boolean;
  onSave: (m: Measurement) => Promise<void>;
}) {
  const [fields, setFields] = useState<MeasurementFields>({
    label: '',
    kind: 'SINGLE_SKILL',
    skillId: '',
    variantId: '',
    enemyName: '',
    enemyLevel: '',
    enemyConditions: '',
    conditions: '',
    sampling: 'UNFILTERED_CAST_TOTAL',
    samplesText: '',
    source: '',
    evidenceKind: 'TEXT',
    comparisonContextConfirmed: false,
    confirmed: false,
  });
  const [error, setError] = useState('');
  const build = archive.builds.find((b) => b.id === buildId)!;
  const character = archive.characters.find((c) => c.id === build.characterId)!;
  const release = archive.dataReleases.find(
    (r) => r.version.id === character.gameVersionId,
  );
  const path = release?.paths.find((p) => p.id === character.pathId);
  const skills =
    release?.skills.filter((s) =>
      path?.martialArtIds.includes(s.martialArtId),
    ) ?? [];
  const variants = skills.find((s) => s.id === fields.skillId)?.variants ?? [];
  function update<K extends keyof MeasurementFields>(
    key: K,
    value: MeasurementFields[K],
  ) {
    setFields((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await onSave(createMeasurement(archive, buildId, fields));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '請核對輸入');
    }
  }
  return (
    <form className="panel measurement-form" onSubmit={submit}>
      <h2>新增固定條件觀察</h2>
      <p>
        {release?.purpose === 'SYNTHETIC_TEST'
          ? '合成測試資料，非真實遊戲實測。'
          : '遊戲觀察資料；需自行核對版本及來源。'}
      </p>
      <fieldset disabled={busy}>
        <label htmlFor="measurement-label">紀錄名稱</label>
        <input
          id="measurement-label"
          value={fields.label}
          required
          maxLength={100}
          onChange={(e) => update('label', e.target.value)}
        />
        <label htmlFor="measurement-kind">觀察種類</label>
        <select
          id="measurement-kind"
          value={fields.kind}
          onChange={(e) =>
            update('kind', e.target.value as MeasurementFields['kind'])
          }
        >
          <option value="SINGLE_SKILL">單技能多次施放</option>
          <option value="ROTATION_60S">60秒循環總傷害觀察</option>
        </select>
        {fields.kind === 'SINGLE_SKILL' && (
          <>
            <label htmlFor="measurement-skill">實測技能</label>
            <select
              id="measurement-skill"
              required
              value={fields.skillId}
              onChange={(e) => {
                update('skillId', e.target.value);
                update('variantId', '');
              }}
            >
              <option value="">選擇版本技能</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {variants.length > 0 && (
              <>
                <label htmlFor="measurement-variant">實測變體</label>
                <select
                  id="measurement-variant"
                  required
                  value={fields.variantId}
                  onChange={(e) => update('variantId', e.target.value)}
                >
                  <option value="">明確選擇變體</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="measurement-sampling">樣本範圍</label>
            <select
              id="measurement-sampling"
              value={fields.sampling}
              onChange={(e) =>
                update(
                  'sampling',
                  e.target.value as MeasurementFields['sampling'],
                )
              }
            >
              <option value="UNFILTERED_CAST_TOTAL">
                未篩選，每次完整施放總傷害
              </option>
              <option value="FILTERED_OR_PARTIAL">
                篩選命中結果或只有部分傷害（不比較期望值）
              </option>
            </select>
          </>
        )}
        <label htmlFor="measurement-enemy">固定敵人</label>
        <input
          id="measurement-enemy"
          required
          value={fields.enemyName}
          onChange={(e) => update('enemyName', e.target.value)}
        />
        <label htmlFor="measurement-enemy-level">敵人等級（未知留白）</label>
        <input
          id="measurement-enemy-level"
          type="number"
          min="1"
          step="1"
          value={fields.enemyLevel}
          onChange={(e) => update('enemyLevel', e.target.value)}
        />
        <label htmlFor="measurement-enemy-conditions">
          敵人防禦、抗性與狀態說明
        </label>
        <textarea
          id="measurement-enemy-conditions"
          required
          value={fields.enemyConditions}
          onChange={(e) => update('enemyConditions', e.target.value)}
        />
        <label htmlFor="measurement-conditions">固定狀態／施放流程</label>
        <textarea
          id="measurement-conditions"
          required
          value={fields.conditions}
          onChange={(e) => update('conditions', e.target.value)}
        />
        <label htmlFor="measurement-samples">
          傷害樣本（每行一筆，0可保留）
        </label>
        <textarea
          id="measurement-samples"
          required
          value={fields.samplesText}
          onChange={(e) => update('samplesText', e.target.value)}
        />
        <p className="field-note">
          {fields.kind === 'SINGLE_SKILL'
            ? '每筆為一次完整施放的總傷害，不是單段或挑選會心傷害。'
            : '每筆必須是完整60000毫秒的總傷害；循環模型尚未提供，僅保存觀察。'}
        </p>
        <label htmlFor="measurement-evidence-kind">來源種類</label>
        <select
          id="measurement-evidence-kind"
          value={fields.evidenceKind}
          onChange={(e) =>
            update(
              'evidenceKind',
              e.target.value as MeasurementFields['evidenceKind'],
            )
          }
        >
          <option value="TEXT">文字記錄</option>
          <option value="SCREENSHOT_REFERENCE">截圖參照</option>
        </select>
        <label htmlFor="measurement-source">
          文字來源或截圖參照（不自動保存圖片）
        </label>
        <textarea
          id="measurement-source"
          required
          value={fields.source}
          onChange={(e) => update('source', e.target.value)}
        />
        <label className="check-label">
          <input
            type="checkbox"
            checked={fields.comparisonContextConfirmed}
            onChange={(e) =>
              update('comparisonContextConfirmed', e.target.checked)
            }
          />
          已確認敵人與狀態符合快照公式假設
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            required
            checked={fields.confirmed}
            onChange={(e) => update('confirmed', e.target.checked)}
          />
          已逐筆核對版本、面板、條件與傷害樣本
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="secondary-button">
          保存實測快照
        </button>
      </fieldset>
    </form>
  );
}
export function MeasurementReport({
  measurement,
}: {
  measurement: Measurement;
}) {
  const report = compareMeasurement(measurement);
  return (
    <section aria-label="實測比較結果">
      <h3>{measurement.label}</h3>
      <p>
        {report.label} ·{' '}
        {measurement.purpose === 'SYNTHETIC_TEST' ? '合成測試' : '遊戲觀察'}
      </p>
      <p>
        樣本數：{report.sampleCount}；觀察平均：{format(report.observedMean)}
      </p>
      <p>模型單技能期望值：{format(report.expectedDamage)}</p>
      <p>
        MAE：{format(report.mae)}；MAPE：{format(report.mapePercent)}
        {report.mapePercent === null ? '' : '%'}
        ；零值排除：{report.zeroExcluded}
      </p>
      <p>{report.note}</p>
      {report.prediction?.provenance.containsEstimates && <p>包含預估資料</p>}
      <ul>
        {report.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
      <details>
        <summary>固定快照與來源</summary>
        <pre>{JSON.stringify(measurement, null, 2)}</pre>
      </details>
    </section>
  );
}
