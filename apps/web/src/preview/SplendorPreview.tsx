const panel = [
  ['外功攻擊', '1,184～3,685'],
  ['鳴金攻擊', '401～997'],
  ['精準率（實算）', '93.8%'],
  ['會心率（實算）', '25.8%'],
  ['會意率（實算）', '39.5%'],
  ['外功穿透', '46.1'],
  ['屬攻穿透', '29.6'],
  ['對首領單位增傷', '6.0%'],
];

export default function SplendorPreview() {
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
        <span className="status">包含預估資料</span>
      </div>
      <p className="intro">
        這是依已確認面板與參考輸出軸保存的試算紀錄；數值與公式尚待實測驗證。
      </p>
      <div className="preview-layout">
        <article
          className="panel preview-result"
          aria-labelledby="preview-result-title"
        >
          <div className="panel-heading">
            <h2 id="preview-result-title">55 秒參考循環</h2>
            <span className="status">預估值</span>
          </div>
          <p className="preview-caption">平均每秒傷害</p>
          <div className="preview-number" aria-label="預估平均 DPS">
            56,382 <small>DPS</small>
          </div>
          <div className="preview-metrics">
            <div>
              <span>循環期望總傷害</span>
              <strong>3,101,002</strong>
              <small>預估值</small>
            </div>
            <div>
              <span>相對參考軸畢業度</span>
              <strong>76.89%</strong>
              <small>預估值</small>
            </div>
          </div>
          <p className="field-note">
            畢業度以參考軸基準傷害 4,033,171.88 計算，僅供同一參考軸比較。
          </p>
        </article>
        <article className="panel" aria-labelledby="preview-config-title">
          <div className="panel-heading">
            <h2 id="preview-config-title">本次配置</h2>
          </div>
          <dl className="preview-details">
            <div>
              <dt>流派</dt>
              <dd>鳴金·虹</dd>
            </div>
            <div>
              <dt>遊戲版本</dt>
              <dd>1.0.334.64785（使用者指定）</dd>
            </div>
            <div>
              <dt>角色等級</dt>
              <dd>100</dd>
            </div>
            <div>
              <dt>套裝</dt>
              <dd>玉斗 3/4</dd>
            </div>
            <div>
              <dt>心法</dt>
              <dd>易水歌、無名心法、千山法、凝神章</dd>
            </div>
          </dl>
        </article>
      </div>
      <article
        className="panel preview-panel"
        aria-labelledby="preview-stats-title"
      >
        <div className="panel-heading">
          <h2 id="preview-stats-title">試算使用的面板</h2>
        </div>
        <dl className="preview-stats">
          {panel.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </article>
      <article
        className="panel preview-panel"
        aria-labelledby="preview-notes-title"
      >
        <div className="panel-heading">
          <h2 id="preview-notes-title">結果與來源</h2>
        </div>
        <ul className="preview-notes">
          <li>
            參考軸為社群早期 100 級循環，尚未以目前國際服版本或實測傷害校準。
          </li>
          <li>
            角色面板直接代入；未再次加上裝備或心法面板屬性，玉斗四件套效果未啟用。
          </li>
          <li>
            參考模型對缺少的欄位使用預設值；指定技能增傷的適用範圍仍待核對。
          </li>
          <li>這份畫面顯示固定試算紀錄；更改角色配置不會自動更新結果。</li>
        </ul>
        <a
          className="text-button preview-source"
          href="https://github.com/AruSeito/yysls-equipment-simulator/blob/7fdf5fe9cc1f35352e5dec89ab07fe3aed202a2f/src/lib/data/classConfig.ts"
          target="_blank"
          rel="noreferrer"
        >
          查看參考輸出軸來源
        </a>
      </article>
    </section>
  );
}
