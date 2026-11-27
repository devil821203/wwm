import { aggregateStats } from '@wwm/stat-engine';
import type { Build, Character, PlayerArchive } from '@wwm/game-data';
import baseline from '../../../../data/staging/external-comparison-2026-11-27/character.json';
import { SimulationPanel } from '../simulation/SimulationWorkspace';

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
