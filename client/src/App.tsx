import { useEffect, useState } from 'react'
import type { GameStateClient } from '@kindred/shared'
import socket from './socket'

export default function App() {
  const [gameState, setGameState] = useState<GameStateClient | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('gameState', (s) => setGameState(s))
    socket.on('error', (msg) => console.error('[server]', msg))

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('gameState')
      socket.off('error')
    }
  }, [])

  if (!connected) return <div style={{ color: '#c9a227', padding: 40 }}>連線中...</div>

  return (
    <div>
      <h1>Kindred: Blood &amp; Betrayal</h1>
      <pre style={{ fontSize: 12, color: '#aaa' }}>
        Phase: {gameState?.phase ?? '—'}
      </pre>
    </div>
  )
}
