import { useState, useEffect, useCallback, useMemo } from 'react'
import type { GameStateClient, ConflictResult, ClanId } from '@kindred/shared'
import socket from './socket'
import { cardName } from './cardNames'
import CardImage from './CardImage'
import { CARD_DEFS, TYPE_LABEL_ZH } from './cardDefs'
import './RevelationScreen.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

const STEPS = ['withdraw', 'reveal', 'prepare', 'conflict', 'aftermath', 'complete'] as const
type ResolutionStep = typeof STEPS[number]

const STEP_LABELS: Record<ResolutionStep, string> = {
  withdraw: '撤退',
  reveal:   '揭牌',
  prepare:  '準備',
  conflict: '衝突',
  aftermath:'後果',
  complete: '完成',
}

// 每個步驟對應要高亮的卡牌類型
const STEP_ACTIVE_TYPE: Partial<Record<ResolutionStep, string>> = {
  prepare:  'preparation',
  conflict: 'conflict',
  aftermath:'aftermath',
}

// 每個步驟的說明字幕
const STEP_DESCRIPTIONS: Record<ResolutionStep, string> = {
  withdraw: '玩家選擇是否在最後關頭撤退',
  reveal:   '所有面朝下的牌同時翻開',
  prepare:  '觸發準備型卡牌效果',
  conflict: '計算各地點戰力，決定勝負',
  aftermath:'觸發後果型卡牌效果',
  complete: '分配影響力，結算本回合',
}

const CLAN_LABEL: Record<string, { zh: string; color: string }> = {
  brujah:   { zh: '布魯哈',    color: '#c04040' },
  nosferatu:{ zh: '諾斯費拉圖', color: '#4a8a4a' },
  toreador: { zh: '托雷亞多爾', color: '#2aa0a0' },
  tremere:  { zh: '特雷梅爾',  color: '#9060d0' },
  malkavian:{ zh: '馬爾卡維安', color: '#c040a0' },
  gangrel:  { zh: '剛格烈',    color: '#b08020' },
  ventrue:  { zh: '凡崔',      color: '#4060c0' },
}

// 根據事件文字內容決定顏色 class
function eventClass(text: string): string {
  if (/血液|💧|失去.*血|血.*失去|吸取|流失/.test(text)) return 'event--blood'
  if (/影響力|獲得.*影|影\b/.test(text))               return 'event--influence'
  if (/撤退/.test(text))                               return 'event--withdraw'
  if (/戰力|⚔/.test(text))                            return 'event--power'
  return ''
}

type SlotPopup = { cardId: string; ownerName: string }

function ResultCard({ result, gameState, myId, showStep, onSlotClick }: {
  result: ConflictResult
  gameState: GameStateClient
  myId: string
  showStep: ResolutionStep
  onSlotClick: (p: SlotPopup) => void
}) {
  const loc = gameState.locations.find(l => l.id === result.locationId)
  const slots = gameState.deployments[result.locationId] ?? []
  const sortedPlayers = Object.entries(result.scores).sort((a, b) => b[1] - a[1])

  const activeType = STEP_ACTIVE_TYPE[showStep] ?? null

  // 取出本步驟的效果事件
  const stepEvents: string[] =
    showStep === 'prepare'   ? (result.stepEvents?.prepare   ?? []) :
    showStep === 'conflict'  ? (result.stepEvents?.conflict  ?? []) :
    showStep === 'aftermath' ? (result.stepEvents?.aftermath ?? []) :
    []

  // conflict 步驟起才顯示戰力
  const showPower = showStep !== 'withdraw' && showStep !== 'reveal' && showStep !== 'prepare'
  // conflict 步驟起才顯示比分列表
  const showScores = showStep === 'conflict' || showStep === 'aftermath' || showStep === 'complete'

  return (
    <div className={`result-card ${result.winner === myId ? 'result-card--winner' : ''} ${showStep === 'complete' ? 'result-card--complete' : ''}`}>

      {/* 地點標題 */}
      <div className="result-card__loc">
        {loc?.name ?? result.locationId}
        {loc?.isPrinces && <span className="result-card__princes">王子之地</span>}
        <span className={`result-card__step result-card__step--${showStep}`}>
          {STEP_LABELS[showStep]}
        </span>
      </div>

      {/* Complete 步驟：勝負 Banner */}
      {showStep === 'complete' && (
        result.tie
          ? <div className="result-card__outcome result-card__outcome--tie">平局 — 無人得分</div>
          : result.winner && (
            <div className={`result-card__outcome ${result.winner === myId ? 'result-card__outcome--me' : ''}`}>
              <span className="result-card__outcome-name">
                {result.winner === myId ? '🏆 你勝出！' : `${gameState.players[result.winner]?.name ?? '?'} 勝出`}
              </span>
              {(result.influenceGained[result.winner] ?? 0) > 0 && (
                <span className="result-card__outcome-inf">
                  +{result.influenceGained[result.winner]} 影響力
                </span>
              )}
            </div>
          )
      )}

      {/* 部署牌列表 */}
      <div className="result-card__slots">
        {slots.map((sl, i) => {
          const owner = gameState.players[sl.playerId]
          const clan = owner?.clan as ClanId | null
          const isFaceDown = sl.faceDown && showStep === 'withdraw'

          const cardType = sl.cardId ? CARD_DEFS[sl.cardId]?.type : null
          // 只在有 activeType 的步驟才高亮
          const isActive = !sl.withdrawn && !isFaceDown && activeType && cardType === activeType
          const isDim    = !sl.withdrawn && !isFaceDown && activeType && cardType !== activeType

          const basePow = (sl.cardId ? CARD_DEFS[sl.cardId]?.power : 0) ?? 0
          const eff = sl.effectivePower ?? 0
          // 若有效戰力與 基礎+血液 不符，代表效果改變了戰力
          const isModified = showPower && sl.effectivePower !== null && eff !== basePow + sl.bloodTokens

          const effectText = !isFaceDown && sl.cardId ? (CARD_DEFS[sl.cardId]?.effect_zh ?? '') : ''
          const clickable  = !isFaceDown && !!sl.cardId
          return (
            <div key={i}
              className={[
                'result-slot',
                sl.playerId === myId   ? 'result-slot--mine'      : '',
                sl.withdrawn           ? 'result-slot--withdrawn'  : '',
                isActive               ? 'result-slot--active'     : '',
                isDim                  ? 'result-slot--dim'        : '',
                clickable              ? 'result-slot--clickable'  : '',
              ].filter(Boolean).join(' ')}
              data-effect={effectText || undefined}
              onClick={clickable ? () => onSlotClick({ cardId: sl.cardId!, ownerName: gameState.players[sl.playerId]?.name ?? '?' }) : undefined}
            >

              <CardImage
                cardId={sl.cardId}
                clan={clan}
                faceDown={isFaceDown}
                className="result-slot__img"
              />

              <div className="result-slot__info">
                <span className="result-slot__owner">{owner?.name ?? '?'}</span>

                <div className="result-slot__card-row">
                  <span className="result-slot__card">
                    {isFaceDown ? '???' : (sl.cardId ? cardName(sl.cardId) : '—')}
                  </span>
                  {!isFaceDown && cardType && cardType !== 'passive' && (
                    <span className={`result-slot__type result-slot__type--${cardType}`}>
                      {cardType === 'preparation' ? '準備' :
                       cardType === 'conflict'    ? '衝突' :
                       cardType === 'aftermath'   ? '後果' : ''}
                    </span>
                  )}
                </div>

                <div className="result-slot__badges">
                  {sl.bloodTokens > 0 && (
                    <span className="result-slot__tokens">💧{sl.bloodTokens}</span>
                  )}
                  {sl.withdrawn && (
                    <span className="result-slot__wd">撤退</span>
                  )}
                  {showPower && !sl.withdrawn && sl.effectivePower !== null && (
                    <span className={`result-slot__power ${isModified ? 'result-slot__power--modified' : ''}`}>
                      ⚔ {eff}
                      {isModified && (
                        <span className="result-slot__power-note">（基{basePow}+💧{sl.bloodTokens}）</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 本步驟效果事件 */}
      {stepEvents.length > 0 && (
        <div className="result-card__events">
          <div className="result-card__events-title">本階段效果</div>
          {stepEvents.map((ev, i) => (
            <div key={i} className={`result-card__event-line ${eventClass(ev)}`}>▸ {ev}</div>
          ))}
        </div>
      )}

      {/* 戰力比分（conflict 步驟起顯示） */}
      {showScores && sortedPlayers.length > 0 && (
        <div className="result-card__scores">
          {sortedPlayers.map(([pid, score], idx) => {
            const player = gameState.players[pid]
            const isWinner = pid === result.winner
            const isSecond = pid === result.second
            const infGain  = result.influenceGained[pid] ?? 0
            return (
              <div key={pid} className={[
                'result-card__row',
                idx === 0        ? 'result-card__row--first' : '',
                pid === myId     ? 'result-card__row--me'    : '',
              ].filter(Boolean).join(' ')}>
                <span className="result-card__rank">#{idx + 1}</span>
                <span className="result-card__pname">{player?.name ?? '?'}</span>
                <span className="result-card__score">⚔ {score}</span>
                {showStep === 'complete' && infGain > 0 && (
                  <span className="result-card__inf">+{infGain}影</span>
                )}
                {showStep === 'complete' && isWinner && <span className="result-card__medal">🏆</span>}
                {showStep === 'complete' && isSecond && !isWinner && (
                  <span className="result-card__medal">🥈</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 全戰場部署總覽（pendingChoice 時顯示） ─────────────────────

function BattlefieldOverview({ gameState, myId, highlightLocId, onSlotClick }: {
  gameState: GameStateClient
  myId: string
  highlightLocId: string
  onSlotClick: (p: SlotPopup) => void
}) {
  return (
    <div className="bf-overview">
      {gameState.locations.map(loc => {
        const slots = (gameState.deployments[loc.id] ?? []).filter(sl => !sl.withdrawn)
        const isHighlight = loc.id === highlightLocId
        return (
          <div key={loc.id} className={`bf-loc ${isHighlight ? 'bf-loc--highlighted' : ''}`}>
            <div className="bf-loc__header">
              <span className="bf-loc__name">{loc.name}</span>
              {loc.isPrinces && <span className="bf-loc__princes">王子之地</span>}
              <span className="bf-loc__inf">
                {loc.influence[gameState.round]?.[0] ?? '?'} / {loc.influence[gameState.round]?.[1] ?? '?'} 影
              </span>
            </div>
            <div className="bf-loc__slots">
              {slots.length === 0 && <span className="bf-loc__empty">無部署</span>}
              {slots.map((sl, i) => {
                const owner  = gameState.players[sl.playerId]
                const clan   = owner?.clan as ClanId | null
                const isMe   = sl.playerId === myId
                const hidden = sl.cardId === null
                const cardDef = sl.cardId ? CARD_DEFS[sl.cardId] : null
                const bfClickable = !hidden && !!sl.cardId
                return (
                  <div key={i}
                    className={`bf-slot ${isMe ? 'bf-slot--mine' : ''} ${bfClickable ? 'bf-slot--clickable' : ''}`}
                    onClick={bfClickable ? () => onSlotClick({ cardId: sl.cardId!, ownerName: owner?.name ?? '?' }) : undefined}
                  >
                    <CardImage
                      cardId={sl.cardId}
                      clan={clan}
                      faceDown={hidden}
                      className="bf-slot__img"
                    />
                    <div className="bf-slot__info">
                      <span className="bf-slot__owner">{owner?.name ?? '?'}{isMe && ' (你)'}</span>
                      <span className="bf-slot__card">{hidden ? '???' : (sl.cardId ? cardName(sl.cardId) : '—')}</span>
                      {!hidden && cardDef && cardDef.type !== 'passive' && (
                        <span className={`bf-slot__type bf-slot__type--${cardDef.type}`}>
                          {cardDef.type === 'preparation' ? '準備' :
                           cardDef.type === 'conflict'    ? '衝突' :
                           cardDef.type === 'aftermath'   ? '後果' : ''}
                        </span>
                      )}
                      {sl.bloodTokens > 0 && <span className="bf-slot__tokens">💧{sl.bloodTokens}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────

export default function RevelationScreen({ myId, gameState }: Props) {
  const results  = gameState.lastConflictResults
  const phase    = gameState.phase
  const waiting  = gameState.waitingFor
  const iHaveConfirmed = !waiting.includes(myId)
  const players  = Object.values(gameState.players).sort((a, b) => b.influence - a.influence)
  const pendingChoice = gameState.myPendingChoice
  const [slotPopup, setSlotPopup] = useState<SlotPopup | null>(null)

  const [currentStep, setCurrentStep] = useState<ResolutionStep>('withdraw')
  const [autoPlay, setAutoPlay] = useState(true)

  const stepIdx = STEPS.indexOf(currentStep)
  const canPrev = stepIdx > 0
  const canNext = stepIdx < STEPS.length - 1

  const nextStep = useCallback(() => {
    setCurrentStep(s => {
      const i = STEPS.indexOf(s)
      return i < STEPS.length - 1 ? STEPS[i + 1] : s
    })
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep(s => {
      const i = STEPS.indexOf(s)
      return i > 0 ? STEPS[i - 1] : s
    })
  }, [])

  // 彙整目前步驟所有地點的效果事件（需先算，autoPlay effect 依賴它）
  const allStepEvents = useMemo(() => {
    if (currentStep === 'prepare')   return results.flatMap(r => r.stepEvents?.prepare   ?? [])
    if (currentStep === 'conflict')  return results.flatMap(r => r.stepEvents?.conflict  ?? [])
    if (currentStep === 'aftermath') return results.flatMap(r => r.stepEvents?.aftermath ?? [])
    return []
  }, [currentStep, results])

  // 進入 REVELATION 時重置步驟並開啟自動播放
  useEffect(() => {
    if (phase === 'REVELATION') {
      setCurrentStep('withdraw')
      setAutoPlay(true)
    }
  }, [phase])

  // 自動播放計時器：有事件的步驟自動暫停，讓玩家閱讀
  useEffect(() => {
    if (!autoPlay || currentStep === 'complete') return
    if (allStepEvents.length > 0) {
      setAutoPlay(false)
      return
    }
    const timer = setTimeout(nextStep, 3000)
    return () => clearTimeout(timer)
  }, [autoPlay, currentStep, nextStep, allStepEvents])

  function confirm() { socket.emit('readyAdvance') }

  function respondChoice(option: string) {
    if (!pendingChoice) return
    socket.emit('respondChoice', { choiceId: pendingChoice.id, option })
  }

  const isReveal   = phase === 'REVELATION'
  const isRoundEnd = phase === 'ROUND_END'

  return (
    <div className={`revelation ${pendingChoice ? 'revelation--has-choice' : ''}`}>

      {/* ── 卡牌詳情 Popup ── */}
      {slotPopup && (() => {
        const def = CARD_DEFS[slotPopup.cardId]
        return (
          <div className="card-popup-overlay" onClick={() => setSlotPopup(null)}>
            <div className="card-popup" onClick={e => e.stopPropagation()}>
              <div className="card-popup__owner">{slotPopup.ownerName} 的牌</div>
              <CardImage cardId={slotPopup.cardId} className="card-popup__img" />
              {def && (
                <div className="card-popup__info">
                  <div className="card-popup__type">{TYPE_LABEL_ZH[def.type] ?? def.type}</div>
                  <div className="card-popup__name">{def.name_zh}</div>
                  <div className="card-popup__power">基礎戰力 {def.power}</div>
                  {def.effect_zh && <div className="card-popup__effect">{def.effect_zh}</div>}
                </div>
              )}
              <button className="btn-ghost card-popup__close" onClick={() => setSlotPopup(null)}>關閉</button>
            </div>
          </div>
        )
      })()}

      {/* ── 待選擇強制 Bar（底部緊湊列） ── */}
      {pendingChoice && (() => {
        const loc = gameState.locations.find(l => l.id === pendingChoice.context.locationId)
        return (
          <div className="choice-bar">
            <span className="choice-bar__loc">📍 {loc?.name ?? pendingChoice.context.locationId}</span>
            <span className="choice-bar__prompt">{pendingChoice.prompt_zh}</span>
            <div className="choice-bar__options">
              {pendingChoice.options.map(opt => (
                <button
                  key={opt.key}
                  className="btn-primary choice-bar__btn"
                  onClick={() => respondChoice(opt.key)}
                >
                  {opt.label_zh}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── 標題列 ── */}
      <div className="revelation__header">
        <div className="revelation__header-top">
          <div className="revelation__title">
            {isReveal ? '結算階段' : `第 ${gameState.round} 回合結束`}
          </div>
          <div className="revelation__subtitle">
            {isReveal
              ? `第 ${gameState.round} 回合`
              : gameState.round < 3
                ? `第 ${gameState.round + 1} 回合即將開始`
                : '最終回合'}
          </div>
        </div>

        {/* 步驟進度列（僅結算階段） */}
        {isReveal && (
          <div className="revelation__step-bar">
            <button
              className="revelation__step-nav"
              onClick={prevStep}
              disabled={!canPrev}
              title="上一步"
            >‹</button>

            <div className="revelation__steps">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  className={[
                    'revelation__step-dot',
                    s === currentStep    ? 'revelation__step-dot--active' : '',
                    i < stepIdx          ? 'revelation__step-dot--done'   : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => { setCurrentStep(s); setAutoPlay(false) }}
                >
                  {STEP_LABELS[s]}
                </button>
              ))}
            </div>

            <button
              className="revelation__step-nav"
              onClick={() => { nextStep(); setAutoPlay(false) }}
              disabled={!canNext}
              title="下一步"
            >›</button>

            <button
              className={`revelation__autoplay-btn ${autoPlay ? 'revelation__autoplay-btn--on' : ''}`}
              onClick={() => setAutoPlay(v => !v)}
              title={autoPlay ? '暫停自動播放' : '開始自動播放'}
            >
              {autoPlay ? '⏸' : '▶'}
            </button>
          </div>
        )}

        {/* 步驟說明字幕 + autoPlay 進度條 */}
        {isReveal && (
          <div className="revelation__step-meta">
            <span className="revelation__step-desc">{STEP_DESCRIPTIONS[currentStep]}</span>
            {allStepEvents.length > 0 && (
              <span className="revelation__step-hint">── 有效果，已暫停</span>
            )}
            {autoPlay && allStepEvents.length === 0 && currentStep !== 'complete' && (
              <div className="revelation__progress-bar">
                <div key={`${currentStep}-progress`} className="revelation__progress-fill" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 主體 ── */}
      <div className="revelation__body">

        {/* 待選擇時：顯示全戰場部署總覽；結算後：顯示結算卡片 */}
        {pendingChoice ? (
          <BattlefieldOverview
            gameState={gameState}
            myId={myId}
            highlightLocId={pendingChoice.context.locationId}
            onSlotClick={setSlotPopup}
          />
        ) : (
          <div className="revelation__results">
            {results.length > 0
              ? results.map(r => (
                  <ResultCard
                    key={r.locationId}
                    result={r}
                    gameState={gameState}
                    myId={myId}
                    showStep={currentStep}
                    onSlotClick={setSlotPopup}
                  />
                ))
              : <div className="revelation__empty">本回合無人部署</div>
            }
          </div>
        )}

        {/* 側邊欄 */}
        <div className="revelation__sidebar">

          {/* 本步驟效果摘要 */}
          {isReveal && allStepEvents.length > 0 && (
            <div className="revelation__event-log">
              <div className="revelation__event-log-title">
                {STEP_LABELS[currentStep]}階段 效果摘要
              </div>
              {allStepEvents.map((ev, i) => (
                <div key={i} className={`revelation__event-line ${eventClass(ev)}`}>▸ {ev}</div>
              ))}
            </div>
          )}

          {/* 目前積分 */}
          <div className="revelation__standings">
            <div className="revelation__standings-title">目前積分</div>
            {players.map((p, i) => {
              const clanInfo = p.clan ? CLAN_LABEL[p.clan] : null
              return (
                <div
                  key={p.id}
                  className={`revelation__standing-row ${p.id === myId ? 'revelation__standing-row--me' : ''}`}
                >
                  <span className="revelation__standing-rank">#{i + 1}</span>
                  <span className="revelation__standing-name">
                    {clanInfo && (
                      <span
                        className="revelation__standing-clan"
                        style={{ color: clanInfo.color }}
                        title={clanInfo.zh}
                      >
                        {clanInfo.zh}
                      </span>
                    )}
                    {p.name}{p.id === myId && ' (你)'}
                  </span>
                  <span className="revelation__standing-inf">{p.influence} 影</span>
                  <span className="revelation__standing-blood">{p.blood} 血</span>
                </div>
              )
            })}
          </div>

          {/* 確認按鈕 */}
          <div className="revelation__confirm-area">
            {!iHaveConfirmed ? (
              <button className="btn-primary revelation__confirm-btn" onClick={confirm}>
                {isRoundEnd ? '繼續下一回合' : '確認，繼續'}
              </button>
            ) : (
              <div className="revelation__confirmed">✓ 已確認</div>
            )}

            {waiting.length > 0 && (
              <div className="revelation__waiting">
                等待：{waiting.map(id => gameState.players[id]?.name ?? '...').join('、')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
