import { useState } from 'react';
import {
  resolveEquipment,
  valueStatusLabel,
  type EquipmentInstance,
  type EquipmentResolution,
  type GameDataRelease,
  type ResolvedValue,
} from '@wwm/game-data';
function Value({ value }: { value: ResolvedValue }) {
  return (
    <div>
      <span>
        {value.value ?? '未知'} · {valueStatusLabel(value)}
      </span>
      <details>
        <summary>計算依據與來源</summary>
        <pre>{JSON.stringify(value, null, 2)}</pre>
      </details>
    </div>
  );
}
export default function EquipmentRulesPanel({
  getEquipment,
  release,
  onlyExplicit,
  onOnlyExplicit,
  onMaximum,
  disabled,
}: {
  getEquipment: () => EquipmentInstance;
  release?: GameDataRelease;
  onlyExplicit: boolean;
  onOnlyExplicit: (value: boolean) => void;
  onMaximum: () => void;
  disabled: boolean;
}) {
  const [preview, setPreview] = useState<EquipmentResolution>();
  const [error, setError] = useState('');
  return (
    <fieldset disabled={disabled} className="equipment-rules">
      <legend>當階數值與合法性</legend>
      <label className="check-label">
        <input
          type="checkbox"
          checked={onlyExplicit}
          onChange={(event) => onOnlyExplicit(event.target.checked)}
        />
        僅使用明確資料（禁止推估）
      </label>
      <p className="field-note">
        先預覽目前值、有效值與上限。自動帶值不更動原始輸入，儲存時依當前版本重新驗證。
      </p>
      <button
        type="button"
        className="secondary-button"
        onClick={() => {
          try {
            setPreview(resolveEquipment(getEquipment(), release));
            setError('');
          } catch (reason) {
            setError(
              reason instanceof Error ? reason.message : '無法預覽，請核對輸入',
            );
          }
        }}
      >
        預覽有效值與合法性
      </button>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <div aria-label="有效值預覽">
          <p>
            合法性：{preview.equipment.validation.status}；
            {preview.provenance.label}
          </p>
          <ul>
            {preview.equipment.validation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {preview.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <h3>品質基礎屬性</h3>
          {preview.equipment.effectiveBaseStats?.map((stat) => (
            <div key={stat.statId}>
              <strong>
                {release?.stats.find((s) => s.id === stat.statId)?.name ??
                  stat.statId}
              </strong>
              ：<Value value={stat.value} />
            </div>
          ))}
          <h3>既有詞條（原值保留）</h3>
          {preview.equipment.affixes.map((affix) => (
            <div key={affix.affixId} className="manual-row">
              <strong>
                {release?.affixes.find((a) => a.id === affix.affixId)?.name ??
                  affix.affixId}
              </strong>
              <p>
                目前值：{affix.current.value ?? '未知'} ·{' '}
                {valueStatusLabel(affix.current)}
              </p>
              <p>有效值：</p>
              <Value value={affix.effective} />
              <p>當階上限：</p>
              <Value value={affix.maximum} />
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            disabled={!preview.canApplyLegalMaximum}
            onClick={onMaximum}
          >
            填入已驗證合法滿值
          </button>
          {!preview.canApplyLegalMaximum && (
            <p className="field-note">
              缺少完整已驗證規則或明確上限，不能自動填入合法滿值；可逐條選擇模擬模式並查看缺失原因。
            </p>
          )}
          <p className="field-note">
            此操作明確選擇所有既有詞條的 MAX
            模式，取代承音有效值預覽；原始數值不變。請再次預覽後儲存。
          </p>
        </div>
      )}
    </fieldset>
  );
}
