import { useState } from 'react';
import {
  generateIdealGear,
  valueStatusLabel,
  type EquipmentInstance,
  type GameDataRelease,
  type GenerationOptions,
} from '@wwm/game-data';
export default function EquipmentWorkshop({
  releases,
  equipment,
  onOpen,
}: {
  releases: GameDataRelease[];
  equipment: EquipmentInstance[];
  onOpen: (item: EquipmentInstance) => void;
}) {
  const [version, setVersion] = useState(''),
    [definition, setDefinition] = useState(''),
    [level, setLevel] = useState(''),
    [stage, setStage] = useState('');
  const [mode, setMode] = useState<GenerationOptions['mode']>('TARGET_AFFIX');
  const [valueMode, setValueMode] =
    useState<GenerationOptions['valueMode']>('MAX');
  const [seed, setSeed] = useState('0'),
    [sourceId, setSourceId] = useState('');
  const [selected, setSelected] = useState<string[]>([]),
    [values, setValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false),
    [onlyExplicit, setOnlyExplicit] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof generateIdealGear>>(),
    [error, setError] = useState('');
  const release = releases.find((r) => r.version.id === version),
    def = release?.equipment.find((d) => d.id === definition);
  const source = equipment.find((e) => e.id === sourceId);
  const clear = () => {
    setResult(undefined);
    setError('');
  };
  const ids =
    mode === 'MODIFY_OWNED'
      ? (source?.affixes.map((a) => a.affixId) ?? [])
      : (def?.allowedAffixIds ?? []);
  const num = (text: string) => (text.trim() ? Number(text) : NaN);
  return (
    <section className="panel" aria-label="理想裝備工坊">
      <h2>理想裝備工坊</h2>
      <p>
        生成後送入共用編輯器，再保存至統一裝備庫。當階滿值候選尚未依DPS排名；不代表全域完美或遊戲取得保證。
      </p>
      {!releases.length && (
        <p>沒有版本化裝備規則，無法生成；仍可手動建立未知草稿。</p>
      )}
      <label htmlFor="workshop-version">生成資料版本</label>
      <select
        id="workshop-version"
        value={version}
        onChange={(e) => {
          clear();
          setVersion(e.target.value);
          setDefinition('');
          setLevel('');
          setStage('');
          setSelected([]);
          setSourceId('');
        }}
      >
        <option value="">選擇版本</option>
        {releases.map((r) => (
          <option key={r.version.id} value={r.version.id}>
            {r.version.label}
          </option>
        ))}
      </select>
      {release?.purpose === 'SYNTHETIC_TEST' && (
        <p>合成測試資料，非遊戲真實裝備數值。</p>
      )}
      <label htmlFor="workshop-mode">生成方式</label>
      <select
        id="workshop-mode"
        value={mode}
        onChange={(e) => {
          clear();
          setMode(e.target.value as typeof mode);
          setSelected([]);
          setValues({});
        }}
      >
        <option value="PERFECT_LEGAL">當階滿值候選（未排名）</option>
        <option value="TARGET_AFFIX">指定詞條</option>
        <option value="RANDOM_LEGAL">隨機合法候選（均勻示範）</option>
        <option value="MODIFY_OWNED">既有裝備微調</option>
      </select>
      {mode === 'MODIFY_OWNED' ? (
        <>
          <label htmlFor="workshop-source">微調原件</label>
          <select
            id="workshop-source"
            value={sourceId}
            onChange={(e) => {
              clear();
              setSourceId(e.target.value);
              setSelected([]);
              setValues({});
              const item = equipment.find((a) => a.id === e.target.value);
              setDefinition(item?.definitionId ?? '');
              setStage(item?.tuningStage?.toString() ?? '');
            }}
          >
            <option value="">選擇原件</option>
            {equipment
              .filter((e) => e.gameVersionId === version)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name ?? e.id}
                </option>
              ))}
          </select>
          <p>只變更勾選詞條的模式／數值；原件、身份、階段與未勾選詞條保留。</p>
        </>
      ) : (
        <>
          <label htmlFor="workshop-definition">生成裝備定義</label>
          <select
            id="workshop-definition"
            value={definition}
            onChange={(e) => {
              clear();
              setDefinition(e.target.value);
              setStage('');
              setSelected([]);
              setValues({});
            }}
          >
            <option value="">選擇版本裝備</option>
            {release?.equipment.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.quality} · {d.tierId} · {d.slotId}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="workshop-level">使用角色等級</label>
      <select
        id="workshop-level"
        value={level}
        onChange={(e) => {
          clear();
          setLevel(e.target.value);
        }}
      >
        <option value="">選擇合法等級</option>
        {release?.version.availableLevels.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <label htmlFor="workshop-stage">生成調律階段</label>
      <select
        id="workshop-stage"
        value={stage}
        disabled={mode === 'MODIFY_OWNED'}
        onChange={(e) => {
          clear();
          setStage(e.target.value);
        }}
      >
        <option value="">選擇已驗證階段</option>
        {def?.legality?.tuningStages
          .filter((n) => n !== null)
          .map((n) => (
            <option key={n} value={n!}>
              {n}
            </option>
          ))}
      </select>
      {mode !== 'PERFECT_LEGAL' && (
        <>
          <label htmlFor="workshop-value-mode">生成詞條模式</label>
          <select
            id="workshop-value-mode"
            value={valueMode}
            onChange={(e) => {
              clear();
              setValueMode(e.target.value as typeof valueMode);
            }}
          >
            <option value="MAX">當階滿值</option>
            <option value="CHENG_YIN">承音（實值優先）</option>
            <option value="MANUAL">指定數值／隨機步進值</option>
          </select>
        </>
      )}
      {mode === 'RANDOM_LEGAL' && (
        <>
          <label htmlFor="workshop-seed">生成Seed</label>
          <input
            id="workshop-seed"
            type="number"
            value={seed}
            onChange={(e) => {
              clear();
              setSeed(e.target.value);
            }}
          />
          <p>
            先均勻選合法詞條組合，再均勻選各詞條已驗證步進值，非真實掉落率。
          </p>
        </>
      )}
      {(mode === 'TARGET_AFFIX' || mode === 'MODIFY_OWNED') && (
        <fieldset>
          <legend>
            {mode === 'MODIFY_OWNED' ? '允許修改詞條' : '指定生成詞條'}
          </legend>
          {ids.map((id) => (
            <div key={id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(id)}
                  onChange={(e) => {
                    clear();
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, id]
                        : old.filter((a) => a !== id),
                    );
                  }}
                />
                {release?.affixes.find((a) => a.id === id)?.name ?? id}
              </label>
              {selected.includes(id) && valueMode === 'MANUAL' && (
                <>
                  <label htmlFor={'generated-value-' + id}>{id} 模擬數值</label>
                  <input
                    id={'generated-value-' + id}
                    type="number"
                    step="any"
                    value={values[id] ?? ''}
                    onChange={(e) => {
                      clear();
                      setValues({ ...values, [id]: e.target.value });
                    }}
                  />
                </>
              )}
            </div>
          ))}
        </fieldset>
      )}
      <label>
        <input
          type="checkbox"
          checked={onlyExplicit}
          onChange={(e) => {
            clear();
            setOnlyExplicit(e.target.checked);
          }}
        />
        僅使用明確資料（生成）
      </label>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => {
            clear();
            setConfirmed(e.target.checked);
          }}
        />
        確認這些是模擬設定，非遊戲實測或取得證明
      </label>
      <button
        type="button"
        className="secondary-button"
        disabled={!confirmed || !release}
        onClick={() => {
          clear();
          if (!release) return;
          const options = {
            mode,
            valueMode: mode === 'PERFECT_LEGAL' ? ('MAX' as const) : valueMode,
            definitionId: definition,
            level: num(level),
            tuningStage: num(stage),
            seed: num(seed),
            idPrefix: crypto.randomUUID(),
            evaluatedAt: new Date().toISOString(),
            scenarioConfirmed: true as const,
            onlyExplicit,
            affixes: selected.map((id) => ({
              id,
              value: valueMode === 'MANUAL' ? num(values[id] ?? '') : null,
            })),
            mutableAffixIds: mode === 'MODIFY_OWNED' ? selected : [],
          };
          try {
            setResult(
              generateIdealGear({
                ...options,
                release,
                ...(mode === 'MODIFY_OWNED' ? { source } : {}),
              }),
            );
          } catch {
            setError('無法生成，請檢查版本與欄位');
          }
        }}
      >
        預覽生成候選
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <section aria-label="生成預覽">
          <h3>
            {result.status === 'READY'
              ? '合法候選已生成'
              : result.status === 'PARTIAL'
                ? '部分資料／預估候選，未確認精確合法'
                : '無法生成'}
          </h3>
          <p>{result.note}</p>
          <ul>
            {result.issues.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {result.candidates.map((item, i) => (
            <article key={item.id}>
              <h4>
                候選 {i + 1} · {item.validation.status}
              </h4>
              <p>
                品質：{item.quality} · 階級：{item.tierId}
              </p>
              <ul>
                {item.effectiveBaseStats?.map((s) => (
                  <li key={s.statId}>
                    {s.statId}：{s.value.value ?? '未知'} ·{' '}
                    {valueStatusLabel(s.value)}
                  </li>
                ))}
                {item.affixes.map((a) => (
                  <li key={a.affixId}>
                    {a.affixId}：{a.effective.value ?? '未知'} ·{' '}
                    {valueStatusLabel(a.effective)} · 當階上限{' '}
                    {a.maximum.value ?? '未知'} · {valueStatusLabel(a.maximum)}
                  </li>
                ))}
              </ul>
              <details>
                <summary>生成來源、模型與差異</summary>
                <pre>
                  {JSON.stringify(
                    {
                      generation: item.generation,
                      before: source ?? null,
                      after: item,
                      rules: def?.legality,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onOpen(item)}
              >
                以共用編輯器開啟候選 {i + 1}
              </button>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
