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
import './App.css'

export default function App() {
  const [myId, setMyId] = useState('')
  const [gameState, setGameState] = useState<GameStateClient | null>(null)
  const [connected, setConnected] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

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
          <div className={`app-header__conn ${connected ? 'app-header__conn--on' : ''}`}>
            {connected ? '● 已連線' : '○ 連線中…'}
          </div>
        </div>
      </header>

      <main className="app-main">
        {!connected ? (
          <div className="app-connecting">連線中…</div>
        ) : (
          renderScreen()
        )}
      </main>

      {errorMsg && <div className="app-error">{errorMsg}</div>}
    </div>
  )
}
