import { useState, useEffect } from 'react'
import './RulesModal.css'

interface Props {
  onClose: () => void
}

const SECTIONS = [
  { id: 'overview',  label: '遊戲概述' },
  { id: 'resources', label: '資源說明' },
  { id: 'flow',      label: '回合流程' },
  { id: 'deploy',    label: '部署規則' },
  { id: 'resolve',   label: '結算詳解' },
  { id: 'cards',     label: '牌型說明' },
  { id: 'clans',     label: '氏族介紹' },
  { id: 'alliance',  label: '同盟牌' },
  { id: 'special',   label: '特殊規則' },
  { id: 'win',       label: '勝利條件' },
] as const

type SectionId = typeof SECTIONS[number]['id']

export default function RulesModal({ onClose }: Props) {
  const [active, setActive] = useState<SectionId>('overview')

  // ESC 關閉
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function scrollTo(id: SectionId) {
    setActive(id)
    document.getElementById(`rules-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-modal" onClick={e => e.stopPropagation()}>

        {/* ── 標題列 ── */}
        <div className="rules-header">
          <div className="rules-header__title">Kindred: Blood &amp; Betrayal — 遊戲規則</div>
          <button className="rules-close" onClick={onClose} title="關閉（ESC）">✕</button>
        </div>

        <div className="rules-body">

          {/* ── 左側導覽 ── */}
          <nav className="rules-nav">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`rules-nav__item ${active === s.id ? 'rules-nav__item--active' : ''}`}
                onClick={() => scrollTo(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* ── 內容區 ── */}
          <div className="rules-content" onScroll={e => {
            // 根據滾動位置更新 active
            const container = e.currentTarget
            for (const s of [...SECTIONS].reverse()) {
              const el = document.getElementById(`rules-${s.id}`)
              if (el && el.offsetTop - container.scrollTop <= 80) {
                setActive(s.id)
                break
              }
            }
          }}>

            {/* ─── 遊戲概述 ─────────────────────────── */}
            <section id="rules-overview" className="rules-section">
              <h2>遊戲概述</h2>
              <p>
                《Kindred: Blood &amp; Betrayal》是一款 <strong>3–6 人</strong>的異步推理派遣卡牌遊戲，
                背景設定於《避世血族》（Vampire: The Masquerade）的黑暗世界。
                玩家扮演各氏族的吸血鬼長老，在城市的地點爭奪勢力與影響力。
              </p>
              <div className="rules-callout">
                <span className="rules-callout__icon">🏆</span>
                <span><strong>遊戲目標：</strong>在 3 回合結束後，擁有最多<em>影響力</em>的玩家獲勝。</span>
              </div>
              <p>
                遊戲的核心張力在於：你必須秘密地將手牌<strong>派遣</strong>至各地點，與對手競爭影響力；
                同時利用血液資源強化你的牌，並在揭牌前決定是否<strong>撤退</strong>以保存實力。
                每張卡都有獨特效果，配合你的氏族策略，才能在黑暗中稱王。
              </p>
            </section>

            {/* ─── 資源說明 ─────────────────────────── */}
            <section id="rules-resources" className="rules-section">
              <h2>資源說明</h2>
              <div className="rules-resource-grid">
                <div className="rules-resource-card rules-resource-card--blood">
                  <div className="rules-resource-card__icon">💧</div>
                  <div className="rules-resource-card__name">血液（Blood）</div>
                  <div className="rules-resource-card__desc">
                    遊戲的行動資源。用於面朝下部署（花費 1 血液）、
                    為部署牌添加血液代幣以提升戰力、以及支付部分卡牌效果。
                    血液降至 0 時將觸發<strong>狂暴</strong>。
                    <br/><br/>
                    起始值：各氏族均為 <strong>6 血液</strong>。
                  </div>
                </div>
                <div className="rules-resource-card rules-resource-card--influence">
                  <div className="rules-resource-card__icon">⭐</div>
                  <div className="rules-resource-card__name">影響力（Influence）</div>
                  <div className="rules-resource-card__desc">
                    勝利分數。透過贏得地點爭奪獲得，部分卡牌效果也可改變影響力。
                    遊戲結束時影響力最高者獲勝；平手以血液多寡決定。
                    <br/><br/>
                    起始值：各氏族均為 <strong>3 影響力</strong>。
                  </div>
                </div>
              </div>
            </section>

            {/* ─── 回合流程 ─────────────────────────── */}
            <section id="rules-flow" className="rules-section">
              <h2>回合流程</h2>
              <p>遊戲共進行 <strong>3 回合</strong>，每回合依序執行以下階段：</p>

              <div className="rules-flow-steps">

                <div className="rules-flow-step">
                  <div className="rules-flow-step__num">1</div>
                  <div className="rules-flow-step__body">
                    <div className="rules-flow-step__title">飼育階段（Feed Phase）</div>
                    <p>每位玩家從自己的<strong>同盟牌</strong>中獲得血液。每張同盟牌每回合提供固定數量的血液（feedBlood 值）。</p>
                  </div>
                </div>

                <div className="rules-flow-step">
                  <div className="rules-flow-step__num">2</div>
                  <div className="rules-flow-step__body">
                    <div className="rules-flow-step__title">手牌建造（Hand Build）</div>
                    <p>
                      每位玩家從牌組抽 <strong>2 張牌，選擇保留 1 張</strong>加入手牌，另 1 張洗回牌組底部。
                      <br/>
                      <em>例外：</em>3 人局第 1 回合改為抽 3 張保留 2 張。
                      <br/>
                      每位玩家也持有固定的 2 張起始牌（Hunt + Ready）。
                    </p>
                  </div>
                </div>

                <div className="rules-flow-step">
                  <div className="rules-flow-step__num">3</div>
                  <div className="rules-flow-step__body">
                    <div className="rules-flow-step__title">規劃階段（Planning Phase）</div>
                    <p>
                      各玩家輪流將手牌<strong>部署</strong>至地點，直到用完所有部署次數或手牌耗盡。
                      部署次數依回合增加：
                    </p>
                    <table className="rules-table">
                      <thead>
                        <tr><th>人數</th><th>第 1 回合</th><th>第 2 回合</th><th>第 3 回合</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>3 人局</td><td>3 次</td><td>4 次</td><td>5 次</td></tr>
                        <tr><td>4–6 人局</td><td>2 次</td><td>3 次</td><td>4 次</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rules-flow-step">
                  <div className="rules-flow-step__num">4</div>
                  <div className="rules-flow-step__body">
                    <div className="rules-flow-step__title">撤退階段（Withdraw Phase）</div>
                    <p>
                      所有玩家<strong>同時秘密決定</strong>在每個有部署牌的地點是否撤退。
                      選擇撤退的玩家將取回部署牌上的所有血液代幣，但不參與該地點的結算。
                    </p>
                  </div>
                </div>

                <div className="rules-flow-step">
                  <div className="rules-flow-step__num">5</div>
                  <div className="rules-flow-step__body">
                    <div className="rules-flow-step__title">結算階段（Revelation Phase）</div>
                    <p>所有地點同時結算，依照固定步驟揭開結果（詳見下方「結算詳解」）。</p>
                  </div>
                </div>

              </div>
            </section>

            {/* ─── 部署規則 ─────────────────────────── */}
            <section id="rules-deploy" className="rules-section">
              <h2>部署規則</h2>

              <h3>基本部署</h3>
              <p>
                選擇一張手牌，選擇目標地點，選擇是否<strong>面朝下</strong>，以及要附加幾個<strong>血液代幣</strong>（0–3 個）。
                部署後該牌從手牌中移除，血液代幣從資源池扣除。
              </p>

              <div className="rules-item-list">
                <div className="rules-item">
                  <div className="rules-item__label">面朝下部署</div>
                  <div className="rules-item__desc">
                    花費 <strong>1 血液</strong>可將牌面朝下部署，對手無法得知是哪張牌。
                    揭牌階段自動翻面公開。
                    <br/>
                    <em>諾斯費拉圖氏族：面朝下部署免費。</em>
                  </div>
                </div>
                <div className="rules-item">
                  <div className="rules-item__label">血液代幣</div>
                  <div className="rules-item__desc">
                    可在部署時附加最多 <strong>3 個血液代幣</strong>到牌上（每個花費 1 血液）。
                    每個血液代幣為該牌的有效戰力 +1。
                    部分卡牌效果會進一步放大或奪取血液代幣。
                  </div>
                </div>
                <div className="rules-item">
                  <div className="rules-item__label">結束部署</div>
                  <div className="rules-item__desc">
                    玩家可隨時宣告結束本回合部署，不必用完所有次數。
                  </div>
                </div>
              </div>

              <h3>同盟牌的汲取</h3>
              <p>
                在規劃階段，玩家可以選擇<strong>汲取</strong>（Drain）自己的同盟牌，立即獲得該牌的 drainBlood 血液。
                汲取後該同盟牌永久標記為「已汲取」，不再每回合提供 feedBlood。
              </p>
              <div className="rules-callout rules-callout--warn">
                <span className="rules-callout__icon">⚠️</span>
                <span>
                  <strong>汲取吸血鬼盟友：</strong>汲取類型為「吸血鬼」的同盟牌會獲得 1 個<strong>弒親代幣</strong>。
                  積累 3 個弒親代幣的玩家將被淘汰。
                </span>
              </div>
            </section>

            {/* ─── 結算詳解 ─────────────────────────── */}
            <section id="rules-resolve" className="rules-section">
              <h2>結算詳解</h2>
              <p>結算階段依序執行以下 6 個步驟，你可以在結算介面使用 ‹ › 按鈕逐步觀看：</p>

              <div className="rules-resolve-steps">

                <div className="rules-resolve-step rules-resolve-step--withdraw">
                  <div className="rules-resolve-step__label">撤退</div>
                  <div className="rules-resolve-step__desc">
                    選擇撤退的牌從該地點移除，血液代幣歸還給玩家的資源池。
                    撤退的牌不參與後續任何效果。
                  </div>
                </div>

                <div className="rules-resolve-step rules-resolve-step--reveal">
                  <div className="rules-resolve-step__label">揭牌</div>
                  <div className="rules-resolve-step__desc">
                    所有面朝下的牌翻面公開。持續效果（Passive）類型的牌若面朝下則無效。
                  </div>
                </div>

                <div className="rules-resolve-step rules-resolve-step--prepare">
                  <div className="rules-resolve-step__label">準備</div>
                  <div className="rules-resolve-step__desc">
                    所有<span className="rules-tag rules-tag--prepare">準備牌</span>的效果觸發。
                    通常包含偷取血液、操控血液代幣、強制移動牌等。
                    準備效果<strong>在戰力計算前</strong>執行。
                  </div>
                </div>

                <div className="rules-resolve-step rules-resolve-step--conflict">
                  <div className="rules-resolve-step__label">衝突</div>
                  <div className="rules-resolve-step__desc">
                    <strong>計算每張牌的有效戰力</strong>（印刷戰力 + 血液代幣 ± 持續效果）。
                    接著<span className="rules-tag rules-tag--conflict">衝突牌</span>效果觸發，可進一步修改戰力。
                    各玩家在此地點所有牌的戰力加總，得分最高者為勝者。
                  </div>
                </div>

                <div className="rules-resolve-step rules-resolve-step--aftermath">
                  <div className="rules-resolve-step__label">後果</div>
                  <div className="rules-resolve-step__desc">
                    勝負決定後，<span className="rules-tag rules-tag--aftermath">後果牌</span>效果觸發。
                    通常是狩獵、偷血、移動牌等效果。
                  </div>
                </div>

                <div className="rules-resolve-step rules-resolve-step--complete">
                  <div className="rules-resolve-step__label">完成</div>
                  <div className="rules-resolve-step__desc">
                    <strong>勝者獲得影響力</strong>，可能還有第二名的少量影響力。
                    勝者取得該地點的<strong>同盟牌</strong>。
                    若此地點是王子的避難所，勝者取得<strong>野心代幣</strong>（先手權）。
                  </div>
                </div>

              </div>

              <h3>影響力獎勵</h3>
              <table className="rules-table">
                <thead>
                  <tr>
                    <th>地點</th>
                    <th>第 1 回合（1st/2nd）</th>
                    <th>第 2 回合（1st/2nd）</th>
                    <th>第 3 回合（1st/2nd）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>The Rack / The Asylum</td><td>+1 / —</td><td>+1 / +1</td><td>+2 / +1</td></tr>
                  <tr><td>Club Zombie</td><td>+1 / —</td><td>+2 / +1</td><td>+2 / +1</td></tr>
                  <tr><td>Prince's Haven ★</td><td>+3 / —</td><td>+3 / +1</td><td>+4 / +1</td></tr>
                </tbody>
              </table>

              <h3>平局規則</h3>
              <p>
                若最高得分的玩家之間完全平手（且沒有一方是野心代幣持有者），
                則<strong>無人</strong>獲得影響力與同盟牌。若只有一名平手方持有野心代幣，
                則排名靠後（另一位不持有野心代幣者）勝出。
              </p>
            </section>

            {/* ─── 牌型說明 ─────────────────────────── */}
            <section id="rules-cards" className="rules-section">
              <h2>牌型說明</h2>
              <p>每張牌有一個<strong>類型</strong>，決定效果在哪個結算步驟觸發。所有牌都有<strong>印刷戰力值</strong>，面朝上時才計入戰力（除 MA07 特例）。</p>

              <div className="rules-card-types">

                <div className="rules-card-type">
                  <div className="rules-card-type__badge rules-card-type__badge--preparation">準備牌</div>
                  <div className="rules-card-type__desc">
                    在<strong>準備步驟</strong>觸發效果（戰力計算前）。
                    通常用於搶奪資源、操控血液代幣、或改變戰場局面。
                    <br/><em>範例：展示武力（從每個對手各偷 1 血液）、魅力（迫使對手棄置血液代幣）</em>
                  </div>
                </div>

                <div className="rules-card-type">
                  <div className="rules-card-type__badge rules-card-type__badge--conflict">衝突牌</div>
                  <div className="rules-card-type__desc">
                    在<strong>衝突步驟</strong>觸發效果，直接影響此地點的戰力計算。
                    <br/><em>範例：外交手腕（使最高戰力牌歸零）、隨從群（依同盟牌數增加戰力）</em>
                  </div>
                </div>

                <div className="rules-card-type">
                  <div className="rules-card-type__badge rules-card-type__badge--aftermath">後果牌</div>
                  <div className="rules-card-type__desc">
                    在<strong>後果步驟</strong>觸發效果，勝負確定後才執行。
                    <br/><em>範例：狩獵（從每個對手各偷 1 血液）、融入大地（回收所有部署血液）</em>
                  </div>
                </div>

                <div className="rules-card-type">
                  <div className="rules-card-type__badge rules-card-type__badge--passive">持續牌</div>
                  <div className="rules-card-type__desc">
                    <strong>持續效果</strong>，通常在規劃階段或整個結算過程中觸發。
                    持續牌面朝下時無效。
                    <br/><em>範例：暗中之眼（強制對手在此地點面朝下出牌）、徘徊狩獵（對手出牌時獲得血液）</em>
                  </div>
                </div>

              </div>
            </section>

            {/* ─── 氏族介紹 ─────────────────────────── */}
            <section id="rules-clans" className="rules-section">
              <h2>氏族介紹</h2>
              <p>共有 <strong>7 個氏族</strong>可選，每氏族都有獨特的牌組與戰略風格，且每人只能選用唯一氏族。</p>

              <div className="rules-clan-grid">

                <div className="rules-clan rules-clan--brujah">
                  <div className="rules-clan__name">布魯哈 Brujah</div>
                  <div className="rules-clan__arch">全攻快攻</div>
                  <div className="rules-clan__desc">
                    以龐大的戰力和血液壓制對手著稱。擅長一次性的大量攻擊，透過多張牌搭配（龐克幫眾）、
                    強力的後果效果（該隱之拳、打倒體制）讓對手血量崩潰。
                    玩法激進，需要積極搶奪地點。
                  </div>
                </div>

                <div className="rules-clan rules-clan--nosferatu">
                  <div className="rules-clan__name">諾斯費拉圖 Nosferatu</div>
                  <div className="rules-clan__arch">情報控制</div>
                  <div className="rules-clan__desc">
                    面朝下部署<strong>免費</strong>，擅長隱藏資訊與控制資訊。
                    暗中之眼可強制對手面朝下，陰影披風可重定向撤退牌。
                    難以預測，對手很難知道你在打什麼。
                  </div>
                </div>

                <div className="rules-clan rules-clan--toreador">
                  <div className="rules-clan__name">托雷亞多爾 Toreador</div>
                  <div className="rules-clan__arch">同盟操控</div>
                  <div className="rules-clan__desc">
                    以同盟牌數量作為戰力來源（隨從群、魅惑）。
                    透過備戰抽取受害者牌、召喚再抽，快速累積龐大的同盟牌組。
                    後期爆發力極強，但前期需要時間建設。
                  </div>
                </div>

                <div className="rules-clan rules-clan--tremere">
                  <div className="rules-clan__name">特雷梅爾 Tremere</div>
                  <div className="rules-clan__arch">血液魔法爆發</div>
                  <div className="rules-clan__desc">
                    以「消耗血液換取強大效果」為核心。飢餓中的專注（血量越低戰力越高）、
                    古老文物（消耗半數血液獲得高戰力）等帶來驚人的瞬間爆發力，但代價高昂。
                  </div>
                </div>

                <div className="rules-clan rules-clan--malkavian">
                  <div className="rules-clan__name">馬爾卡維安 Malkavian</div>
                  <div className="rules-clan__arch">混亂干擾</div>
                  <div className="rules-clan__desc">
                    製造混亂、干擾對手計畫。催眠操控可強制部署對手手牌、
                    瘋狂網絡可一次打出全部手牌，混沌可偷取血液後回收。
                    節奏感極強，考驗臨機應變能力。
                  </div>
                </div>

                <div className="rules-clan rules-clan--gangrel">
                  <div className="rules-clan__name">剛格烈 Gangrel</div>
                  <div className="rules-clan__arch">血液操控耐久</div>
                  <div className="rules-clan__desc">
                    以血液代幣的操控和奪取為主。野性武器（血液代幣戰力 ×2）、
                    狼群之力（搶奪對手部署血液）、無懼（資源池與部署血液互換 +2）。
                    擅長在長期的消耗戰中佔優。
                  </div>
                </div>

                <div className="rules-clan rules-clan--ventrue">
                  <div className="rules-clan__name">凡崔 Ventrue</div>
                  <div className="rules-clan__arch">棋盤控制</div>
                  <div className="rules-clan__desc">
                    以控制整個棋盤的佈局著稱。主謀計畫（對未在此地點出牌的對手扣影響力）、
                    外交手腕（使最高戰力牌歸零）、宵禁令（強迫對手選擇）。
                    玩法複雜，極具威懾力。
                  </div>
                </div>

              </div>
            </section>

            {/* ─── 同盟牌 ─────────────────────────── */}
            <section id="rules-alliance" className="rules-section">
              <h2>同盟牌</h2>
              <p>
                每位玩家在遊戲開始時持有 <strong>1 張「平民」（Kine）</strong>作為初始同盟牌。
                每回合提供 1 血液，汲取可得 2 血液。
              </p>

              <h3>同盟牌屬性</h3>
              <div className="rules-item-list">
                <div className="rules-item">
                  <div className="rules-item__label">feedBlood（養血）</div>
                  <div className="rules-item__desc">每回合飼育階段自動提供的血液量。</div>
                </div>
                <div className="rules-item">
                  <div className="rules-item__label">drainBlood（汲取血液）</div>
                  <div className="rules-item__desc">汲取此盟友時獲得的血液量（一次性）。</div>
                </div>
                <div className="rules-item">
                  <div className="rules-item__label">influence（影響力）</div>
                  <div className="rules-item__desc">部分同盟牌可提供額外影響力加成（持有即計算）。</div>
                </div>
              </div>

              <h3>同盟牌的類型</h3>
              <div className="rules-resource-grid">
                <div className="rules-resource-card">
                  <div className="rules-resource-card__icon">🧑</div>
                  <div className="rules-resource-card__name">人類（Human）</div>
                  <div className="rules-resource-card__desc">
                    汲取時不會產生弒親代幣。是主要的血液來源。
                  </div>
                </div>
                <div className="rules-resource-card rules-resource-card--warn">
                  <div className="rules-resource-card__icon">🧛</div>
                  <div className="rules-resource-card__name">吸血鬼（Vampire）</div>
                  <div className="rules-resource-card__desc">
                    汲取時提供大量血液，但同時獲得 1 個<strong>弒親代幣</strong>。
                    謹慎使用。
                  </div>
                </div>
              </div>

              <h3>獲得同盟牌</h3>
              <p>
                每個地點在回合開始時放置 1 張同盟牌。贏得該地點的玩家可獲得此牌加入同盟。
                部分後果牌（如 Toreador 的「召喚」）可額外從牌堆抽取受害者牌。
              </p>
            </section>

            {/* ─── 特殊規則 ─────────────────────────── */}
            <section id="rules-special" className="rules-section">
              <h2>特殊規則</h2>

              <h3>🔴 狂暴（Frenzy）</h3>
              <p>
                當玩家的血液降至 <strong>0</strong> 時觸發狂暴。玩家必須從同盟牌中移除（汲取）一張牌，
                若汲取的是吸血鬼同盟則額外獲得 1 個弒親代幣。
                若沒有任何同盟牌可移除，玩家可能被淘汰（按遊戲版本規定）。
              </p>

              <h3>🎖 野心代幣（Ambition Token）</h3>
              <p>
                遊戲開始時隨機分配給一名玩家。野心代幣持有者代表<strong>「先手玩家」</strong>，
                在所有地點的決策中擁有優先撤退資訊。
              </p>
              <div className="rules-callout rules-callout--warn">
                <span className="rules-callout__icon">⚠️</span>
                <span>
                  <strong>平局懲罰：</strong>在任何地點的戰力完全平局時，野心代幣持有者視為<em>輸者</em>（排名靠後）。
                  這防止了先手優勢過強。
                </span>
              </div>
              <p>
                贏得<strong>王子的避難所（Prince's Haven）</strong>的玩家獲得野心代幣，成為下回合的先手玩家。
              </p>

              <h3>☠️ 弒親代幣（Diablerie）</h3>
              <p>
                汲取吸血鬼類型的同盟牌時獲得。累積至 <strong>3 個</strong>時玩家將被淘汰，
                視為觸犯了吸血鬼社會的最高禁忌。謹慎選擇是否汲取吸血鬼盟友。
              </p>

              <h3>👁 諾斯費拉圖特權</h3>
              <p>
                諾斯費拉圖氏族可以<strong>免費</strong>面朝下部署牌（其他氏族需花費 1 血液）。
                這讓他們在資訊控制上擁有顯著優勢。
              </p>
            </section>

            {/* ─── 勝利條件 ─────────────────────────── */}
            <section id="rules-win" className="rules-section">
              <h2>勝利條件</h2>
              <div className="rules-callout">
                <span className="rules-callout__icon">🏆</span>
                <span>
                  3 回合結束後，<strong>影響力最高</strong>的玩家獲勝。
                  若多名玩家影響力相同，則<strong>血液最多</strong>者獲勝。
                </span>
              </div>

              <h3>影響力的來源</h3>
              <ul className="rules-list">
                <li>贏得地點爭奪（第 1 名獲得主要影響力，第 2 名有時也可獲得少量）</li>
                <li>部分卡牌效果（如 Ventrue 的「暴君凝視」可奪取對手影響力）</li>
                <li>部分同盟牌（持有特定同盟牌可提供持續影響力加成）</li>
              </ul>

              <h3>策略建議</h3>
              <ul className="rules-list">
                <li>不必每個地點都爭，專注你能贏的地點，集中資源反而更有效率</li>
                <li>適當撤退保存血液，讓你在下回合有更多部署資源</li>
                <li>注意對手的卡牌類型——面朝下的牌很可能是衝突牌或準備牌</li>
                <li>王子的避難所影響力最高，但競爭也最激烈，衡量投入是否值得</li>
                <li>同盟牌是長期勝利的關鍵，累積高 feedBlood 的同盟可在後期穩定勝出</li>
              </ul>
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
