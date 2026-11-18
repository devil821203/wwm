import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type PlayerArchive, valueStatusLabel } from '@wwm/game-data';
import {
  calculateDamage,
  type DamageRequest,
  type DamageResult,
} from '@wwm/stat-engine';
import { playerRepository } from '../player/database';
const displayNumber = (value: number | null) =>
  value === null
    ? '無法計算'
    : new Intl.NumberFormat('zh-TW', {
        maximumSignificantDigits: 10,
        useGrouping: false,
      }).format(value);
export default function DamageWorkspace() {
  const loaded = useLiveQuery(async () => {
    try {
      return { data: await playerRepository.snapshot(), error: '' };
    } catch (reason) {
      return {
        data: null,
        error: reason instanceof Error ? reason.message : '無法讀取本機資料',
      };
    }
  }, []);
  const [buildId, setBuildId] = useState('');
  return (
    <section className="character-workspace" aria-labelledby="damage-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">DAMAGE / TRACE EVERY INPUT</span>
          <h1 id="damage-title" className="page-title">
            傷害與溯源
          </h1>
        </div>
      </div>
      <p className="intro">
        先確認面板是否已含裝備，再依選定版本與技能檢查數值來源。單技能期望傷害與戰鬥
        DPS 分開顯示。
      </p>
      {!loaded && <p>讀取配置中…</p>}
      {loaded?.error && <p role="alert">{loaded.error}</p>}
      {loaded?.data && (
        <>
          <label htmlFor="damage-build">計算配置</label>
          <select
            id="damage-build"
            value={buildId}
            onChange={(e) => setBuildId(e.target.value)}
          >
            <option value="">選擇已建立的配置</option>
            {loaded.data.builds.map((build) => (
              <option key={build.id} value={build.id}>
                {
                  loaded.data!.characters.find(
                    (c) => c.id === build.characterId,
                  )?.name
                }{' '}
                / {build.name}
              </option>
            ))}
          </select>
          {!loaded.data.builds.length && (
            <p>尚無配置，請先在「角色與配置」建立或匯入備份。</p>
          )}
          {buildId && loaded.data.builds.some((b) => b.id === buildId) && (
            <DamageCalculator
              key={JSON.stringify([buildId, loaded.data])}
              archive={loaded.data}
              buildId={buildId}
            />
          )}
        </>
      )}
    </section>
  );
}
export function DamageCalculator({
  archive,
  buildId,
}: {
  archive: PlayerArchive;
  buildId: string;
}) {
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
  const [skillId, setSkillId] = useState('');
  const [variantId, setVariantId] = useState('');
  const variants = skills.find((s) => s.id === skillId)?.variants ?? [];
  const [onlyExplicit, setOnlyExplicit] = useState(false);
  const [calculation, setCalculation] = useState<{
    request: DamageRequest;
    result: DamageResult;
  }>();
  const [error, setError] = useState('');
  const clear = () => {
    setCalculation(undefined);
    setError('');
  };
  return (
    <div className="panel damage-calculator">
      <h2>{build.name}</h2>
      <p>
        版本：{release?.version.label ?? '未知'}；等級：
        {character.level ?? '未知'}；流派：{path?.zhTW ?? character.pathId}
      </p>
      <p>
        面板來源：
        {build.panelMode === 'BASE_ONLY'
          ? '僅基礎面板，另加裝備'
          : build.panelMode === 'EQUIPMENT_INCLUDED'
            ? '已含裝備，不再次加總'
            : '未知，必須先確認'}
      </p>
      <p className="field-note">
        {release?.purpose === 'SYNTHETIC_TEST'
          ? '合成測試資料，非遊戲實際傷害。'
          : '尚無通過遊戲實測校準的正式公式；缺資料不輸出傷害數字。'}
      </p>
      <label htmlFor="damage-skill">單技能</label>
      <select
        id="damage-skill"
        value={skillId}
        onChange={(e) => {
          setSkillId(e.target.value);
          setVariantId('');
          clear();
        }}
      >
        <option value="">選擇此版本流派技能</option>
        {skills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {variants.length > 0 && (
        <>
          <label htmlFor="damage-variant">技能變體</label>
          <select
            id="damage-variant"
            value={variantId}
            onChange={(event) => {
              setVariantId(event.target.value);
              clear();
            }}
          >
            <option value="">明確選擇變體（不混用係數）</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={onlyExplicit}
          onChange={(e) => {
            setOnlyExplicit(e.target.checked);
            clear();
          }}
        />
        僅使用明確資料（傷害計算）
      </label>
      <button
        className="secondary-button"
        type="button"
        disabled={!skillId}
        onClick={() => {
          try {
            const request: DamageRequest = {
              build,
              character,
              release,
              equipment: archive.equipment,
              skillId,
              ...(variantId ? { variantId } : {}),
              onlyExplicit,
              evaluatedAt: new Date().toISOString(),
            };
            setCalculation({ request, result: calculateDamage(request) });
            setError('');
          } catch (reason) {
            setError(
              reason instanceof Error ? reason.message : '計算失敗，未變更配置',
            );
          }
        }}
      >
        計算單技能期望傷害
      </button>
      {!skills.length && <p>缺少此版本流派的技能資料，無法計算。</p>}
      {error && <p role="alert">{error}</p>}
      {calculation && (
        <div aria-label="單技能計算結果" className="damage-result">
          <h3>單技能期望傷害</h3>
          <p className="calculation-value" aria-label="期望傷害數值">
            {displayNumber(calculation.result.expectedDamage)}
          </p>
          <p>
            {calculation.result.provenance.label}
            {calculation.result.status === 'ESTIMATED' ? ' · 預估值' : ''}
          </p>
          <p className="field-note">顯示值經格式化，原始精度保留於計算紀錄。</p>
          <h3>戰鬥 DPS</h3>
          <p>尚無可信 DPS</p>
          <p className="field-note">{calculation.result.dpsReason}</p>
          <ul aria-label="阻擋原因">
            {calculation.result.provenance.blockingUnknowns.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          {calculation.result.warnings.map((warning, i) => (
            <p className="field-note" key={i}>
              {warning}
            </p>
          ))}
          <details>
            <summary>公式、版本與計算假設</summary>
            <pre>
              {JSON.stringify(
                {
                  formula: calculation.result.formula,
                  variant: calculation.result.variant,
                },
                null,
                2,
              )}
            </pre>
            <ul>
              {calculation.result.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
          <h3>屬性來源拆解</h3>
          {Object.values(calculation.result.aggregation.stats).map((stat) => (
            <div key={stat.statId} className="manual-row">
              <strong>
                {release?.stats.find((s) => s.id === stat.statId)?.name ??
                  stat.statId}
              </strong>
              <p>
                {stat.value === null ? '未知' : displayNumber(stat.value)}{' '}
                {stat.unit} · {stat.provenance.label}
                {stat.status === 'ESTIMATED' ? ' · 預估值' : ''}
              </p>
              <details>
                <summary>屬性來源明細</summary>
                <ul>
                  {stat.contributions.map((c) => (
                    <li key={c.id}>
                      {c.label}：{c.value.value ?? '未知'} ·{' '}
                      {valueStatusLabel(c.value)}
                      <pre>{JSON.stringify(c.value, null, 2)}</pre>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
          <details>
            <summary>本次傷害依賴與來源狀態</summary>
            <p>
              預估依賴：
              {calculation.result.provenance.estimatedDependencies.join('、') ||
                '無'}
            </p>
            <pre>
              {JSON.stringify(calculation.result.dependencies, null, 2)}
            </pre>
          </details>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              const file = new Blob(
                [
                  JSON.stringify(
                    {
                      format: 'WWM_DAMAGE_CALCULATION',
                      schemaVersion: '1.0.0',
                      ...calculation,
                    },
                    null,
                    2,
                  ),
                ],
                { type: 'application/json' },
              );
              const url = URL.createObjectURL(file);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = 'wwm-damage-calculation.json';
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            下載此次計算紀錄
          </button>
        </div>
      )}
    </div>
  );
}
