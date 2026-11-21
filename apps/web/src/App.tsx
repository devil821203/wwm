const OptimizationWorkspace = lazy(
  () => import('./optimization/OptimizationWorkspace'),
);
import { lazy, Suspense, useState } from 'react';
import CharacterWorkspace from './player/CharacterWorkspace';
const MeasurementWorkspace = lazy(
  () => import('./measurement/MeasurementWorkspace'),
);
const SimulationWorkspace = lazy(
  () => import('./simulation/SimulationWorkspace'),
);
const RotationWorkspace = lazy(() => import('./rotation/RotationWorkspace'));
const DamageWorkspace = lazy(() => import('./calculation/DamageWorkspace'));
const SplendorPreview = lazy(() => import('./preview/SplendorPreview'));
const EquipmentWorkspace = lazy(() => import('./equipment/EquipmentWorkspace'));

const missingData = [
  '國際服版本與合法等級',
  '角色與裝備屬性',
  '技能係數與傷害公式',
];

export default function App() {
  const [simulationBuildId, setSimulationBuildId] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [page, setPage] = useState<
    | 'preview'
    | 'overview'
    | 'characters'
    | 'equipment'
    | 'damage'
    | 'measurement'
    | 'rotation'
    | 'simulation'
    | 'optimization'
  >('overview');
  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="#main" aria-label="燕雲十六聲傷害計算器首頁">
          <span className="seal" aria-hidden="true">
            燕
          </span>
          <span>
            燕雲十六聲<small>傷害計算器 · 國際服</small>
          </span>
        </a>
        <span className="header-note">配裝有據，出招有數。</span>
        <span className="badge">開發預覽</span>
      </header>
      <nav className="main-nav" aria-label="主選單">
        <button
          aria-current={page === 'overview' ? 'page' : undefined}
          onClick={() => setPage('overview')}
        >
          計算工作臺
        </button>
        <button
          aria-current={page === 'preview' ? 'page' : undefined}
          onClick={() => setPage('preview')}
        >
          鳴金·虹試算
        </button>
        <button
          aria-current={page === 'characters' ? 'page' : undefined}
          onClick={() => setPage('characters')}
        >
          角色與配置
        </button>
        <button
          aria-current={page === 'equipment' ? 'page' : undefined}
          onClick={() => setPage('equipment')}
        >
          裝備庫
        </button>
        <button
          aria-current={page === 'damage' ? 'page' : undefined}
          onClick={() => setPage('damage')}
        >
          傷害與溯源
        </button>
        <button
          aria-current={page === 'measurement' ? 'page' : undefined}
          onClick={() => setPage('measurement')}
        >
          實測紀錄
        </button>
        <button
          aria-current={page === 'rotation' ? 'page' : undefined}
          onClick={() => setPage('rotation')}
        >
          循環驗證
        </button>
        <button
          aria-current={page === 'simulation' ? 'page' : undefined}
          onClick={() => setPage('simulation')}
        >
          模擬中心
        </button>
        <button
          aria-current={page === 'optimization' ? 'page' : undefined}
          onClick={() => setPage('optimization')}
        >
          裝備最佳化
        </button>
      </nav>
      <main id="main">
        {page === 'preview' ? (
          <Suspense fallback={<p>載入試算紀錄…</p>}>
            <SplendorPreview />
          </Suspense>
        ) : page === 'optimization' ? (
          <Suspense fallback={<p>載入最佳化…</p>}>
            <OptimizationWorkspace
              onSimulate={(id) => {
                setSimulationBuildId(id);
                setPage('simulation');
              }}
            />
          </Suspense>
        ) : page === 'simulation' ? (
          <Suspense fallback={<p>載入模擬中心…</p>}>
            <SimulationWorkspace initialBuildId={simulationBuildId} />
          </Suspense>
        ) : page === 'rotation' ? (
          <Suspense fallback={<p>載入循環驗證…</p>}>
            <RotationWorkspace />
          </Suspense>
        ) : page === 'measurement' ? (
          <Suspense fallback={<p>載入實測紀錄…</p>}>
            <MeasurementWorkspace />
          </Suspense>
        ) : page === 'damage' ? (
          <Suspense fallback={<p>載入計算介面…</p>}>
            <DamageWorkspace />
          </Suspense>
        ) : page === 'equipment' ? (
          <Suspense fallback={<p>載入裝備庫…</p>}>
            <EquipmentWorkspace
              onSimulate={(id) => {
                setSimulationBuildId(id);
                setPage('simulation');
              }}
            />
          </Suspense>
        ) : page === 'characters' ? (
          <CharacterWorkspace />
        ) : (
          <>
            <section className="hero">
              <div className="eyebrow">WHERE WINDS MEET / BUILD LAB</div>
              <h1>
                每一招，
                <br />
                皆有<span>依據。</span>
              </h1>
              <p className="intro">
                從角色面板到戰鬥循環，探索你的配裝可能。
                <br />
                讓每一筆傷害，都能回到它的資料來源。
              </p>
              <a className="primary" href="#workspace">
                查看計算準備狀態 <span aria-hidden="true">↗</span>
              </a>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit" />
                <span className="art-word">勢</span>
                <span className="art-caption">知其勢 · 明其數</span>
              </div>
            </section>
            <section
              className="workspace"
              id="workspace"
              aria-labelledby="workspace-title"
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">01 / 計算工作臺</span>
                  <h2 id="workspace-title">從一份可信的資料開始</h2>
                </div>
                <span className="muted">首個驗證流派：鳴金·虹</span>
              </div>
              <div className="workspace-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <h3>配置準備</h3>
                    <span className="step">待建立</span>
                  </div>
                  <label htmlFor="version">遊戲資料版本</label>
                  <select id="version" disabled>
                    <option>尚無可用資料版本</option>
                  </select>
                  <label htmlFor="path">流派</label>
                  <select id="path" disabled>
                    <option>待載入版本化流派資料</option>
                  </select>
                  <label htmlFor="level">角色等級</label>
                  <select id="level" disabled>
                    <option>請先取得合法等級資料</option>
                  </select>
                  <p className="field-note">
                    選項將依版本資料提供，不預設等級上限。
                  </p>
                </article>
                <article
                  className="panel result"
                  aria-labelledby="result-title"
                >
                  <div className="panel-heading">
                    <h3 id="result-title">預期每秒傷害</h3>
                    <span className="status">資料未就緒</span>
                  </div>
                  <div className="dps" aria-label="尚無 DPS 結果">
                    — <small>DPS</small>
                  </div>
                  <h4>尚無可信 DPS</h4>
                  <p>
                    必要資料尚未齊備，無法計算。完成資料配置後，這裡將顯示傷害結果與來源。
                  </p>
                  <button
                    className="text-button"
                    aria-expanded={showSources}
                    aria-controls="missing-data"
                    onClick={() => setShowSources(!showSources)}
                  >
                    {showSources ? '收起缺失資料' : '查看缺失資料'}{' '}
                    <span aria-hidden="true">{showSources ? '−' : '+'}</span>
                  </button>
                  {showSources && (
                    <ul id="missing-data">
                      {missingData.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
            </section>
            <section className="principles" aria-label="資料品質原則">
              <article>
                <span className="number">01</span>
                <h3>實值優先</h3>
                <p>已確認的實際數值優先，並保留來源與版本。</p>
              </article>
              <article>
                <span className="number">02</span>
                <h3>預估可辨</h3>
                <p>推估欄位標示「預估值」，衍生結果標示「包含預估資料」。</p>
              </article>
              <article>
                <span className="number">03</span>
                <h3>未知不補值</h3>
                <p>缺少必要數值與適用模型時，清楚列出無法計算的原因。</p>
              </article>
            </section>
          </>
        )}
      </main>
      <footer>
        <span>燕雲十六聲 · 配裝研究工具</span>
        <span>非官方工具，與遊戲營運方無隸屬關係。</span>
      </footer>
    </div>
  );
}
