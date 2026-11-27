import { useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  parsePlayerBackup,
  pathCatalog,
  pathCoverage,
  valueStatusLabel,
  type Build,
  type Character,
  type GameDataRelease,
  type PlayerBackup,
} from '@wwm/game-data';
import { playerRepository } from './database';
import { ConfigurationSummary } from './ConfigurationSummary';

const messageFor = (error: unknown) => {
  if (error && typeof error === 'object' && 'issues' in error)
    return '資料格式、版本或引用不正確，未儲存任何變更。請使用此工具匯出的完整備份。';
  return error instanceof Error
    ? error.message
    : '無法存取本機資料，請確認瀏覽器允許儲存。';
};
function pathName(id: string) {
  const path = pathCatalog.paths.find((item) => item.id === id);
  return path
    ? path.translationVerified
      ? path.zhTW
      : path.zhTW + ' / ' + path.en
    : id;
}
export default function CharacterWorkspace() {
  const result = useLiveQuery(async () => {
    try {
      return { data: await playerRepository.snapshot(), error: '' };
    } catch (error) {
      return { data: null, error: messageFor(error) };
    }
  }, []);
  const [selectedId, setSelectedId] = useState('');
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(
    null,
  );
  const [selectedBuildId, setSelectedBuildId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PlayerBackup | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const data = result?.data;
  const selected =
    data?.characters.find((item) => item.id === selectedId) ??
    data?.characters[0] ??
    null;
  const builds =
    data?.builds.filter((item) => item.characterId === selected?.id) ?? [];
  const selectedBuild =
    builds.find((item) => item.id === selectedBuildId) ?? builds[0] ?? null;
  const snapshots =
    useLiveQuery(
      () =>
        selected
          ? playerRepository.listLoadoutSnapshots(selected.id)
          : Promise.resolve([]),
      [selected?.id],
    ) ?? [];
  async function action(operation: () => Promise<void>, message: string) {
    if (busy) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      setNotice(message);
      return true;
    } catch (reason) {
      setError(messageFor(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    await action(async () => {
      const json = await playerRepository.exportJson();
      const url = URL.createObjectURL(
        new Blob([json], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'wwm-player-backup.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, '備份已產生，請確認下載檔案已保存。');
  }
  return (
    <section className="character-workspace" aria-labelledby="characters-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CHARACTER / BUILD LIBRARY</span>
          <h1 id="characters-title" className="page-title">
            角色與配置
          </h1>
        </div>
        <span className="muted">資料儲存在本瀏覽器，無需帳號</span>
      </div>
      <p className="intro">
        為同一位俠客保留不同配裝思路。資料尚未齊備時，也能先保存草稿。
      </p>
      <div className="toolbar">
        <button
          className="secondary-button"
          onClick={download}
          disabled={busy || !data}
        >
          下載 JSON 備份
        </button>
        <button
          className="secondary-button"
          onClick={() => upload.current?.click()}
          disabled={busy || !data}
        >
          選擇 JSON 備份
        </button>
        <input
          ref={upload}
          type="file"
          accept=".json,application/json"
          aria-label="匯入玩家備份"
          className="file-input"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            setPreview(null);
            setError('');
            if (!file) return;
            try {
              setPreview(parsePlayerBackup(await file.text()));
            } catch (reason) {
              setError(messageFor(reason));
              return false;
            }
          }}
        />
      </div>
      <div role="status" aria-live="polite">
        {notice}
      </div>
      {(error || result?.error) && (
        <p role="alert" className="error-message">
          {error || result?.error}
        </p>
      )}
      {!result && <p>讀取本機資料中…</p>}
      {preview && (
        <aside className="import-preview">
          <h2>備份預覽</h2>
          <p>
            {preview.archive.characters.length} 位角色、
            {preview.archive.builds.length} 個配置、
            {preview.archive.equipment.length} 件裝備、
            {preview.archive.overrides.length} 筆覆寫、
            {preview.snapshots.length} 個機體快照。
          </p>
          <p>將合併至本機。相同 ID 若內容不同會拒絕整批，不覆蓋現有資料。</p>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() =>
              action(async () => {
                await playerRepository.importJson(preview);
                setPreview(null);
              }, '備份已匯入。')
            }
          >
            匯入已檢查備份
          </button>{' '}
          <button
            className="secondary-button"
            onClick={() => setPreview(null)}
            disabled={busy}
          >
            取消匯入
          </button>
        </aside>
      )}
      {data && (
        <div className="character-grid">
          <aside className="panel character-list">
            <h2>我的角色</h2>
            {data.characters.length === 0 && (
              <p className="muted">還沒有角色，從右側建立第一位俠客。</p>
            )}
            <ul>
              {data.characters.map((character) => (
                <li key={character.id}>
                  <button
                    aria-pressed={selected?.id === character.id}
                    className="character-item"
                    onClick={() => {
                      setSelectedId(character.id);
                      setEditingCharacter(null);
                      setSelectedBuildId('');
                    }}
                  >
                    <strong>{character.name}</strong>
                    <span>{pathName(character.pathId)}</span>
                    <small>
                      {character.level === null
                        ? '等級未知'
                        : '等級 ' + character.level}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="toolbar">
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setEditingCharacter(selected)}
                >
                  編輯角色
                </button>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        '刪除「' +
                          selected.name +
                          '」及其全部配置？共用裝備與備份檔案會保留。',
                      )
                    )
                      action(async () => {
                        await playerRepository.deleteCharacter(selected.id);
                        setEditingCharacter(null);
                      }, '角色與其配置已刪除。');
                  }}
                >
                  刪除角色
                </button>
              </div>
            )}
          </aside>
          <div className="panel">
            <CharacterForm
              key={editingCharacter?.id + (editingCharacter?.updatedAt ?? '')}
              character={editingCharacter}
              releases={data.dataReleases}
              busy={busy}
              onCancel={() => setEditingCharacter(null)}
              onSave={(input) =>
                action(
                  async () => {
                    if (editingCharacter)
                      await playerRepository.updateCharacter({
                        ...editingCharacter,
                        ...input,
                      });
                    else {
                      const id = await playerRepository.createCharacter(input);
                      setSelectedId(id);
                    }
                    setEditingCharacter(null);
                  },
                  editingCharacter ? '角色已儲存。' : '角色已建立。',
                )
              }
            />
          </div>
        </div>
      )}
      {selected && data && (
        <section className="build-section" aria-label="角色配置">
          <div className="section-heading">
            <div>
              <span className="eyebrow">BUILDS</span>
              <h2>{selected.name}的配置</h2>
            </div>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  const id = await playerRepository.createBuild(
                    selected.id,
                    '新配置',
                  );
                  setSelectedBuildId(id);
                }, '配置已建立。')
              }
            >
              新增配置
            </button>
          </div>
          <div className="toolbar build-tabs">
            {builds.map((build) => (
              <button
                key={build.id}
                aria-pressed={selectedBuild?.id === build.id}
                className="secondary-button"
                onClick={() => setSelectedBuildId(build.id)}
              >
                {build.name}
              </button>
            ))}
          </div>
          {selectedBuild && (
            <section aria-label="機體快照">
              <h3>機體快照</h3>
              <p className="field-note">
                保存目前已儲存的角色與配置；快照保留當時裝備、心法、面板及證據，不會隨後續編輯改變。
              </p>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    await playerRepository.createLoadoutSnapshot(
                      selected.id,
                      selectedBuild.id,
                    );
                  }, '機體快照已保存。')
                }
              >
                保存機體快照
              </button>
              {snapshots.length === 0 ? (
                <p className="muted">尚無機體快照。</p>
              ) : (
                <ul>
                  {snapshots.map((snapshot) => (
                    <li key={snapshot.id}>
                      {new Date(snapshot.capturedAt).toLocaleString()} ·{' '}
                      {snapshot.archive.builds.find(
                        (build) => build.id === snapshot.buildId,
                      )?.name ?? snapshot.buildId}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {selectedBuild && (
            <ConfigurationSummary
              archive={data}
              build={selectedBuild}
              character={selected}
            />
          )}
          {selectedBuild ? (
            <BuildEditor
              key={selectedBuild.id + selectedBuild.updatedAt}
              build={selectedBuild}
              busy={busy}
              equipment={data.equipment}
              character={selected}
              release={data.dataReleases.find(
                (item) => item.version.id === selected.gameVersionId,
              )}
              onSave={(build) =>
                action(async () => {
                  await playerRepository.updateBuild(build);
                }, '配置已儲存。')
              }
              onCopy={() =>
                action(async () => {
                  setSelectedBuildId(
                    await playerRepository.copyBuild(selectedBuild.id),
                  );
                }, '配置已複製。')
              }
              onDelete={() => {
                if (window.confirm('刪除此配置？角色與其他配置會保留。'))
                  action(async () => {
                    await playerRepository.deleteBuild(selectedBuild.id);
                    setSelectedBuildId('');
                  }, '配置已刪除。');
              }}
            />
          ) : (
            <p className="muted">尚無配置，請新增。</p>
          )}
        </section>
      )}
      <p className="field-note">
        本機資料不會自動跨裝置同步。清除網站資料可能移除紀錄，請定期下載備份。尚無可信
        DPS；匯入版本僅完成結構檢查。
      </p>
    </section>
  );
}

type CharacterInput = Pick<
  Character,
  'name' | 'pathId' | 'gameVersionId' | 'level' | 'realm'
>;
function CharacterForm({
  character,
  releases,
  busy,
  onSave,
  onCancel,
}: {
  character: Character | null;
  releases: GameDataRelease[];
  busy: boolean;
  onSave: (input: CharacterInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(character?.name ?? '');
  const [version, setVersion] = useState(character?.gameVersionId ?? '');
  const [path, setPath] = useState(
    character?.pathId ?? pathCatalog.paths[0].id,
  );
  const [level, setLevel] = useState(character?.level?.toString() ?? '');
  const [realm, setRealm] = useState(character?.realm ?? '');
  const release = releases.find((item) => item.version.id === version);
  const paths = release?.paths ?? pathCatalog.paths;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await onSave({
      name,
      gameVersionId: version || null,
      pathId: path,
      level: level ? Number(level) : null,
      realm,
    });
    if (saved && !character) {
      setName('');
      setRealm('');
    }
  }
  return (
    <form onSubmit={submit}>
      <h2>{character ? '編輯角色' : '建立角色'}</h2>
      <label htmlFor="character-name">角色名稱</label>
      <input
        id="character-name"
        required
        maxLength={100}
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={busy}
      />
      <label htmlFor="character-version">角色資料版本</label>
      <select
        id="character-version"
        value={version}
        disabled={busy || !!character}
        onChange={(event) => {
          setVersion(event.target.value);
          setLevel('');
          const next = releases.find(
            (item) => item.version.id === event.target.value,
          );
          setPath(next?.paths[0]?.id ?? pathCatalog.paths[0].id);
        }}
      >
        <option value="">未指定版本（草稿）</option>
        {releases.map((item) => (
          <option
            key={item.version.id}
            value={item.version.id}
            disabled={item.paths.length === 0}
          >
            {item.version.label} /{' '}
            {item.purpose === 'SYNTHETIC_TEST'
              ? '合成測試'
              : '匯入資料，未審核'}
          </option>
        ))}
      </select>
      <label htmlFor="character-path">角色流派</label>
      <select
        id="character-path"
        value={path}
        onChange={(event) => setPath(event.target.value)}
        disabled={busy || !!character}
      >
        {paths.map((item) => (
          <option key={item.id} value={item.id}>
            {item.zhTW}
            {!item.translationVerified ? ' / ' + item.en + '（待核）' : ''}
          </option>
        ))}
      </select>
      {release && (
        <p className="field-note">
          此流派資料：
          {pathCoverage(release, path).status === 'UNKNOWN'
            ? '部分資料未知'
            : '已提供基本技能規則'}
          。{pathCoverage(release, path).missing.join('；')}
        </p>
      )}
      <label htmlFor="character-level">角色可用等級</label>
      <select
        id="character-level"
        value={level}
        onChange={(event) => setLevel(event.target.value)}
        disabled={busy || !release?.version.availableLevels.length}
      >
        <option value="">未知</option>
        {release?.version.availableLevels.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <label htmlFor="character-realm">
        境界／突破備註（手動輸入，未校驗）
      </label>
      <input
        id="character-realm"
        maxLength={100}
        value={realm}
        onChange={(event) => setRealm(event.target.value)}
        disabled={busy}
      />
      <p className="field-note">
        {character
          ? '角色版本與流派固定；其他版本請新增角色。'
          : '候選流派可先建草稿；無版本等級資料時不補造等級。'}
      </p>
      <div className="toolbar">
        <button
          className="secondary-button"
          disabled={busy || !name.trim()}
          type="submit"
        >
          {character ? '儲存角色' : '建立角色'}
        </button>
        {character && (
          <button
            className="secondary-button"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            取消編輯
          </button>
        )}
      </div>
    </form>
  );
}

function BuildEditor({
  build,
  busy,
  onSave,
  onCopy,
  onDelete,
  character,
  release,
  equipment,
}: {
  build: Build;
  busy: boolean;
  character: Character;
  release?: GameDataRelease;
  equipment: import('@wwm/game-data').EquipmentInstance[];
  onSave: (build: Build) => Promise<boolean>;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(build.name);
  const [mode, setMode] = useState(build.panelMode);
  const [notes, setNotes] = useState(build.notes);
  const [stats, setStats] = useState(build.stats);
  const [martialArts, setMartialArts] = useState(build.martialArts);
  const [equipmentIds, setEquipmentIds] = useState(build.equipmentIds);
  const [recordedPanel, setRecordedPanel] = useState(build.recordedPanel ?? []);
  const [recordedInnerWays, setRecordedInnerWays] = useState(
    (build.recordedInnerWays ?? []).join('\n'),
  );
  const [panelLabel, setPanelLabel] = useState('');
  const [panelValue, setPanelValue] = useState('');
  const [panelUnit, setPanelUnit] = useState('');
  const [statId, setStatId] = useState('');
  const [statInput, setStatInput] = useState('');
  const [artId, setArtId] = useState('');
  const [artLevel, setArtLevel] = useState('');
  const [fieldError, setFieldError] = useState('');
  const path = release?.paths.find((item) => item.id === character.pathId);
  const availableArts =
    release?.martialArts.filter((item) =>
      path?.martialArtIds.includes(item.id),
    ) ?? [];
  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...build,
          name,
          panelMode: mode,
          notes,
          stats,
          martialArts,
          equipmentIds,
          recordedPanel,
          recordedInnerWays: recordedInnerWays
            .split(/\r?\n/)
            .map((value) => value.trim())
            .filter(Boolean),
        });
      }}
    >
      <label htmlFor="build-name">配置名稱</label>
      <input
        id="build-name"
        maxLength={100}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={busy}
      />
      <label htmlFor="panel-mode">面板是否已包含裝備</label>
      <select
        id="panel-mode"
        value={mode}
        onChange={(event) => setMode(event.target.value as Build['panelMode'])}
        disabled={busy}
      >
        <option value="UNKNOWN">未知，尚未確認</option>
        <option value="BASE_ONLY">純基礎面板，不含裝備</option>
        <option value="EQUIPMENT_INCLUDED">面板已含裝備</option>
      </select>
      <p className="field-note">用於後續屬性合成，避免把裝備重複加總。</p>
      <label htmlFor="build-notes">配置備註</label>
      <textarea
        id="build-notes"
        maxLength={5000}
        rows={3}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        disabled={busy}
      />
      <fieldset disabled={busy}>
        <legend>目前裝備</legend>
        {equipment.length === 0 ? (
          <p>裝備庫尚無裝備，請先新增或匯入。</p>
        ) : (
          equipment.map((item) => (
            <label className="check-label" key={item.id}>
              <input
                type="checkbox"
                checked={equipmentIds.includes(item.id)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setEquipmentIds((previous) => {
                    const remaining = previous.filter((id) => {
                      if (id === item.id) return false;
                      const selected = equipment.find(
                        (entry) => entry.id === id,
                      );
                      return (
                        !checked ||
                        !item.slotId ||
                        selected?.slotId !== item.slotId
                      );
                    });
                    return checked ? [...remaining, item.id] : remaining;
                  });
                }}
              />
              {item.name ?? '未命名裝備'}
              {item.slotId ? ` · ${item.slotId}` : ' · 部位未確認'}
            </label>
          ))
        )}
      </fieldset>
      <fieldset disabled={busy}>
        <legend>裝備心法</legend>
        <label htmlFor="recorded-inner-ways">心法名稱（每行一個）</label>
        <textarea
          id="recorded-inner-ways"
          rows={4}
          value={recordedInnerWays}
          onChange={(event) => setRecordedInnerWays(event.target.value)}
          placeholder="例如：易水歌"
        />
        <p className="field-note">
          記錄目前使用的心法；名稱與等級尚未連結傷害計算。
        </p>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>人物面板紀錄</legend>
        <label htmlFor="recorded-panel-label">面板項目名稱</label>
        <input
          id="recorded-panel-label"
          maxLength={100}
          value={panelLabel}
          onChange={(event) => setPanelLabel(event.target.value)}
          placeholder="例如：會心率（實算）"
        />
        <label htmlFor="recorded-panel-value">面板項目數值</label>
        <input
          id="recorded-panel-value"
          type="number"
          step="any"
          value={panelValue}
          onChange={(event) => setPanelValue(event.target.value)}
        />
        <label htmlFor="recorded-panel-unit">面板項目單位</label>
        <select
          id="recorded-panel-unit"
          value={panelUnit}
          onChange={(event) => setPanelUnit(event.target.value)}
        >
          <option value="">數值</option>
          <option value="%">%</option>
        </select>
        <button
          className="secondary-button"
          type="button"
          disabled={!panelLabel.trim() || !panelValue.trim()}
          onClick={() => {
            const value = Number(panelValue);
            if (!Number.isFinite(value)) {
              setFieldError('請輸入有限的面板數值。');
              return;
            }
            setRecordedPanel((previous) => [
              ...previous,
              {
                id: crypto.randomUUID(),
                label: panelLabel.trim(),
                value,
                unit: panelUnit,
              },
            ]);
            setPanelLabel('');
            setPanelValue('');
            setFieldError('');
          }}
        >
          新增面板紀錄
        </button>
        <ul>
          {recordedPanel.map((item) => (
            <li key={item.id}>
              {item.label}：{item.value}
              {item.unit}{' '}
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setRecordedPanel((previous) =>
                    previous.filter((entry) => entry.id !== item.id),
                  )
                }
              >
                移除面板 {item.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="field-note">
          這些是使用者記錄的面板資料；總數值與括號內實算值請分別記錄，尚未連結傷害計算。
        </p>
      </fieldset>
      <fieldset disabled={busy || !release}>
        <legend>面板屬性</legend>
        <label htmlFor="stat-id">面板屬性項目</label>
        <select
          id="stat-id"
          value={statId}
          onChange={(event) => setStatId(event.target.value)}
        >
          <option value="">選擇版本內屬性</option>
          {release?.stats.map((stat) => (
            <option key={stat.id} value={stat.id}>
              {stat.name}（{stat.unit}）
            </option>
          ))}
        </select>
        <label htmlFor="stat-input">面板數值（手動確認）</label>
        <input
          id="stat-input"
          type="number"
          step="any"
          value={statInput}
          onChange={(event) => setStatInput(event.target.value)}
        />
        <button
          type="button"
          className="secondary-button"
          disabled={!statId || statInput.trim() === ''}
          onClick={() => {
            if (!release || !Number.isFinite(Number(statInput))) {
              setFieldError('請輸入有限的面板數值。');
              return;
            }
            setStats((previous) => [
              ...previous.filter((stat) => stat.statId !== statId),
              {
                statId,
                value: {
                  status: 'MANUAL_CONFIRMED',
                  gameVersionId: release.version.id,
                  value: Number(statInput),
                  confirmation: {
                    origin: 'MANUAL',
                    confirmedAt: new Date().toISOString(),
                    evidenceIds: ['manual-' + crypto.randomUUID()],
                  },
                },
              },
            ]);
            setStatInput('');
            setFieldError('');
          }}
        >
          套用手動面板值
        </button>
      </fieldset>
      {!release && (
        <p className="muted">
          尚無版本屬性與武學資料，保留未知；請先匯入包含資料版本的完整備份。
        </p>
      )}
      {stats.length > 0 && (
        <ul className="stat-list">
          {stats.map((stat) => (
            <li key={stat.statId}>
              {release?.stats.find((item) => item.id === stat.statId)?.name ??
                stat.statId}
              ：{stat.value.value ?? '未知'}（{valueStatusLabel(stat.value)}）
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() =>
                  setStats((previous) =>
                    previous.filter((item) => item.statId !== stat.statId),
                  )
                }
              >
                移除 {stat.statId}
              </button>
              <details>
                <summary>查看數值依據</summary>
                <pre>{JSON.stringify(stat.value, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
      <fieldset disabled={busy || !release}>
        <legend>武學等級</legend>
        <label htmlFor="martial-art-id">配置武學</label>
        <select
          id="martial-art-id"
          value={artId}
          onChange={(event) => setArtId(event.target.value)}
        >
          <option value="">選擇此流派武學</option>
          {availableArts.map((art) => (
            <option key={art.id} value={art.id}>
              {art.name}
            </option>
          ))}
        </select>
        <label htmlFor="martial-art-level">
          武學等級（手動輸入，未校驗上限）
        </label>
        <input
          id="martial-art-level"
          type="number"
          min="1"
          step="1"
          value={artLevel}
          onChange={(event) => setArtLevel(event.target.value)}
        />
        <button
          type="button"
          className="secondary-button"
          disabled={!artId}
          onClick={() => {
            const level = artLevel.trim() === '' ? null : Number(artLevel);
            if (level !== null && (!Number.isSafeInteger(level) || level < 1)) {
              setFieldError('武學等級須為正整數或未知。');
              return;
            }
            setMartialArts((previous) => [
              ...previous.filter((art) => art.id !== artId),
              { id: artId, level },
            ]);
            setArtLevel('');
            setFieldError('');
          }}
        >
          套用武學等級
        </button>
      </fieldset>
      {martialArts.length > 0 && (
        <ul>
          {martialArts.map((art) => (
            <li key={art.id}>
              {availableArts.find((item) => item.id === art.id)?.name ?? art.id}
              ：{art.level ?? '未知'}（手動輸入）
              <button
                type="button"
                disabled={busy}
                className="text-button"
                onClick={() =>
                  setMartialArts((previous) =>
                    previous.filter((item) => item.id !== art.id),
                  )
                }
              >
                移除武學 {art.id}
              </button>
            </li>
          ))}
        </ul>
      )}
      {fieldError && (
        <p role="alert" className="error-message">
          {fieldError}
        </p>
      )}
      <dl className="build-summary">
        <dt>裝備</dt>
        <dd>{equipmentIds.length} 件</dd>
        <dt>武學／心法／奇術／天賦</dt>
        <dd>
          {[
            martialArts.length,
            recordedInnerWays.split(/\r?\n/).filter((value) => value.trim())
              .length,
            build.mysticSkillIds.length,
            build.talentIds.length,
          ].join(' / ')}
        </dd>
      </dl>
      <p className="field-note">
        裝備、心法與面板紀錄會隨配置儲存；請在裝備庫編輯裝備內容。
      </p>
      <div className="toolbar">
        <button
          className="secondary-button"
          disabled={busy || !name.trim()}
          type="submit"
        >
          儲存配置
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          type="button"
          onClick={onCopy}
        >
          複製配置
        </button>
        <button
          className="danger-button"
          disabled={busy}
          type="button"
          onClick={onDelete}
        >
          刪除配置
        </button>
      </div>
    </form>
  );
}
