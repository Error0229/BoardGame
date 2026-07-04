import { io, Socket } from 'socket.io-client'
import type { ClientToServer, ServerToClient, GameStateClient } from '@kindred/shared'
import { dlog, debugEnabled } from './debug'

const socket: Socket<ServerToClient, ClientToServer> =
  (typeof window !== 'undefined' && (window as any).__mockSocket)
    ? ((window as any).__mockSocket as Socket<ServerToClient, ClientToServer>)
    : io({ autoConnect: true })

// ── Debug:集中攔截所有 socket 進出流量 ─────────────────────
// 所有玩家操作都經過 emit、所有畫面更新都來自 server 事件,
// 在這裡記錄等於每一步都有 log,不必逐元件插樁。

/** gameState 太大,摘要成一行關鍵狀態 */
function summarizeState(s: GameStateClient) {
  return {
    phase: s.phase,
    round: s.round,
    turn: s.currentTurnPlayerId,
    locIndex: s.currentLocIndex,
    waitingFor: s.waitingFor,
    effect: s.activeEffect ? `${s.activeEffect.step} ${s.activeEffect.eventIndex + 1}/${s.activeEffect.eventCount}` : null,
    choosers: s.activeChoosers?.map(c => c.playerId) ?? [],
    skipVotes: s.skipVotes ?? [],
    results: s.lastConflictResults?.length ?? 0,
  }
}

if (debugEnabled) {
  const rawEmit = socket.emit.bind(socket) as (...a: unknown[]) => unknown
  ;(socket as any).emit = (event: string, ...args: unknown[]) => {
    dlog('emit', event, ...args)
    return rawEmit(event, ...args)
  }
  // e2e 的 mock socket 沒有 onAny,需防禦
  if (typeof socket.onAny === 'function') {
    socket.onAny((event: string, ...args: unknown[]) => {
      if (event === 'gameState') dlog('recv', event, summarizeState(args[0] as GameStateClient))
      else dlog('recv', event, ...args)
    })
  }
}

export default socket
