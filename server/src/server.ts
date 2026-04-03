import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { GameEngine } from './gameEngine';
import { ClanId, Deployment } from '@kindred/shared';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Assets（卡牌圖片等）
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

// ─── Room Management ──────────────────────────

const rooms = new Map<string, GameEngine>();
const playerRoom = new Map<string, string>(); // socketId → roomCode
const advanceReady = new Map<string, Set<string>>(); // roomCode → Set of socketIds that clicked 確認

function broadcast(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;
  const ready = advanceReady.get(roomCode);
  Object.keys(game.state.players).forEach(pid => {
    const socket = io.sockets.sockets.get(pid);
    if (!socket) return;
    const state = game.getClientState(pid);
    // 在 REVELATION / ROUND_END 時，用 waitingFor 表示「還未點確認」的玩家
    if (ready && ['REVELATION', 'ROUND_END'].includes(state.phase)) {
      state.waitingFor = Object.keys(game.state.players).filter(id => !ready.has(id));
    }
    socket.emit('gameState', state);
  });
}

// ─── Auto-advance ──────────────────────────────

function tryAdvance(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;
  const s = game.state;

  if (s.phase === 'CLAN_SELECT' && game.allClansSelected()) {
    s.ambitionHolder = Object.keys(s.players)[0];
    game.startHandBuild();
    broadcast(roomCode);
    return;
  }

  if (s.phase === 'HAND_BUILD' && game.allHandBuilt()) {
    game.startRound();
    broadcast(roomCode);
    return;
  }

  if (s.phase === 'PLANNING' && game.allDeployed()) {
    game.startWithdraw();
    broadcast(roomCode);
    return;
  }

  if (s.phase === 'WITHDRAW' && game.allWithdrawSubmitted()) {
    finishResolution(roomCode);
  }
}

function finishResolution(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;

  // 短暫閃示「翻牌！」再結算
  game.state.phase = 'REVELATION';
  broadcast(roomCode);

  setTimeout(() => {
    // 掃描需要玩家選擇的卡牌（VE03 宵禁令、VE05 大規模操控）
    game.setupPendingChoices();
    if (game.state.pendingChoices.length > 0) {
      game.state.phase = 'REVELATION'; // 確保 client 顯示選擇 Modal
      broadcast(roomCode);
      return;
    }
    runResolution(roomCode);
  }, 1500);
}

function runResolution(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;
  game.resolveAllLocations();

  // 結算後檢查 VE09 等需要勝者選擇的效果
  game.setupPostResolutionChoices();
  if (game.state.pendingChoices.length > 0) {
    game.state.phase = 'REVELATION'; // 讓 client 顯示結果 + choice modal
    broadcast(roomCode);
    return;
  }
  finishReveal(roomCode);
}

function finishReveal(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;
  game.state.phase = 'REVELATION';
  advanceReady.set(roomCode, new Set());
  broadcast(roomCode);
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
    game.endRound();
    broadcast(roomCode);
    if ((game.state.phase as string) === 'GAME_OVER') return;

    // ROUND_END：再等全員確認才進手牌建造
    advanceReady.set(roomCode, new Set());
    broadcast(roomCode);
  } else if (game.state.phase === 'ROUND_END') {
    game.startHandBuild();
    broadcast(roomCode);
  }
}

// ─── Socket Events ─────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('createRoom', ({ name }: { name: string }) => {
    let code: string;
    do { code = Math.random().toString(36).substring(2, 6).toUpperCase(); }
    while (rooms.has(code));

    const game = new GameEngine(code);
    rooms.set(code, game);
    game.addPlayer(socket.id, name.slice(0, 16));
    playerRoom.set(socket.id, code);
    socket.join(code);
    socket.emit('roomCreated', code);
    broadcast(code);
    console.log(`[room] ${name} created ${code}`);
  });

  socket.on('joinRoom', ({ code, name }: { code: string; name: string }) => {
    const game = rooms.get(code.toUpperCase());
    if (!game) { socket.emit('error', '找不到房間'); return; }
    if (Object.keys(game.state.players).length >= 6) { socket.emit('error', '房間已滿（最多 6 人）'); return; }
    if (!['LOBBY', 'CLAN_SELECT'].includes(game.state.phase)) { socket.emit('error', '遊戲已開始'); return; }

    game.addPlayer(socket.id, name.slice(0, 16));
    playerRoom.set(socket.id, code.toUpperCase());
    socket.join(code.toUpperCase());
    broadcast(code.toUpperCase());
    console.log(`[join] ${name} → ${code}`);
  });

  socket.on('readyStart', () => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const game = rooms.get(code);
    if (!game || game.state.phase !== 'LOBBY') return;
    const players = Object.values(game.state.players);
    if (players.length < 3) { socket.emit('error', '至少需要 3 名玩家'); return; }
    // Only host (first player) can start
    if (players[0].id !== socket.id) { socket.emit('error', '只有房主可以開始遊戲'); return; }
    game.startClanSelect();
    broadcast(code);
  });

  socket.on('selectClan', (clan: ClanId) => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const ok = game.selectClan(socket.id, clan);
    if (!ok) { socket.emit('error', '氏族已被選走或不合法'); return; }
    game.setReady(socket.id);
    broadcast(code);
    tryAdvance(code);
  });

  socket.on('selectHandCard', (cardId: string) => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const ok = game.selectHandCard(socket.id, cardId);
    if (!ok) { socket.emit('error', '手牌選擇失敗'); return; }
    broadcast(code);
    tryAdvance(code);
  });

  socket.on('drainAlly', (allyId: string) => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const ok = game.drainAlly(socket.id, allyId);
    if (!ok) { socket.emit('error', '汲取失敗'); return; }
    broadcast(code);
  });

  socket.on('submitDeployment', (deploy: Deployment | { skip: true }) => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const ok = game.submitDeployment(socket.id, deploy);
    if (!ok) { socket.emit('error', '部署失敗（血液不足 / 牌不在手中 / 血液代幣超過 3）'); return; }
    broadcast(code);
    tryAdvance(code);
  });

  socket.on('submitWithdraw', ({ locationId, withdraw }: { locationId: string; withdraw: boolean }) => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    game.submitWithdraw(socket.id, locationId, withdraw);
    broadcast(code);
    tryAdvance(code);
  });

  socket.on('respondChoice', ({ choiceId, option }: { choiceId: string; option: string }) => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    // 確認這個選擇屬於此玩家
    const choice = game.state.pendingChoices.find(c => c.id === choiceId && c.playerId === socket.id);
    if (!choice) return;
    game.applyPendingChoice(choiceId, option);
    broadcast(code);
    if (game.state.pendingChoices.length === 0) {
      // 判斷現在是 pre-resolution 還是 post-resolution
      if (game.state.lastConflictResults.length === 0) {
        runResolution(code);       // 尚未結算 → 執行結算
      } else {
        finishReveal(code);        // 已結算 → 顯示結果
      }
    }
  });

  socket.on('readyAdvance', () => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    if (!['REVELATION', 'ROUND_END'].includes(game.state.phase)) return;

    const ready = advanceReady.get(code);
    if (!ready) return;
    ready.add(socket.id);

    // 廣播最新確認人數（讓客戶端顯示等待狀態）
    broadcast(code);
    checkAdvanceReady(code);
  });

  socket.on('chat', (msg: string) => {
    const code = playerRoom.get(socket.id);
    if (!code) return;
    const game = rooms.get(code);
    if (!game) return;
    const name = game.state.players[socket.id]?.name ?? '???';
    io.to(code).emit('chat', { name, msg: String(msg).slice(0, 200) });
  });

  socket.on('disconnect', () => {
    const code = playerRoom.get(socket.id);
    if (code) {
      const game = rooms.get(code);
      if (game) {
        game.removePlayer(socket.id);
        broadcast(code);
        if (Object.keys(game.state.players).length === 0) {
          rooms.delete(code);
          console.log(`[cleanup] room ${code} empty, removed`);
        }
      }
      playerRoom.delete(socket.id);
    }
    console.log(`[disconnect] ${socket.id}`);
  });
});

const PORT = process.env.PORT ?? 3456;
httpServer.listen(PORT, () => {
  console.log(`\n🩸 Kindred: Blood & Betrayal`);
  console.log(`   http://localhost:${PORT}\n`);
});
