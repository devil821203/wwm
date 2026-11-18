import EquipmentWorkshop from './EquipmentWorkshop';
import EquipmentRulesPanel from './EquipmentRulesPanel';
import { addOcrCandidate } from './ocr/merge';
import { lazy, Suspense, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  EquipmentInstanceSchema,
  resolveEquipment,
  valueStatusLabel,
  type EquipmentInstance,
  type EquipmentImage,
  type GameDataRelease,
} from '@wwm/game-data';
import { playerRepository } from '../player/database';
import {
  applyManualRows,
  emptyEquipment,
  newRow,
  rowsFrom,
  type ManualRow,
} from './editor-model';
import { readEquipmentImage } from './image-input';

const OcrPanel = lazy(() => import('./ocr/OcrPanel'));
const failureMessage = (error: unknown) =>
  error && typeof error === 'object' && 'issues' in error
    ? '裝備資料或引用不正確，未儲存任何變更。請檢查名稱、版本及數值。'
    : error instanceof Error
      ? error.message
      : '無法存取本機裝備資料。';
export default function EquipmentWorkspace({
  onSimulate,
}: { onSimulate?: (buildId: string) => void } = {}) {
  const result = useLiveQuery(async () => {
    try {
      return { data: await playerRepository.snapshot(), error: '' };
    } catch (error) {
      return { data: null, error: failureMessage(error) };
    }
  }, []);
  const [seed, setSeed] = useState(emptyEquipment);
  const [expected, setExpected] = useState<EquipmentInstance | undefined>();
  const [seedImages, setSeedImages] = useState<EquipmentImage[]>([]);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [buildId, setBuildId] = useState('');
  const data = result?.data;
  const open = (
    item: EquipmentInstance,
    images: EquipmentImage[],
    persisted: boolean,
  ) => {
    setSeed(structuredClone(item));
    setExpected(persisted ? structuredClone(item) : undefined);
    setSeedImages(structuredClone(images));
    setRevision((value) => value + 1);
    setError('');
    setNotice('');
  };
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
      setError(failureMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const builds =
    data?.builds.filter(
      (build) =>
        seed.gameVersionId !== null &&
        data.characters.find((character) => character.id === build.characterId)
          ?.gameVersionId === seed.gameVersionId,
    ) ?? [];
  return (
    <section className="character-workspace" aria-labelledby="equipment-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">EQUIPMENT / ONE LIBRARY</span>
          <h1 id="equipment-title" className="page-title">
            裝備庫
          </h1>
        </div>
        <span className="muted">手動與截圖，共用同一份裝備</span>
      </div>
      <p className="intro">
        先輸入你看見的內容，未知欄位可以留白。原圖與數值並排校對，逐欄確認再保存。
      </p>
      <div className="toolbar">
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => open(emptyEquipment(), [], false)}
        >
          新增手動裝備
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() =>
            open(
              { ...emptyEquipment(), creationMethod: 'SCREENSHOT' },
              [],
              false,
            )
          }
        >
          新增截圖裝備
        </button>
      </div>
      <div role="status" aria-live="polite">
        {notice}
      </div>
      {(error || result?.error) && (
        <p role="alert" className="error-message">
          {error || result?.error}
        </p>
      )}
      {!result && <p>讀取裝備中…</p>}
      {data && (
        <EquipmentWorkshop
          releases={data.dataReleases}
          equipment={data.equipment}
          onOpen={(item) => open(item, [], false)}
        />
      )}
      {data && (
        <div className="equipment-layout">
          <aside className="panel">
            <h2>所有裝備（{data.equipment.length}）</h2>
            {!data.equipment.length && (
              <p className="muted">
                裝備庫尚無資料，也可以直接從右側建立草稿。
              </p>
            )}
            <ul className="inventory-list">
              {data.equipment.map((item) => (
                <li key={item.id}>
                  <button
                    className="character-item"
                    aria-pressed={expected?.id === item.id}
                    onClick={() =>
                      open(
                        item,
                        (data.equipmentImages ?? []).filter(
                          (image) => image.equipmentId === item.id,
                        ),
                        true,
                      )
                    }
                  >
                    <strong>{item.name ?? '未命名裝備'}</strong>
                    <span>
                      {item.creationMethod === 'SCREENSHOT'
                        ? '截圖'
                        : item.creationMethod === 'GENERATED'
                          ? '生成'
                          : '手動'}{' '}
                      · {item.gameVersionId ?? '版本未知'} ·{' '}
                      {item.validation.status === 'VALID'
                        ? '已通過儲存時規則驗證'
                        : '尚未驗證'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {expected && (
              <>
                <div className="toolbar">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        const id = await playerRepository.copyEquipment(
                          expected.id,
                        );
                        const current = await playerRepository.snapshot();
                        open(
                          current.equipment.find((item) => item.id === id)!,
                          (current.equipmentImages ?? []).filter(
                            (image) => image.equipmentId === id,
                          ),
                          true,
                        );
                      }, '裝備已複製。')
                    }
                  >
                    複製裝備
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          '刪除此裝備、相關原圖與編輯歷史，並從所有配置解除引用？',
                        )
                      )
                        action(async () => {
                          await playerRepository.deleteEquipment(expected.id);
                          open(emptyEquipment(), [], false);
                        }, '裝備已刪除，配置引用已解除。');
                    }}
                  >
                    刪除裝備
                  </button>
                </div>
                <label htmlFor="equipment-build">
                  加入同版本配置（待驗證）
                </label>
                <select
                  id="equipment-build"
                  value={buildId}
                  onChange={(event) => setBuildId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">選擇配置</option>
                  {builds.map((build) => (
                    <option key={build.id} value={build.id}>
                      {
                        data.characters.find(
                          (character) => character.id === build.characterId,
                        )?.name
                      }{' '}
                      / {build.name}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary-button"
                  disabled={
                    busy ||
                    !buildId ||
                    !expected.slotId ||
                    expected.gameVersionId === null
                  }
                  onClick={() =>
                    action(async () => {
                      await playerRepository.assignEquipment(
                        buildId,
                        expected.id,
                      );
                    }, '已加入配置；裝備仍待合法性驗證。')
                  }
                >
                  加入配置
                </button>
                {onSimulate &&
                  buildId &&
                  data.builds
                    .find((b) => b.id === buildId)
                    ?.equipmentIds.includes(expected.id) && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onSimulate(buildId)}
                    >
                      以此配置前往模擬中心
                    </button>
                  )}
                <p className="field-note">
                  版本及部位確認後才可配裝；同部位會替換既有引用，原裝備保留在庫中。
                </p>
                {data.builds
                  .filter((build) => build.equipmentIds.includes(expected.id))
                  .map((build) => (
                    <p key={build.id} className="field-note">
                      已引用：{build.name}{' '}
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await playerRepository.removeEquipment(
                              build.id,
                              expected.id,
                            );
                          }, '已解除配裝，裝備仍保留。')
                        }
                      >
                        解除 {build.name} 配裝
                      </button>
                    </p>
                  ))}
                <details>
                  <summary>編輯歷史</summary>
                  {(data.equipmentHistory ?? []).filter(
                    (entry) => entry.equipmentId === expected.id,
                  ).length === 0 && <p>尚無舊版快照。</p>}
                  {(data.equipmentHistory ?? [])
                    .filter((entry) => entry.equipmentId === expected.id)
                    .map((entry) => (
                      <div key={entry.id}>
                        <p>{entry.at}</p>
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => {
                            const old = EquipmentInstanceSchema.parse(
                              JSON.parse(entry.previousJson),
                            );
                            // Old images may have been deliberately removed; never resurrect without consent.
                            open(
                              { ...old, imageIds: expected.imageIds },
                              (data.equipmentImages ?? []).filter(
                                (image) => image.equipmentId === expected.id,
                              ),
                              false,
                            );
                            setExpected(expected);
                          }}
                        >
                          載入此版供校對
                        </button>
                        <details>
                          <summary>查看舊版輸入</summary>
                          <pre>{entry.previousJson}</pre>
                        </details>
                      </div>
                    ))}
                </details>
              </>
            )}
          </aside>
          <EquipmentEditor
            key={seed.id + revision}
            item={seed}
            images={seedImages}
            releases={data.dataReleases}
            busy={busy}
            onSave={(item, images) =>
              action(
                async () => {
                  await playerRepository.saveEquipment(item, images, expected);
                  const current = await playerRepository.snapshot();
                  open(
                    current.equipment.find((entry) => entry.id === item.id)!,
                    (current.equipmentImages ?? []).filter(
                      (image) => image.equipmentId === item.id,
                    ),
                    true,
                  );
                },
                item.validation.status === 'VALID'
                  ? '裝備已儲存，已通過版本規則驗證。'
                  : item.validation.status === 'INVALID'
                    ? '裝備已保存為草稿，存在不合法項目。'
                    : '裝備已儲存，尚未完成合法值驗證。',
              )
            }
          />
        </div>
      )}
      <p className="field-note">
        看不清楚的數值請留作未知；辨識只提供候選。承音與滿值依當前版本規則解析，查無資料不補值。
      </p>
    </section>
  );
}

function EquipmentEditor({
  item,
  images: savedImages,
  releases,
  busy,
  onSave,
}: {
  item: EquipmentInstance;
  images: EquipmentImage[];
  releases: GameDataRelease[];
  busy: boolean;
  onSave: (
    item: EquipmentInstance,
    images: EquipmentImage[],
  ) => Promise<boolean>;
}) {
  const touched = useRef(new Set<string>());
  function remember<T>(key: string, value: T): T {
    touched.current.add(key);
    return value;
  }
  const [draft, setDraft] = useState(() => structuredClone(item));
  const originalRelease = releases.find(
    (release) => release.version.id === item.gameVersionId,
  );
  const [baseRows, setBaseRows] = useState(() =>
    rowsFrom(item, 'base', originalRelease),
  );
  const [affixRows, setAffixRows] = useState(() =>
    rowsFrom(item, 'affix', originalRelease),
  );
  const [images, setImages] = useState(savedImages);
  const [persist, setPersist] = useState(savedImages.length > 0);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const release = releases.find(
    (entry) => entry.version.id === draft.gameVersionId,
  );
  const context = (change: Partial<EquipmentInstance>) => {
    Object.keys(change).forEach((key) => touched.current.add(key));
    setDraft((previous) => ({ ...previous, ...change }));
    const invalidate = (rows: ManualRow[]) =>
      rows.map((row) => ({ ...row, original: undefined, confirmed: false }));
    setBaseRows(invalidate);
    setAffixRows(invalidate);
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const matching = release?.equipment.filter(
        (def) =>
          def.name === draft.name &&
          (!draft.quality || draft.quality === def.quality) &&
          (!draft.tierId || draft.tierId === def.tierId) &&
          (!draft.slotId || draft.slotId === def.slotId),
      );
      const identified = matching?.length === 1 ? matching[0] : undefined;
      const assembled = applyManualRows(
        {
          ...draft,
          definitionId: identified?.id ?? draft.definitionId,
          slotId: identified?.slotId ?? draft.slotId,
          tierId: identified?.tierId ?? draft.tierId,
          quality: identified?.quality ?? draft.quality,
        },
        baseRows,
        affixRows,
        item,
      );
      assembled.imageIds = persist ? images.map((image) => image.id) : [];
      await onSave(
        EquipmentInstanceSchema.parse(
          resolveEquipment(assembled, release).equipment,
        ),
        persist ? images : [],
      );
    } catch (reason) {
      setError(failureMessage(reason));
    }
  }
  return (
    <form className="panel equipment-editor" onSubmit={submit}>
      <h2>{item.name ?? '裝備人工校對'}</h2>
      <div className="ocr-notice">
        可使用本機 OCR
        或文字匯入取得候選；未勾選確認的值仍保存為未知，既有人工輸入不會被辨識覆蓋。
      </div>
      <label htmlFor="equipment-images">
        選擇裝備截圖（PNG／JPEG／WebP，最多 3 張）
      </label>
      <input
        id="equipment-images"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        disabled={busy || reading}
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          setError('');
          if (files.length + images.length > 3) {
            setError('每件裝備最多 3 張原圖。');
            return;
          }
          setReading(true);
          try {
            const added = await Promise.all(
              files.map((file) => readEquipmentImage(file, draft.id)),
            );
            setImages((previous) => [...previous, ...added]);
            if (!item.createdAt)
              setDraft((previous) => ({
                ...previous,
                creationMethod: 'SCREENSHOT',
              }));
          } catch (reason) {
            setError(failureMessage(reason));
          } finally {
            setReading(false);
          }
        }}
      />
      {images.length > 0 && (
        <div className="image-review">
          <div className="toolbar">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRotation((previous) => (previous + 90) % 360)}
            >
              旋轉預覽
            </button>
            <label className="inline-label">
              放大
              <input
                aria-label="截圖放大倍率"
                type="range"
                min="1"
                max="3"
                step=".25"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          </div>
          {images.map((image) => (
            <figure key={image.id}>
              <div className="image-viewport">
                <img
                  alt={'裝備原圖：' + image.name}
                  src={image.dataUrl}
                  style={{
                    transform:
                      'rotate(' + rotation + 'deg) scale(' + zoom + ')',
                  }}
                />
              </div>
              <figcaption>
                {image.name} · {image.width} × {image.height}
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setImages((previous) =>
                      previous.filter((item) => item.id !== image.id),
                    )
                  }
                >
                  移除此圖
                </button>
              </figcaption>
            </figure>
          ))}
          <label className="check-label">
            <input
              type="checkbox"
              checked={persist}
              onChange={(event) => setPersist(event.target.checked)}
            />
            我同意將原圖保存在本機，並包含於 JSON 備份
          </label>
          {!persist && (
            <p className="field-note">
              原圖只在本次編輯預覽，儲存時不保留圖片。
            </p>
          )}
        </div>
      )}
      <Suspense fallback={<p>載入辨識介面…</p>}>
        <OcrPanel
          images={images}
          release={release}
          disabled={busy || reading}
          onAdd={(candidate, kind) => {
            const current = kind === 'base' ? baseRows : affixRows;
            const added = addOcrCandidate(current, candidate, kind);
            if (added.added) {
              if (kind === 'base') setBaseRows(added.rows);
              else setAffixRows(added.rows);
            }
            return added.message;
          }}
          onMetadata={(candidate) => {
            const field = candidate.field;
            if (candidate.value === null || touched.current.has(field))
              return false;
            const current = draft[field];
            if (
              field === 'name'
                ? !!current && current !== '新裝備草稿'
                : current !== null && current !== undefined && current !== false
            )
              return false;
            const patch: Partial<EquipmentInstance> = {};
            if (field === 'name' && typeof candidate.value === 'string')
              patch.name = candidate.value;
            else if (field === 'quality' && typeof candidate.value === 'string')
              patch.quality = candidate.value;
            else if (field === 'tierId' && typeof candidate.value === 'string')
              patch.tierId = candidate.value;
            else if (field === 'slotId' && typeof candidate.value === 'string')
              patch.slotId = candidate.value;
            else if (
              field === 'tuningStage' &&
              typeof candidate.value === 'number'
            )
              patch.tuningStage = candidate.value;
            else if (
              field === 'isChengYin' &&
              typeof candidate.value === 'boolean'
            )
              patch.isChengYin = candidate.value;
            else return false;
            context(patch);
            setDraft((previous) => ({
              ...previous,
              ocrMetadata: [
                ...(previous.ocrMetadata ?? []),
                { field, trace: candidate.trace },
              ],
            }));
            return true;
          }}
        />
      </Suspense>
      <label htmlFor="equipment-name">裝備名稱（玩家標籤）</label>
      <input
        id="equipment-name"
        value={draft.name ?? ''}
        maxLength={100}
        required
        onChange={(event) =>
          setDraft((previous) => ({
            ...previous,
            name: remember('name', event.target.value),
            definitionId: undefined,
          }))
        }
        disabled={busy}
      />
      <label htmlFor="equipment-version">裝備資料版本</label>
      <select
        id="equipment-version"
        value={draft.gameVersionId ?? ''}
        disabled={busy}
        onChange={(event) =>
          context({
            gameVersionId: event.target.value || null,
            definitionId: undefined,
            slotId: undefined,
            tierId: null,
            quality: null,
          })
        }
      >
        <option value="">未知版本（草稿）</option>
        {releases.map((release) => (
          <option key={release.version.id} value={release.version.id}>
            {release.version.label} /{' '}
            {release.purpose === 'SYNTHETIC_TEST' ? '合成測試' : '未審核'}
          </option>
        ))}
      </select>
      <p className="field-note">
        不要求先分類；版本與名稱唯一匹配時才識別部位，查無資料保留草稿。
      </p>
      <details>
        <summary>品質與階級等補充欄位（可留白）</summary>
        <label htmlFor="equipment-quality">品質</label>
        <select
          id="equipment-quality"
          value={draft.quality ?? ''}
          disabled={busy}
          onChange={(event) => context({ quality: event.target.value || null })}
        >
          <option value="">未知</option>
          <option value="purple">紫裝（人工指定）</option>
          {draft.quality && draft.quality !== 'purple' && (
            <option value={draft.quality}>{draft.quality}</option>
          )}
        </select>
        <label htmlFor="equipment-tier">階級代號（未確認可留白）</label>
        <input
          id="equipment-tier"
          value={draft.tierId ?? ''}
          onChange={(event) => context({ tierId: event.target.value || null })}
          disabled={busy}
          pattern="[a-z0-9][a-z0-9_-]*"
        />
        <label htmlFor="equipment-slot">部位代號（未確認可留白）</label>
        <input
          id="equipment-slot"
          value={draft.slotId ?? ''}
          onChange={(event) =>
            setDraft((previous) => ({
              ...previous,
              slotId: remember('slotId', event.target.value || undefined),
            }))
          }
          disabled={busy}
          pattern="[a-z0-9][a-z0-9_-]*"
        />
        <label className="check-label">
          <input
            type="checkbox"
            checked={draft.isChengYin}
            onChange={(event) => {
              context({ isChengYin: event.target.checked });
              setAffixRows((rows) =>
                rows.map((row) => ({
                  ...row,
                  original: undefined,
                  confirmed: false,
                  valueMode: event.target.checked ? 'CHENG_YIN' : 'MANUAL',
                  maxOnChengYinConfirmed: false,
                })),
              );
            }}
            disabled={busy}
          />
          此裝備有承音特徵（先查實值，缺值才用適用模型）
        </label>
        <label htmlFor="equipment-tuning">調律階段（未知留白）</label>
        <input
          id="equipment-tuning"
          type="number"
          min="0"
          step="1"
          value={draft.tuningStage ?? ''}
          onChange={(event) =>
            context({
              tuningStage:
                event.target.value === '' ? null : Number(event.target.value),
            })
          }
          disabled={busy}
        />
      </details>
      <ManualRows
        title="基礎屬性"
        rows={baseRows}
        setRows={setBaseRows}
        busy={busy}
        release={release}
        kind="base"
      />
      <ManualRows
        title="既有詞條"
        rows={affixRows}
        setRows={setAffixRows}
        busy={busy}
        release={release}
        kind="affix"
        chengYin={draft.isChengYin}
      />
      <EquipmentRulesPanel
        key={JSON.stringify([draft, baseRows, affixRows])}
        disabled={busy || reading}
        getEquipment={() =>
          applyManualRows(structuredClone(draft), baseRows, affixRows, item)
        }
        release={release}
        onlyExplicit={draft.onlyExplicit ?? false}
        onOnlyExplicit={(value) =>
          setDraft((previous) => ({ ...previous, onlyExplicit: value }))
        }
        onMaximum={() =>
          setAffixRows((rows) =>
            rows.map((row) => ({
              ...row,
              valueMode: 'MAX',
              maxOnChengYinConfirmed: true,
            })),
          )
        }
      />
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <p className="field-note">
        保存的是人工草稿，不等同合法裝備。空白或未確認數字不當作
        0；所有推估沿用「預估值」標示。
      </p>
      <div className="toolbar">
        <button
          type="submit"
          className="secondary-button"
          disabled={busy || reading || !draft.name?.trim()}
        >
          確認並儲存裝備
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy || reading}
          onClick={() => {
            setDraft(structuredClone(item));
            setBaseRows(rowsFrom(item, 'base', originalRelease));
            setAffixRows(rowsFrom(item, 'affix', originalRelease));
            setError('');
          }}
        >
          還原本次數值修改
        </button>
      </div>
    </form>
  );
}
function ManualRows({
  title,
  rows,
  setRows,
  busy,
  release,
  kind,
  chengYin = false,
}: {
  title: string;
  rows: ManualRow[];
  setRows: (change: (rows: ManualRow[]) => ManualRow[]) => void;
  busy: boolean;
  release?: GameDataRelease;
  kind: 'base' | 'affix';
  chengYin?: boolean;
}) {
  const update = (key: string, change: Partial<ManualRow>) =>
    setRows((previous) =>
      previous.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  return (
    <fieldset disabled={busy}>
      <legend>{title}</legend>
      {rows.length === 0 && (
        <p className="muted">尚無{title}，也可先保存空白草稿。</p>
      )}
      {rows.map((row, index) => (
        <div key={row.key} className="manual-row">
          <label htmlFor={row.key + '-name'}>
            {title}名稱 {index + 1}
          </label>
          <input
            id={row.key + '-name'}
            value={row.label}
            required
            maxLength={100}
            onChange={(event) => {
              const label = event.target.value;
              const definitions =
                kind === 'base' ? release?.stats : release?.affixes;
              const match = definitions?.filter((def) => def.name === label);
              update(row.key, {
                label,
                id:
                  match?.length === 1
                    ? match[0].id
                    : 'manual-' + crypto.randomUUID(),
                original: undefined,
                confirmed: false,
              });
            }}
          />
          <label htmlFor={row.key + '-value'}>
            {title}數值 {index + 1}（原單位）
          </label>
          <input
            id={row.key + '-value'}
            type="number"
            step="any"
            value={row.text}
            onChange={(event) =>
              update(row.key, { text: event.target.value, confirmed: false })
            }
          />
          <label className="check-label">
            <input
              aria-label={'已確認' + title + ' ' + (index + 1)}
              type="checkbox"
              checked={row.confirmed}
              disabled={row.text.trim() === ''}
              onChange={(event) =>
                update(row.key, {
                  confirmed: event.target.checked,
                  original: undefined,
                })
              }
            />
            已人工核對此值
          </label>
          <span className="muted">
            {row.original &&
            row.text === row.originalText &&
            row.label === row.originalLabel &&
            row.confirmed === row.originalConfirmed
              ? valueStatusLabel(row.original)
              : row.confirmed
                ? '手動輸入（待儲存）'
                : '未知（原文待確認）'}
          </span>
          {kind === 'affix' && (
            <>
              <label htmlFor={row.key + '-mode'}>有效值模式 {index + 1}</label>
              <select
                id={row.key + '-mode'}
                value={row.valueMode ?? (chengYin ? 'CHENG_YIN' : 'MANUAL')}
                onChange={(event) =>
                  update(row.key, {
                    valueMode: event.target.value as ManualRow['valueMode'],
                    maxOnChengYinConfirmed: event.target.value === 'MAX',
                  })
                }
              >
                <option value="MANUAL">目前值（人工確認優先）</option>
                <option value="CHENG_YIN">
                  承音（人工覆寫／實值／適用模型）
                </option>
                <option value="MAX">明確選擇當階滿值（取代承音預覽）</option>
              </select>
              <p className="field-note">
                模式只影響有效值，不改寫原值。承音模式保留已確認的實例覆寫；選擇滿值即明確解除同詞條承音衝突。
              </p>
            </>
          )}
          {row.ocr && (
            <details className="ocr-evidence">
              <summary>辨識原文與信心</summary>
              <p>{row.ocr.rawText}</p>
              <p>
                辨識信心：
                {row.ocr.confidence === null
                  ? '未知'
                  : Math.round(row.ocr.confidence * 100) + '%'}
                ；尚需人工核對
              </p>
              <p>
                原候選：{row.ocr.recognizedLabel}{' '}
                {row.ocr.recognizedValue ?? '未知'}
                {row.ocr.unit}
              </p>
            </details>
          )}
          {row.original && (
            <details>
              <summary>原數值依據</summary>
              <pre>{JSON.stringify(row.original, null, 2)}</pre>
            </details>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setRows((previous) =>
                previous.filter((item) => item.key !== row.key),
              )
            }
          >
            移除{title} {index + 1}
          </button>
        </div>
      ))}
      <button
        className="secondary-button"
        type="button"
        onClick={() => setRows((previous) => [...previous, newRow()])}
      >
        新增{title}
      </button>
    </fieldset>
  );
}
