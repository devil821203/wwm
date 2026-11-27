import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { playerRepository } from '../player/database';
import { ConfigurationSummary } from '../player/ConfigurationSummary';

export default function SplendorPreview() {
  const [buildId, setBuildId] = useState('');
  const loaded = useLiveQuery(async () => {
    try {
      return { archive: await playerRepository.snapshot(), error: '' };
    } catch {
      return {
        archive: null,
        error: '無法讀取本機角色配置，請確認瀏覽器儲存功能。',
      };
    }
  }, []);
  const archive = loaded?.archive;
  const builds =
    archive?.builds.filter((build) =>
      archive.characters.some(
        (character) =>
          character.id === build.characterId &&
          character.pathId === 'bellstrike_splendor',
      ),
    ) ?? [];
  const selected = builds.find((build) => build.id === buildId);
  const character =
    selected &&
    archive?.characters.find((item) => item.id === selected.characterId);
  return (
    <section
      className="character-workspace splendor-preview"
      aria-labelledby="splendor-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">BELLSTRIKE SPLENDOR / REFERENCE</span>
          <h1 className="page-title" id="splendor-title">
            鳴金·虹試算
          </h1>
        </div>
      </div>
      <p className="intro">
        選擇已保存的鳴金·虹配置，查看該配置的資料及期望傷害；未保存的編輯不會套用。
      </p>
      {loaded?.error && <p role="alert">{loaded.error}</p>}
      {!loaded && <p>讀取本機資料中…</p>}
      {archive && (
        <>
          <label htmlFor="splendor-build">選擇鳴金·虹配置</label>
          <select
            id="splendor-build"
            value={selected?.id ?? ''}
            onChange={(event) => setBuildId(event.target.value)}
          >
            <option value="">請選擇配置</option>
            {builds.map((build) => (
              <option key={build.id} value={build.id}>
                {
                  archive.characters.find(
                    (character) => character.id === build.characterId,
                  )?.name
                }{' '}
                · {build.name}
              </option>
            ))}
          </select>
          {builds.length === 0 && (
            <p>尚無鳴金·虹配置，請先至「角色與配置」建立角色或匯入備份。</p>
          )}
          {selected && character && (
            <>
              <p>
                目前角色：{character.name}；等級：{character.level ?? '未知'}
                ；資料版本：{character.gameVersionId ?? '未指定'}
              </p>
              <ConfigurationSummary
                key={selected.id}
                archive={archive}
                build={selected}
                character={character}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
