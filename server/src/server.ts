import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { GameEngine } from './gameEngine';
import { dlog } from './debug';
import { ClanId, Deployment, StepEvent } from '@kindred/shared';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Assets（卡牌圖片等）
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

// ─── Room Management ──────────────────────────

const rooms = new Map<string, GameEngine>();
const playerRoom = new Map<string, string>(); // playerId → roomCode
const advanceReady = new Map<string, Set<string>>(); // roomCode → Set of playerIds that clicked 確認

// ─── 席位與 socket 解耦（斷線重連用） ───────────
// playerId 在入房時等於當下的 socket.id，之後即使換 socket 也不變。
const socketToPlayer = new Map<string, string>(); // socketId → playerId
const playerSocket = new Map<string, string>();   // playerId → 現在的 socketId
const playerToken = new Map<string, string>();    // playerId → 重連憑證
const disconnectTimers = new Map<string, NodeJS.Timeout>(); // playerId → 寬限計時器

const RECONNECT_GRACE_MS = 60_000;   // 遊戲進行中的重連寬限
const LOBBY_GRACE_MS = 10_000;       // 大廳中的重連寬限(重整頁面也能歸位,又不會讓幽靈玩家佔位太久)

// ─── 結算演出播放控制（全員投票可加速跳過） ───────
const playbacks = new Map<string, { timer: NodeJS.Timeout | null; finish: () => void }>(); // roomCode → 播放器
const skipVotes = new Map<string, Set<string>>(); // roomCode → 已投加速票的 playerId

/** 由 socket 解析出席位 id（未註冊過的 socket 以自身 id 視之） */
function pidOf(socket: Socket): string {
  return socketToPlayer.get(socket.id) ?? socket.id;
}

function registerPlayer(socket: Socket, playerId: string, roomCode: string) {
  socketToPlayer.set(socket.id, playerId);
  playerSocket.set(playerId, socket.id);
  playerRoom.set(playerId, roomCode);
  if (!playerToken.has(playerId)) {
    playerToken.set(playerId, Math.random().toString(36).slice(2, 10));
  }
  socket.emit('session', { playerId, roomCode, token: playerToken.get(playerId)! });
}

function cleanupPlayer(playerId: string) {
  const sid = playerSocket.get(playerId);
  if (sid) socketToPlayer.delete(sid);
  playerSocket.delete(playerId);
  playerRoom.delete(playerId);
  playerToken.delete(playerId);
  const t = disconnectTimers.get(playerId);
  if (t) { clearTimeout(t); disconnectTimers.delete(playerId); }
}

function broadcast(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;
  const gs = game.state;
  dlog(`[broadcast] ${roomCode}`, {
    phase: gs.phase, round: gs.round, locIndex: gs.currentLocIndex,
    effect: gs.activeEffect ? `${gs.activeEffect.step} ${gs.activeEffect.eventIndex + 1}/${gs.activeEffect.eventCount}` : null,
    pendingChoices: gs.pendingChoices.length,
    notReady: Object.values(gs.players).filter(pl => !pl.isReady).map(pl => pl.name),
  });
  const ready = advanceReady.get(roomCode);
  const playerIds = new Set(Object.keys(game.state.players));

  // 廣播給玩家（個人化狀態，送到該席位目前綁定的 socket）
  playerIds.forEach(pid => {
    const socket = io.sockets.sockets.get(playerSocket.get(pid) ?? pid);
    if (!socket) return;
    const state = game.getClientState(pid);
    if (ready && ['REVELATION', 'ROUND_END'].includes(state.phase)) {
      state.waitingFor = Object.keys(game.state.players).filter(id => !ready.has(id));
    }
    state.skipVotes = [...(skipVotes.get(roomCode) ?? [])];
    socket.emit('gameState', state);
  });

  // 廣播給觀戰者（房間內非玩家席位的 socket）
  const spectatorState = game.getSpectatorState();
  io.sockets.adapter.rooms.get(roomCode)?.forEach(sid => {
    if (playerIds.has(socketToPlayer.get(sid) ?? sid)) return;
    io.sockets.sockets.get(sid)?.emit('gameState', spectatorState);
  });
}

// ─── Auto-advance ──────────────────────────────

function tryAdvance(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;
  const s = game.state;

  dlog(`[tryAdvance] ${roomCode} phase=${s.phase}`);
  if (s.phase === 'CLAN_SELECT' && game.allClansSelected()) {
    dlog(`[phase] ${roomCode} CLAN_SELECT -> HAND_BUILD`);
    const playerIds = Object.keys(s.players);
    s.ambitionHolder = playerIds[Math.floor(Math.random() * playerIds.length)];
    game.log(`隨機選出先手玩家：${s.players[s.ambitionHolder]?.name}`);
    game.startHandBuild();
    broadcast(roomCode);
    return;
  }

  if (s.phase === 'HAND_BUILD' && game.allHandBuilt()) {
    dlog(`[phase] ${roomCode} HAND_BUILD -> PLANNING`);
    game.startRound();
    broadcast(roomCode);
    return;
  }

  if (s.phase === 'PLANNING' && game.allDeployed()) {
    dlog(`[phase] ${roomCode} PLANNING -> resolution (startResolutionPhase)`);
    game.startResolutionPhase();
    broadcast(roomCode);
    return;
  }

  if (s.phase === 'WITHDRAW' && game.allWithdrawSubmitted()) {
    dlog(`[phase] ${roomCode} WITHDRAW all submitted -> apply + resolve`);
    finishLocWithdraw(roomCode);
  }
}

function finishLocWithdraw(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;

  // Step 1: Apply withdrawals for current location; clients see withdrawn slots.
  dlog(`[withdraw] ${roomCode} applyWithdrawals locIndex=${game.state.currentLocIndex}`);
  game.applyWithdrawals();
  broadcast(roomCode); // phase still = WITHDRAW; withdrawn slots now visible

  // Step 2: After 1.5 s, move to REVELATION for this location's resolution.
  setTimeout(() => {
    game.state.phase = 'REVELATION';
    const loc = game.state.locations[game.state.currentLocIndex];
    dlog(`[phase] ${roomCode} WITHDRAW -> REVELATION @ ${loc?.name}`);
    if (loc) {
      const revealed = game.revealLocation(loc.id);
      dlog(`[reveal] ${roomCode} ${loc.name} revealed ${revealed} face-down cards`);
      game.state.activeEffect = revealed > 0
        ? {
            locationId: loc.id,
            step: 'reveal',
            eventIndex: 0,
            eventCount: revealed,
            text: `揭開 ${loc.name} 的 ${revealed} 張暗牌`,
          }
        : null;
    }
    broadcast(roomCode);

    setTimeout(() => {
      // 掃描需要玩家選擇的卡牌（VE03 宵禁令、VE05 大規模操控）
      game.setupPendingChoices();
      if (game.state.pendingChoices.length > 0) {
        dlog(`[choice] ${roomCode} waiting for choices:`, game.state.pendingChoices.map(c => `${c.playerId}:${c.context.cardId}`).join(', '));
        game.state.activeEffect = null;
        broadcast(roomCode);
        return;
      }
      runCurrentLocResolution(roomCode);
    }, 500);
  }, 1500);
}

function runCurrentLocResolution(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;
  dlog(`[resolve] ${roomCode} resolving locIndex=${game.state.currentLocIndex}`);
  game.resolveCurrentLocation();
  playResolutionEffects(roomCode, () => {
    const fresh = rooms.get(roomCode);
    if (!fresh) return;
    fresh.setupPostResolutionChoices();
    if (fresh.state.pendingChoices.length > 0) {
      fresh.state.phase = 'REVELATION';
      fresh.state.activeEffect = null;
      broadcast(roomCode);
      return;
    }
    finishReveal(roomCode);
  });
  return;

  // 結算後檢查 VE09 等需要勝者選擇的效果（僅最後一筆結果）
  game!.setupPostResolutionChoices();
  if (game!.state.pendingChoices.length > 0) {
    game!.state.phase = 'REVELATION';
    broadcast(roomCode);
    return;
  }
  finishReveal(roomCode);
}

function finishReveal(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;
  game.state.phase = 'REVELATION';
  game.state.activeEffect = null;
  advanceReady.set(roomCode, new Set());
  broadcast(roomCode);
}

function playResolutionEffects(roomCode: string, done: () => void) {
  const game = rooms.get(roomCode);
  if (!game) return;
  const result = game.state.lastConflictResults[game.state.lastConflictResults.length - 1];
  if (!result) {
    done();
    return;
  }

  const timeline: Array<{ step: 'prepare' | 'conflict' | 'aftermath' | 'complete'; event: StepEvent }> = [
    ...result.stepEvents.prepare.map(event => ({ step: 'prepare' as const, event })),
    ...result.stepEvents.conflict.map(event => ({ step: 'conflict' as const, event })),
    ...result.stepEvents.aftermath.map(event => ({ step: 'aftermath' as const, event })),
  ];
  const locName = game.state.locations.find(l => l.id === result.locationId)?.name ?? result.locationId;
  const winner = result.winner ? game.state.players[result.winner] : null;

  timeline.push({
    step: 'complete',
    event: {
      text: result.tie ? `${locName} 平手，無人獲得影響力` : `${winner?.name ?? '無人'} 贏得 ${locName}`,
      delta: result.winner ? { influence: result.influenceGained[result.winner] ?? 0 } : undefined,
    },
  });

  // 註冊播放器：全員投票加速時 finish() 直接收尾
  skipVotes.set(roomCode, new Set());
  const playback: { timer: NodeJS.Timeout | null; finish: () => void } = { timer: null, finish: () => {} };
  playbacks.set(roomCode, playback);
  const cleanup = () => { playbacks.delete(roomCode); skipVotes.delete(roomCode); };
  playback.finish = () => {
    dlog(`[playback] ${roomCode} skip vote complete -> fast-forward`);
    if (playback.timer) clearTimeout(playback.timer);
    cleanup();
    const fresh = rooms.get(roomCode);
    if (!fresh) return;
    fresh.state.activeEffect = null;
    done();
  };

  let index = 0;
  const tick = () => {
    const fresh = rooms.get(roomCode);
    if (!fresh) return;
    const item = timeline[index];
    dlog(`[playback] ${roomCode} ${index + 1}/${timeline.length} step=${item.step}`, item.event.text);
    fresh.state.phase = 'REVELATION';
    fresh.state.activeEffect = {
      locationId: result.locationId,
      step: item.step,
      eventIndex: index,
      eventCount: timeline.length,
      sourceCardId: item.event.sourceCardId,
      sourcePlayerName: item.event.sourcePlayerName,
      targetPlayerName: item.event.targetPlayerName,
      text: item.event.text,
      delta: item.event.delta,
    };
    broadcast(roomCode);

    index += 1;
    if (index >= timeline.length) {
      playback.timer = setTimeout(() => { cleanup(); done(); }, 900);
    } else {
      playback.timer = setTimeout(tick, 1200);
    }
  };

  tick();
}

function checkAdvanceReady(roomCode: string) {
  const game = rooms.get(roomCode);
  const ready = advanceReady.get(roomCode);
  if (!game || !ready) return;

  const allPlayerIds = Object.keys(game.state.players);
  if (!allPlayerIds.every(pid => ready.has(pid))) return;

  // 全員確認
  advanceReady.delete(roomCode);

  if (game.state.phase === 'REVELATION') {
    // If more locations remain, advance to the next one's withdraw phase
    if (game.hasMoreLocations()) {
      dlog(`[phase] ${roomCode} REVELATION all confirmed -> next location WITHDRAW`);
      advanceReady.delete(roomCode);
      game.advanceToNextLocation();
      broadcast(roomCode);
      return;
    }
    // All locations resolved — end the round
    dlog(`[phase] ${roomCode} REVELATION all confirmed -> ROUND_END (endRound)`);
    game.endRound();
    broadcast(roomCode);
    if ((game.state.phase as string) === 'GAME_OVER') return;

    // ROUND_END：再等全員確認才進手牌建造
    advanceReady.set(roomCode, new Set());
    broadcast(roomCode);
  } else if (game.state.phase === 'ROUND_END') {
    dlog(`[phase] ${roomCode} ROUND_END all confirmed -> HAND_BUILD`);
    game.startHandBuild();
    broadcast(roomCode);
  }
}

function removePlayerNow(roomCode: string, playerId: string) {
  dlog(`[leave] ${roomCode} removing player ${playerId} (grace expired or lobby/game-over leave)`);
  const game = rooms.get(roomCode);
  cleanupPlayer(playerId);
  if (!game) return;
  const name = game.state.players[playerId]?.name;
  if (name) game.log(`${name} 離開了遊戲`);
  game.handlePlayerLeft(playerId);
  game.removePlayer(playerId);
  advanceReady.get(roomCode)?.delete(playerId);
  skipVotes.get(roomCode)?.delete(playerId);
  broadcast(roomCode);
  tryAdvance(roomCode);
  checkAdvanceReady(roomCode);
  // 離開者不再阻擋演出加速
  const votes = skipVotes.get(roomCode);
  const playback = playbacks.get(roomCode);
  const remaining = Object.keys(game.state.players);
  if (votes && playback && remaining.length > 0 && remaining.every(id => votes.has(id))) {
    playback.finish();
  }
  if (Object.keys(game.state.players).length === 0) {
    rooms.delete(roomCode);
    advanceReady.delete(roomCode);
    dlog(`[cleanup] room ${roomCode} empty, removed`);
  }
}

// ─── Socket Events ─────────────────────────────

io.on('connection', (socket: Socket) => {
  dlog(`[connect] ${socket.id}`);
  // all incoming events logged centrally
  socket.onAny((event: string, ...args: unknown[]) => {
    dlog(`[recv] ${pidOf(socket)} -> ${event}`, ...args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)));
  });

  socket.on('createRoom', ({ name }: { name: string }) => {
    let code: string;
    do { code = Math.random().toString(36).substring(2, 6).toUpperCase(); }
    while (rooms.has(code));

    const game = new GameEngine(code);
    rooms.set(code, game);
    game.addPlayer(socket.id, name.slice(0, 16));
    registerPlayer(socket, socket.id, code);
    socket.join(code);
    socket.emit('roomCreated', code);
    broadcast(code);
    dlog(`[room] ${name} created ${code}`);
  });

  socket.on('joinRoom', ({ code, name }: { code: string; name: string }) => {
    const game = rooms.get(code.toUpperCase());
    if (!game) { socket.emit('error', '找不到房間'); return; }
    if (Object.keys(game.state.players).length >= 6) { socket.emit('error', '房間已滿（最多 6 人）'); return; }
    if (!['LOBBY', 'CLAN_SELECT'].includes(game.state.phase)) { socket.emit('error', '遊戲已開始'); return; }

    game.addPlayer(socket.id, name.slice(0, 16));
    registerPlayer(socket, socket.id, code.toUpperCase());
    socket.join(code.toUpperCase());
    broadcast(code.toUpperCase());
    dlog(`[join] ${name} -> ${code}`);
  });

  socket.on('readyStart', () => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    if (!game || game.state.phase !== 'LOBBY') return;
    const players = Object.values(game.state.players);
    if (players.length < 2) { socket.emit('error', '至少需要 2 名玩家'); return; }
    // Only host (first player) can start
    if (players[0].id !== pid) { socket.emit('error', '只有房主可以開始遊戲'); return; }
    game.startClanSelect();
    broadcast(code);
  });

  socket.on('selectClan', (clan: ClanId) => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const ok = game.selectClan(pid, clan);
    if (!ok) { socket.emit('error', '氏族已被選走或不合法'); return; }
    game.setReady(pid);
    broadcast(code);
    tryAdvance(code);
  });

  socket.on('selectHandCard', (cardId: string) => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const ok = game.selectHandCard(pid, cardId);
    if (!ok) { socket.emit('error', '手牌選擇失敗'); return; }
    broadcast(code);
    tryAdvance(code);
  });

  socket.on('drainAlly', (allyId: string) => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const ok = game.drainAlly(pid, allyId);
    if (!ok) { socket.emit('error', '汲取失敗'); return; }
    broadcast(code);
  });

  socket.on('submitDeployment', (deploy: Deployment | { skip: true }) => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const ok = game.submitDeployment(pid, deploy);
    if (!ok) { socket.emit('error', '部署失敗（血液不足 / 牌不在手中 / 血液代幣超過 3）'); return; }
    broadcast(code);
    tryAdvance(code);
  });

  socket.on('submitWithdraw', ({ locationId, withdraw }: { locationId: string; withdraw: boolean }) => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    game.submitWithdraw(pid, locationId, withdraw);
    broadcast(code);
    tryAdvance(code);
  });

  socket.on('respondChoice', ({ choiceId, option }: { choiceId: string; option: string }) => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    // 確認這個選擇屬於此玩家
    const choice = game.state.pendingChoices.find(c => c.id === choiceId && c.playerId === pid);
    if (!choice) return;
    game.applyPendingChoice(choiceId, option);
    broadcast(code);
    if (game.state.pendingChoices.length === 0) {
      // 判斷現在是 pre-resolution 還是 post-resolution（用 currentLocResolved）
      if (!game.state.currentLocResolved) {
        runCurrentLocResolution(code);  // 尚未結算 → 執行結算
      } else {
        finishReveal(code);             // 已結算 → 顯示結果
      }
    }
  });

  socket.on('readyAdvance', () => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    if (!['REVELATION', 'ROUND_END'].includes(game.state.phase)) return;

    const ready = advanceReady.get(code);
    if (!ready) return;
    ready.add(pid);

    // 廣播最新確認人數（讓客戶端顯示等待狀態）
    broadcast(code);
    checkAdvanceReady(code);
  });

  socket.on('skipEffects', () => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    const votes = skipVotes.get(code);
    const playback = playbacks.get(code);
    if (!game || !votes || !playback || !game.state.players[pid]) return;
    votes.add(pid);
    const everyoneVoted = Object.keys(game.state.players).every(id => votes.has(id));
    if (everyoneVoted) playback.finish();
    else broadcast(code);
  });

  socket.on('watchRoom', (code: string) => {
    const game = rooms.get(code.toUpperCase());
    if (!game) { socket.emit('error', '找不到房間'); return; }
    socket.join(code.toUpperCase());
    // 觀戰者收到的狀態：所有牌面朝上（isRevealed = true），沒有私人手牌
    socket.emit('gameState', game.getSpectatorState());
    dlog(`[spectator] ${socket.id} watching ${code}`);
  });

  socket.on('chat', (msg: string) => {
    const pid = pidOf(socket);
    const code = playerRoom.get(pid);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const name = game.state.players[pid]?.name ?? '???';
    io.to(code).emit('chat', { name, msg: String(msg).slice(0, 200) });
  });

  socket.on('disconnect', () => {
    const pid = pidOf(socket);
    socketToPlayer.delete(socket.id);
    const code = playerRoom.get(pid);
    if (!code) { dlog(`[disconnect] ${socket.id}`); return; }
    const game = rooms.get(code);
    if (!game || !game.state.players[pid]) {
      cleanupPlayer(pid);
      dlog(`[disconnect] ${socket.id}`);
      return;
    }

    const phase = game.state.phase;
    // 終局直接移除;大廳短寬限、遊戲中長寬限,席位保留等待重連
    if (phase === 'GAME_OVER') {
      removePlayerNow(code, pid);
    } else {
      if (phase !== 'LOBBY') {
        const name = game.state.players[pid]?.name ?? pid;
        game.log(`${name} 斷線，等待重連…`);
        broadcast(code);
      }
      const timer = setTimeout(() => {
        disconnectTimers.delete(pid);
        removePlayerNow(code, pid);
      }, phase === 'LOBBY' ? LOBBY_GRACE_MS : RECONNECT_GRACE_MS);
      disconnectTimers.set(pid, timer);
    }
    dlog(`[disconnect] ${socket.id} (seat ${pid}) phase=${phase} grace=${phase === 'LOBBY' ? LOBBY_GRACE_MS : RECONNECT_GRACE_MS}ms`);
  });

  socket.on('rejoinRoom', ({ roomCode, playerId, token }: { roomCode: string; playerId: string; token: string }) => {
    const code = roomCode?.toUpperCase?.() ?? '';
    const game = rooms.get(code);
    if (!game || !game.state.players[playerId] || playerToken.get(playerId) !== token) {
      socket.emit('rejoinFailed');
      return;
    }
    // 取消寬限計時器並重新綁定 socket
    const timer = disconnectTimers.get(playerId);
    if (timer) { clearTimeout(timer); disconnectTimers.delete(playerId); }
    const oldSid = playerSocket.get(playerId);
    if (oldSid && oldSid !== socket.id) {
      socketToPlayer.delete(oldSid);
      // 舊分頁若還連著,通知它席位已被接管,退回入口畫面
      io.sockets.sockets.get(oldSid)?.emit('rejoinFailed');
    }
    registerPlayer(socket, playerId, code);
    socket.join(code);
    game.log(`${game.state.players[playerId].name} 已重新連線`);
    broadcast(code);
    dlog(`[rejoin] ${socket.id} -> seat ${playerId} @ ${code}`);
  });
});

// Ensure PORT is a number to satisfy Node's listen overload typing.
const PORT = Number(process.env.PORT ?? 3456);
// Bind the HTTP server to localhost by default for safety; use a reverse
// proxy (Nginx) to expose to the public internet. This prevents the node
// process from directly listening on all interfaces.
const HOST = process.env.HOST ?? '127.0.0.1';
httpServer.listen(PORT, HOST, () => {
  console.log(`\n🩸 Kindred: Blood & Betrayal`);
  console.log(`   http://${HOST}:${PORT}\n`);
});
