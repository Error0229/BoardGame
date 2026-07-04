import { useEffect, useRef, useState } from 'react'
import type { GameStateClient } from '@kindred/shared'
import socket from './socket'
import LobbyScreen from './LobbyScreen'
import ClanSelectScreen from './ClanSelectScreen'
import HandBuildScreen from './HandBuildScreen'
import PlanningScreen from './PlanningScreen'
import WithdrawScreen from './WithdrawScreen'
import RevelationScreen from './RevelationScreen'
import GameOverScreen from './GameOverScreen'
import CardLibrary from './CardLibrary'
import RulesModal from './RulesModal'
import PlayerHUD from './PlayerHUD'
import PhaseBanner, { PHASE_INFO } from './PhaseBanner'
import { dlog } from './debug'
import './App.css'

const SESSION_KEY = 'kindred_session'

interface SavedSession {
  playerId: string
  roomCode: string
  token: string
}

function loadSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as SavedSession : null
  } catch { return null }
}

// ── 席位分頁鎖 ─────────────────────────────────────────────
// 「複製分頁」會連 sessionStorage 一起複製,兩個分頁就會搶同一個席位。
// 用 BroadcastChannel 讓持有席位的分頁回應詢問;複製出來的分頁偵測到
// 席位已被佔用,就放棄憑證、當成全新分頁(顯示名字輸入),多開測試才不會打架。

let seatChannel: BroadcastChannel | null = null

/** 宣告本分頁持有此席位,回應其他分頁的詢問 */
function holdSeat(playerId: string) {
  if (typeof BroadcastChannel === 'undefined') return
  if (seatChannel) seatChannel.close()
  seatChannel = new BroadcastChannel(`kindred-seat-${playerId}`)
  seatChannel.onmessage = (e) => {
    if (e.data === 'ping') seatChannel?.postMessage('pong')
  }
}

/** 詢問是否已有其他分頁持有此席位(250ms 內無人回應視為可用) */
function seatIsFree(playerId: string): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(true)
  return new Promise(resolve => {
    const ch = new BroadcastChannel(`kindred-seat-${playerId}`)
    const timer = setTimeout(() => { ch.close(); resolve(true) }, 250)
    ch.onmessage = (e) => {
      if (e.data === 'pong') { clearTimeout(timer); ch.close(); resolve(false) }
    }
    ch.postMessage('ping')
  })
}

export default function App() {
  const [myId, setMyId] = useState('')
  const [gameState, setGameState] = useState<GameStateClient | null>(null)
  const [connected, setConnected] = useState(false)
  const [wasConnected, setWasConnected] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    const handleConnect = () => {
      dlog('conn', 'connected, socket.id =', socket.id)
      setConnected(true)
      setWasConnected(true)
      // 有保存的席位憑證(頁面重整/斷線重連)→ 先確認沒有別的分頁持有,再歸位
      const saved = loadSession()
      if (saved) {
        dlog('conn', 'found saved session, checking seat lock…', saved.playerId)
        seatIsFree(saved.playerId).then(free => {
          if (free) {
            dlog('conn', 'seat free → rejoinRoom', saved.roomCode, saved.playerId)
            setMyId(saved.playerId)
            socket.emit('rejoinRoom', saved)
          } else {
            // 複製分頁:放棄複製來的憑證,當成全新分頁
            dlog('conn', 'seat held by another tab → treating as fresh tab')
            try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
            setMyId(socket.id ?? '')
          }
        })
      } else {
        setMyId(socket.id ?? '')
      }
    }
    socket.on('connect', handleConnect)
    // socket 在模組載入時就開始連線,可能比 React 掛載更快完成而錯過 connect 事件
    if (socket.connected) handleConnect()
    socket.on('disconnect', () => { dlog('conn', 'disconnected'); setConnected(false) })
    socket.on('gameState', (s) => setGameState(s))
    // 席位憑證:入房 / 重連成功時發放,存 sessionStorage(分頁各自獨立)並鎖定席位
    socket.on('session', (payload) => {
      setMyId(payload.playerId)
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload)) } catch { /* ignore */ }
      holdSeat(payload.playerId)
    })
    socket.on('rejoinFailed', () => {
      try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
      setMyId(socket.id ?? '')
      setGameState(null)
      setErrorMsg('原本的對局已無法加入')
      setTimeout(() => setErrorMsg(''), 3000)
    })
    socket.on('error', (msg) => {
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(''), 3000)
    })
    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('gameState')
      socket.off('session')
      socket.off('rejoinFailed')
      socket.off('error')
    }
  }, [])

  const phase = gameState?.phase ?? null

  // 階段轉換 log
  const prevPhaseRef = useRef<string | null>(null)
  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      dlog('phase', `${prevPhaseRef.current ?? '(init)'} → ${phase}`, 'round', gameState?.round)
      prevPhaseRef.current = phase
    }
  }, [phase, gameState?.round])

  // 判斷目前是否需要玩家行動
  const needsAction = (() => {
    if (!gameState || !myId) return false
    const w = gameState.waitingFor
    const actionPhases = ['PLANNING', 'WITHDRAW', 'HAND_BUILD', 'REVELATION', 'ROUND_END']
    return actionPhases.includes(phase ?? '') && w.includes(myId)
  })()

  function renderScreen() {
    if (!gameState) return <LobbyScreen myId={myId} gameState={null} onError={setErrorMsg} />

    switch (phase) {
      case 'LOBBY':
        return <LobbyScreen myId={myId} gameState={gameState} onError={setErrorMsg} />
      case 'CLAN_SELECT':
        return <ClanSelectScreen myId={myId} gameState={gameState} />
      case 'HAND_BUILD':
        return <HandBuildScreen myId={myId} gameState={gameState} />
      case 'PLANNING':
        return <PlanningScreen myId={myId} gameState={gameState} />
      case 'WITHDRAW':
        return <WithdrawScreen myId={myId} gameState={gameState} />
      case 'REVELATION':
      case 'ROUND_END':
        return <RevelationScreen myId={myId} gameState={gameState} />
      case 'GAME_OVER':
        return <GameOverScreen myId={myId} gameState={gameState} />
      default:
        return <div className="app-placeholder"><div className="app-placeholder__phase">{phase}</div></div>
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__title">Kindred: Blood &amp; Betrayal</div>
        <div className="app-header__right">
          {gameState && !['LOBBY', 'GAME_OVER'].includes(phase ?? '') && (
            <span className="app-header__round">
              第 {gameState.round} 回合
              {phase && PHASE_INFO[phase] && (
                <span className="app-header__phase"> · {PHASE_INFO[phase]!.title}</span>
              )}
            </span>
          )}
          {needsAction && (
            <span className="app-header__action-badge">輪到你了</span>
          )}
          <button className="app-header__icon-btn" onClick={() => setShowLibrary(true)} title="卡牌圖鑑">
            📖
          </button>
          <button className="app-header__icon-btn" onClick={() => setShowRules(true)} title="遊戲規則">
            ?
          </button>
          <div className={`app-header__conn ${connected ? 'app-header__conn--on' : ''}`}>
            {connected ? '● 已連線' : '○ 連線中…'}
          </div>
        </div>
      </header>

      {gameState && !['LOBBY', 'GAME_OVER'].includes(phase ?? '') && (
        <PlayerHUD myId={myId} gameState={gameState} />
      )}

      <main className="app-main">
        {renderScreen()}
      </main>

      <PhaseBanner phase={phase} round={gameState?.round ?? 0} />

      {!connected && (
        <div className="app-disconnect-overlay">
          <div className="app-disconnect-box">
            <div className="app-disconnect-icon">⚡</div>
            <div className="app-disconnect-title">{wasConnected ? '連線中斷' : '連線中…'}</div>
            <div className="app-disconnect-msg">
              {wasConnected
                ? 'Socket.io 正在自動重連，請稍候…遊戲狀態將在重連後恢復。'
                : '正在連接伺服器…'}
            </div>
          </div>
        </div>
      )}

      {errorMsg && <div className="app-error">{errorMsg}</div>}

      {showLibrary && <CardLibrary onClose={() => setShowLibrary(false)} />}
      {showRules   && <RulesModal  onClose={() => setShowRules(false)} />}
    </div>
  )
}
