import { aggregateStats } from '@wwm/stat-engine';
import type { Build, Character, PlayerArchive } from '@wwm/game-data';
import baseline from '../../../../data/staging/external-comparison-2026-11-27/character.json';
import { SimulationPanel } from '../simulation/SimulationWorkspace';
import { mapRecordedConfiguration } from './recorded-mapping';
import { calculateSplendorReference } from './splendor-reference';
import splendorRotation from '../../../../data/staging/external-comparison-2026-11-27/splendor-rotation.json';

export function ConfigurationSummary({
  archive,
  build,
  character,
}: {
  archive: PlayerArchive;
  build: Build;
  character: Character;
}) {
  const release = archive.dataReleases.find(
    (entry) => entry.version.id === character.gameVersionId,
  );
  const mapped = mapRecordedConfiguration(build);
  const reference =
    character.pathId === 'bellstrike_splendor'
      ? calculateSplendorReference(build)
      : null;
  const unsupportedManual =
    (build.recordedPanel?.length ?? 0) > 0 ||
    (build.recordedInnerWays?.length ?? 0) > 0;
  const missing: string[] = [];
  if (!release) missing.push('缺少可用的遊戲資料版本與技能係數');
  if (!build.rotation) missing.push('尚未保存輸出循環');
  if (unsupportedManual)
    missing.push('已記錄的面板或心法尚未對照版本資料，不能省略其影響');
  if (build.panelMode === 'UNKNOWN') missing.push('尚未確認面板是否包含裝備');
  const aggregate =
    release && !unsupportedManual
      ? aggregateStats({
          build,
          character,
          equipment: archive.equipment,
          release,
          onlyExplicit: false,
          evaluatedAt: new Date().toISOString(),
        })
      : null;
  return (
    <section className="panel" aria-label="目前配置屬性與期望DPS">
      <h2>目前配置屬性與期望 DPS</h2>
      <p className="field-note">
        顯示已儲存的配置；修改後請先儲存。記錄面板可能已包含裝備及心法，不重複加總。
      </p>
      <h3>目前裝備</h3>
      {build.equipmentIds.length ? (
        <ul>
          {build.equipmentIds.map((id) => {
            const item = archive.equipment.find((entry) => entry.id === id);
            return (
              <li key={id}>
                {item?.name ?? id}
                {item?.slotId ? ` · ${item.slotId}` : ''}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>尚未選擇裝備。</p>
      )}
      <h3>目前心法</h3>
      {build.recordedInnerWays?.length || build.innerWays.length ? (
        <ul>
          {(build.recordedInnerWays ?? []).map((name, index) => (
            <li key={`${name}-${index}`}>{name}（手動記錄）</li>
          ))}
          {build.innerWays.map((way) => (
            <li key={way.id}>
              {way.id} · {way.level ?? '等級未知'}
            </li>
          ))}
        </ul>
      ) : (
        <p>尚未記錄心法。</p>
      )}
      <h3>人物面板</h3>
      {build.recordedPanel?.length ? (
        <dl>
          {build.recordedPanel.map((item) => (
            <div key={item.id}>
              <dt>{item.label}</dt>
              <dd>
                {item.value}
                {item.unit}（手動記錄）
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>尚未記錄人物面板。</p>
      )}
      {aggregate && aggregate.issues.length === 0 && (
        <dl>
          {Object.values(aggregate.stats).map((stat) => (
            <div key={stat.statId}>
              <dt>
                {release?.stats.find((def) => def.id === stat.statId)?.name ??
                  stat.statId}
              </dt>
              <dd>
                {stat.value ?? '未知'}
                {stat.value === null ? '' : stat.unit}
                {stat.status === 'ESTIMATED' ? '（預估值）' : ''}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {aggregate && aggregate.issues.length > 0 && (
        <p>屬性合成尚未完成：{aggregate.issues.join('；')}</p>
      )}
      <details>
        <summary>查看專案內的社群基礎面板參考</summary>
        <p>
          預估值：此表為來源模型裸面板，並非此角色目前屬性，不與記錄面板相加。
        </p>
        <dl>
          {Object.entries(baseline.communityBaseline.stats).map(
            ([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {value}
                  {baseline.communityBaseline.percentStatNames.includes(label)
                    ? '%'
                    : ''}
                  （預估值）
                </dd>
              </div>
            ),
          )}
        </dl>
        <p>來源：{baseline.sources[0].url}</p>
      </details>
      <details>
        <summary>查看面板與心法映射</summary>
        <p>
          已辨識 {Object.keys(mapped.values).length}{' '}
          項面板欄位；總值與實算值分開保存，未識別欄位保留原值。
        </p>
        <dl>
          {Object.entries(mapped.values).map(([key, entry]) => (
            <div key={key}>
              <dt>
                {entry.label} → {key}
              </dt>
              <dd>
                {entry.value}
                {entry.unit}（面板紀錄）
              </dd>
            </div>
          ))}
        </dl>
        {mapped.unmapped.length > 0 && (
          <p>未映射的欄位：{mapped.unmapped.join('、')}</p>
        )}
        {mapped.issues.length > 0 && (
          <ul>
            {mapped.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
        <ul>
          {mapped.hearts.map((heart, index) => (
            <li key={`${heart.name}-${index}`}>
              {heart.name}：{heart.reason}
              {heart.candidateStats && (
                <details>
                  <summary>查看來源參考數值（預估值）</summary>
                  <pre>{JSON.stringify(heart.candidateStats, null, 2)}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>查看鳴金·虹參考技能與循環</summary>
        <p>
          預估資料：{splendorRotation.durationSeconds} 秒、
          {splendorRotation.rotation.length} 個參考循環項目、
          {Object.keys(splendorRotation.skills).length}{' '}
          個技能資料；來源未提供完整施放時序，尚不能送入事件模擬器。
        </p>
        <a href={splendorRotation.source.url} target="_blank" rel="noreferrer">
          查看參考資料來源
        </a>
      </details>
      {reference && (
        <section aria-label="鳴金虹參考傷害試算">
          <h3>55 秒參考軸預估傷害</h3>
          {reference.dps === null ? (
            <>
              <p>無法計算</p>
              <ul>
                {reference.issues.map((issue, index) => (
                  <li key={`${issue}-${index}`}>{issue}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>
                包含預估資料：
                <output aria-label="參考軸預估 DPS">
                  {new Intl.NumberFormat('zh-TW', {
                    maximumFractionDigits: 2,
                  }).format(reference.dps)}
                </output>{' '}
                DPS
              </p>
              <p>
                預估總傷害：
                {new Intl.NumberFormat('zh-TW', {
                  maximumFractionDigits: 2,
                }).format(reference.totalDamage!)}
              </p>
            </>
          )}
          <p className="field-note">
            使用社群固定技能次數與公式（敵方防禦 498、固定傷害加成
            7.25%）；預設不啟用套裝四件效果，不重新加裝備或心法面板。僅計算鳴金及無相；更換裝備後須更新已含裝備的面板。需逐項輸入完整面板，缺少的數值不視為零；該結果未經遊戲實測校準，亦非逐事件模擬。
          </p>
        </section>
      )}
      <h3>期望 DPS</h3>
      {missing.length ? (
        <>
          <p>無法計算</p>
          <ul>
            {missing.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      ) : (
        <SimulationPanel
          key={JSON.stringify([build.id, build.updatedAt, archive])}
          archive={archive}
          buildId={build.id}
        />
      )}
    </section>
  );
}
