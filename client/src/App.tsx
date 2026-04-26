import { useEffect, useState } from 'react'
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
import './App.css'

export default function App() {
  const [myId, setMyId] = useState('')
  const [gameState, setGameState] = useState<GameStateClient | null>(null)
  const [connected, setConnected] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true)
      setMyId(socket.id ?? '')
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('gameState', (s) => setGameState(s))
    socket.on('error', (msg) => {
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(''), 3000)
    })
    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('gameState')
      socket.off('error')
    }
  }, [])

  const phase = gameState?.phase ?? null

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
            <span className="app-header__round">第 {gameState.round + 1} 回合</span>
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
        {!connected ? (
          <div className="app-connecting">連線中…</div>
        ) : (
          renderScreen()
        )}
      </main>

      {errorMsg && <div className="app-error">{errorMsg}</div>}

      {showLibrary && <CardLibrary onClose={() => setShowLibrary(false)} />}
      {showRules   && <RulesModal  onClose={() => setShowRules(false)} />}
    </div>
  )
}
