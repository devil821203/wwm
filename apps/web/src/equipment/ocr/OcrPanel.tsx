import { useEffect, useRef, useState } from 'react';
import type { EquipmentImage, GameDataRelease } from '@wwm/game-data';
import { fullCrop, runOcr, TextOcrAdapter, type Crop } from './contracts';
import { LocalTesseractAdapter } from './local-adapter';
import {
  parseOcrResult,
  type MetadataCandidate,
  type OcrCandidate,
  type ParsedOcr,
} from './parser';

const fieldNames = {
  name: '裝備名稱',
  quality: '品質',
  tierId: '階級',
  slotId: '部位',
  tuningStage: '調律階段',
  isChengYin: '承音',
};
export default function OcrPanel({
  images,
  release,
  disabled,
  onAdd,
  onMetadata,
}: {
  images: EquipmentImage[];
  release?: GameDataRelease;
  disabled: boolean;
  onAdd: (candidate: OcrCandidate, kind: 'base' | 'affix') => string;
  onMetadata: (candidate: MetadataCandidate) => boolean;
}) {
  const [mode, setMode] = useState<'local' | 'text'>('local');
  const [imageId, setImageId] = useState('');
  const [language, setLanguage] = useState<'eng' | 'chi_tra+eng'>(
    'chi_tra+eng',
  );
  const [text, setText] = useState('');
  const [crop, setCrop] = useState<Crop>({ ...fullCrop });
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState<ParsedOcr | null>(null);
  const [raw, setRaw] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  const image = images.find((item) => item.id === imageId) ?? images[0];
  async function recognize() {
    if (!image || running) return;
    setError('');
    setNotice('');
    setRunning(true);
    setProgress(0);
    const current = new AbortController();
    controller.current = current;
    try {
      const adapter =
        mode === 'local'
          ? new LocalTesseractAdapter()
          : new TextOcrAdapter(text);
      const input = {
        image,
        language,
        crop: mode === 'text' ? { ...fullCrop } : crop,
        rotation: mode === 'text' ? 0 : rotation,
        scale: mode === 'text' ? 1 : scale,
        signal: current.signal,
        onProgress: setProgress,
      };
      const result = await runOcr(adapter, input);
      const value = parseOcrResult(result, input, release);
      setParsed(value);
      setRaw(result.text);
      setNotice(
        value.fields.length + value.candidates.length
          ? '辨識候選已列出，尚未更動編輯器。'
          : '沒有可用數值候選，請對照原圖手動輸入。',
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : '辨識失敗，請改用文字或手動輸入。',
      );
    } finally {
      setRunning(false);
      if (controller.current === current) controller.current = null;
    }
  }
  return (
    <section className="ocr-panel" aria-label="辨識與候選校對">
      <h3>本機辨識與校對</h3>
      <p className="field-note">
        圖片不傳第三方；模型從本站載入。信心分數只描述辨識結果，所有數值仍須人工確認。
      </p>
      <label htmlFor="ocr-adapter">辨識方式</label>
      <select
        id="ocr-adapter"
        value={mode}
        disabled={running || disabled}
        onChange={(event) => setMode(event.target.value as typeof mode)}
      >
        <option value="local">本機影像辨識</option>
        <option value="text">文字匯入（不是影像辨識，信心未知）</option>
      </select>
      <label htmlFor="ocr-image">辨識原圖</label>
      <select
        id="ocr-image"
        value={image?.id ?? ''}
        disabled={running || disabled || !images.length}
        onChange={(event) => setImageId(event.target.value)}
      >
        {!images.length && <option value="">請先選擇原圖</option>}
        {images.map((image) => (
          <option key={image.id} value={image.id}>
            {image.name}
          </option>
        ))}
      </select>
      {mode === 'local' ? (
        <>
          <label htmlFor="ocr-language">辨識語言</label>
          <select
            id="ocr-language"
            value={language}
            disabled={running || disabled}
            onChange={(event) =>
              setLanguage(event.target.value as typeof language)
            }
          >
            <option value="chi_tra+eng">繁體中文＋英文</option>
            <option value="eng">英文</option>
          </select>
          <details>
            <summary>辨識範圍與方向（不改動原圖）</summary>
            <div className="crop-fields">
              {(['x', 'y', 'width', 'height'] as const).map((key, index) => (
                <label key={key}>
                  {
                    ['左側百分比', '頂端百分比', '寬度百分比', '高度百分比'][
                      index
                    ]
                  }
                  <input
                    aria-label={
                      ['左側百分比', '頂端百分比', '寬度百分比', '高度百分比'][
                        index
                      ]
                    }
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    disabled={running || disabled}
                    value={crop[key]}
                    onChange={(event) =>
                      setCrop((previous) => ({
                        ...previous,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <label htmlFor="ocr-rotation">辨識前旋轉</label>
            <select
              id="ocr-rotation"
              value={rotation}
              disabled={running || disabled}
              onChange={(event) => setRotation(Number(event.target.value))}
            >
              {[0, 90, 180, 270].map((value) => (
                <option key={value} value={value}>
                  {value}°
                </option>
              ))}
            </select>
            <label htmlFor="ocr-scale">辨識取樣倍率</label>
            <select
              id="ocr-scale"
              value={scale}
              disabled={running || disabled}
              onChange={(event) => setScale(Number(event.target.value))}
            >
              <option value="1">1 倍</option>
              <option value="2">2 倍</option>
            </select>
          </details>
        </>
      ) : (
        <>
          <label htmlFor="ocr-text">外部辨識或人工抄錄文字</label>
          <textarea
            id="ocr-text"
            rows={5}
            value={text}
            maxLength={20000}
            disabled={running || disabled}
            onChange={(event) => setText(event.target.value)}
            placeholder={'基礎屬性\nAttack 0\n詞條\nCritical Rate 12.5%'}
          />
        </>
      )}
      <div className="toolbar">
        <button
          type="button"
          className="secondary-button"
          disabled={
            running || disabled || !image || (mode === 'text' && !text.trim())
          }
          onClick={recognize}
        >
          {mode === 'local' ? '開始本機辨識' : '解析文字候選'}
        </button>
        {running && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => controller.current?.abort()}
          >
            取消辨識
          </button>
        )}
      </div>
      {running && (
        <p aria-live="polite">
          本機模型載入／辨識中 {Math.round(progress * 100)}%
        </p>
      )}
      {notice && (
        <p className="field-note" aria-live="polite">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error} 可繼續手動建檔。
        </p>
      )}
      {parsed && (
        <div>
          {parsed.fields.map((field) => (
            <article className="ocr-candidate" key={field.key}>
              <strong>
                {fieldNames[field.field]}候選：
                {field.value === null ? '未知' : String(field.value)}
              </strong>
              <p>原文：{field.trace.rawText}</p>
              <p>
                信心：
                {field.trace.confidence === null
                  ? '未知'
                  : Math.round(field.trace.confidence * 100) + '%'}
              </p>
              <button
                type="button"
                className="secondary-button"
                disabled={disabled || field.value === null}
                onClick={() =>
                  setNotice(
                    onMetadata(field)
                      ? '候選已填入，請繼續人工檢查。'
                      : '已有資料或曾手動修改，保留原值；請於欄位自行修正。',
                  )
                }
              >
                填入{fieldNames[field.field]}候選
              </button>
            </article>
          ))}
          {parsed.candidates.map((candidate, index) => (
            <article className="ocr-candidate" key={candidate.key}>
              <h4>數值候選 {index + 1}</h4>
              <p>原文：{candidate.trace.rawText}</p>
              <p>
                辨識信心：
                {candidate.trace.confidence === null
                  ? '未知'
                  : Math.round(candidate.trace.confidence * 100) + '%'}
              </p>
              {candidate.warnings.map((warning) => (
                <p className="review-warning" key={warning}>
                  {warning}
                </p>
              ))}
              <label htmlFor={candidate.key + '-kind'}>
                候選欄位種類 {index + 1}
              </label>
              <select
                id={candidate.key + '-kind'}
                value={candidate.kind}
                onChange={(event) =>
                  setParsed((previous) =>
                    previous
                      ? {
                          ...previous,
                          candidates: previous.candidates.map((item) =>
                            item.key === candidate.key
                              ? {
                                  ...item,
                                  kind: event.target
                                    .value as OcrCandidate['kind'],
                                }
                              : item,
                          ),
                        }
                      : previous,
                  )
                }
              >
                <option value="unknown">未知，請選擇</option>
                <option value="base">基礎屬性</option>
                <option value="affix">既有詞條</option>
              </select>
              <label htmlFor={candidate.key + '-label'}>
                候選名稱 {index + 1}
              </label>
              <input
                id={candidate.key + '-label'}
                value={candidate.label}
                maxLength={100}
                onChange={(event) =>
                  setParsed((previous) =>
                    previous
                      ? {
                          ...previous,
                          candidates: previous.candidates.map((item) =>
                            item.key === candidate.key
                              ? {
                                  ...item,
                                  label: event.target.value,
                                  matches: [],
                                }
                              : item,
                          ),
                        }
                      : previous,
                  )
                }
              />
              <label htmlFor={candidate.key + '-value'}>
                候選數值 {index + 1}（{candidate.trace.unit || '原單位'}）
              </label>
              <input
                id={candidate.key + '-value'}
                type="number"
                step="any"
                value={candidate.text}
                onChange={(event) =>
                  setParsed((previous) =>
                    previous
                      ? {
                          ...previous,
                          candidates: previous.candidates.map((item) =>
                            item.key === candidate.key
                              ? { ...item, text: event.target.value }
                              : item,
                          ),
                        }
                      : previous,
                  )
                }
              />
              {candidate.trace.box && (
                <p className="field-note">
                  辨識圖座標：{Object.values(candidate.trace.box).join(', ')}
                </p>
              )}
              <button
                type="button"
                className="secondary-button"
                disabled={
                  disabled ||
                  candidate.kind === 'unknown' ||
                  !candidate.label.trim()
                }
                onClick={() => {
                  if (candidate.kind !== 'unknown')
                    setNotice(onAdd(candidate, candidate.kind));
                }}
              >
                加入候選 {index + 1}（未確認）
              </button>
            </article>
          ))}
          {parsed.unparsed.length > 0 && (
            <details>
              <summary>未能解析的文字（保留未知）</summary>
              <pre>{parsed.unparsed.join('\n')}</pre>
            </details>
          )}
          <details>
            <summary>本次辨識原文</summary>
            <pre>{raw}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
