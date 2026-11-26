import { useState } from 'react';
import type {
  Build,
  EquipmentImage,
  EquipmentInstance,
  GameDataRelease,
} from '@wwm/game-data';

type Filter =
  | 'all'
  | 'equipped'
  | 'sword'
  | 'spear'
  | 'ring'
  | 'pendant'
  | 'head'
  | 'chest'
  | 'legs'
  | 'wrist';
const filters: [Filter, string][] = [
  ['all', '全部'],
  ['equipped', '已配裝'],
  ['sword', '劍'],
  ['spear', '槍'],
  ['ring', '環'],
  ['pendant', '佩'],
  ['head', '冠冑'],
  ['chest', '胸甲'],
  ['legs', '脛甲'],
  ['wrist', '腕甲'],
];
const slotLabels: Record<string, string> = {
  sword: '劍',
  spear: '槍',
  ring: '環',
  pendant: '佩',
  head: '冠冑',
  chest: '胸甲',
  legs: '脛甲',
  wrist: '腕甲',
  weapon: '武器',
  bow: '弓箭',
};
function slot(item: EquipmentInstance): string {
  const id = item.slotId ?? '';
  if (slotLabels[id]) return id;
  const text = item.validation.reasons.join(' ');
  const hints: [string, string][] = [
    ['武器・劍', 'sword'],
    ['武器・槍', 'spear'],
    ['冠冑', 'head'],
    ['胸甲', 'chest'],
    ['脛甲', 'legs'],
    ['腕甲', 'wrist'],
    ['部位：環', 'ring'],
    ['部位：佩', 'pendant'],
    ['弓箭', 'bow'],
  ];
  return hints.find(([word]) => text.includes(word))?.[1] ?? '';
}
function numberText(value: number | null | undefined, raw: string | undefined) {
  if (value == null) return '未知';
  return `${value > 0 ? '+' : ''}${value}${raw?.includes('%') ? '%' : ''}`;
}
export default function EquipmentCards({
  equipment,
  images,
  builds,
  releases,
  selectedId,
  onOpen,
}: {
  equipment: EquipmentInstance[];
  images: EquipmentImage[];
  builds: Build[];
  releases: GameDataRelease[];
  selectedId?: string;
  onOpen: (item: EquipmentInstance) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const equipped = new Set(builds.flatMap((build) => build.equipmentIds));
  const visible = equipment.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'equipped' ? equipped.has(item.id) : slot(item) === filter),
  );
  return (
    <section className="equipment-library" aria-labelledby="inventory-title">
      <div className="inventory-heading">
        <h2 id="inventory-title">所有裝備（{equipment.length}）</h2>
        <span>顯示 {visible.length} 件</span>
      </div>
      <div className="equipment-filters" role="group" aria-label="篩選裝備">
        {filters.map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {!visible.length && <p className="muted">此分類目前沒有裝備。</p>}
      <ul className="equipment-cards">
        {visible.map((item) => {
          const image = images.find(
            (entry) =>
              entry.equipmentId === item.id &&
              item.imageIds?.includes(entry.id),
          );
          const definitions = releases.find(
            (r) => r.version.id === item.gameVersionId,
          );
          return (
            <li key={item.id}>
              <button
                type="button"
                className="equipment-card"
                aria-pressed={selectedId === item.id}
                onClick={() => onOpen(item)}
              >
                <div className="equipment-card-header">
                  {image ? (
                    <img
                      className="equipment-card-image"
                      src={image.dataUrl}
                      alt=""
                    />
                  ) : (
                    <span
                      className="equipment-card-image equipment-card-placeholder"
                      aria-hidden="true"
                    >
                      裝
                    </span>
                  )}
                  <div className="equipment-card-heading">
                    <strong>{item.name ?? '未命名裝備'}</strong>
                    <span>
                      {slotLabels[slot(item)] ?? '部位待確認'} ·{' '}
                      {item.creationMethod === 'SCREENSHOT'
                        ? '截圖'
                        : item.creationMethod === 'GENERATED'
                          ? '生成'
                          : '手動'}
                    </span>
                    <small>
                      {equipped.has(item.id) ? '已配裝 · ' : ''}
                      {item.validation.status === 'VALID'
                        ? '已驗證'
                        : '尚未驗證'}
                    </small>
                  </div>
                  <span className="equipment-card-edit" aria-hidden="true">
                    ✎
                  </span>
                </div>
                <div className="equipment-card-stats">
                  {item.affixes.length ? (
                    item.affixes.map((affix, index) => {
                      const name =
                        affix.observation?.rawName ??
                        definitions?.affixes.find(
                          (entry) => entry.id === affix.affixId,
                        )?.name ??
                        affix.affixId;
                      const value =
                        affix.current.value ?? affix.observation?.value;
                      const pending = affix.current.status === 'UNKNOWN';
                      return (
                        <div
                          className="equipment-card-stat"
                          key={`${affix.affixId}-${index}`}
                        >
                          <span>
                            {name}
                            {pending && <small>（待核對）</small>}
                          </span>
                          <span>
                            {numberText(value, affix.observation?.rawText)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <span className="equipment-card-empty">尚未輸入詞條</span>
                  )}
                </div>
                <span className="equipment-card-action">點選編輯與配裝</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
