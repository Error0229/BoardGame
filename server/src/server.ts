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

function broadcast(roomCode: string) {
  const game = rooms.get(roomCode);
  if (!game) return;
  Object.keys(game.state.players).forEach(pid => {
    const socket = io.sockets.sockets.get(pid);
    if (socket) socket.emit('gameState', game.getClientState(pid));
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

  // Revelation flash
  game.state.phase = 'REVELATION';
  broadcast(roomCode);

  setTimeout(() => {
    game.resolveAllLocations();
    broadcast(roomCode);

    setTimeout(() => {
      game.endRound();
      broadcast(roomCode);

      if (game.state.phase !== 'GAME_OVER') {
        setTimeout(() => {
          game.startHandBuild();
          broadcast(roomCode);
        }, 3500);
      }
    }, 4000);
  }, 2000);
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
    if (players.length < 2) { socket.emit('error', '至少需要 2 名玩家'); return; }
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
