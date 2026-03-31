import {
  GameStateFull, GameStateClient, GamePhase,
  PlayerPrivate, SlotFull, SlotVisible,
  ConflictResult, Deployment, ClanId, CardDef, AllyCard, LocationDef,
} from '@kindred/shared';
import {
  LOCATIONS, CLAN_DEFS, CLAN_STARTERS, CLAN_DECKS,
  ALLY_POOL, VICTIM_POOL,
  getCardById, shuffle,
} from './cardData';

function drawCards(deck: CardDef[], n: number): { drawn: CardDef[]; rest: CardDef[] } {
  return { drawn: deck.slice(0, n), rest: deck.slice(n) };
}

export class GameEngine {
  state: GameStateFull;

  constructor(roomCode: string) {
    this.state = {
      roomCode,
      phase: 'LOBBY',
      round: 0,
      ambitionHolder: '',
      locations: LOCATIONS,
      players: {},
      deployments: Object.fromEntries(LOCATIONS.map(l => [l.id, []])),
      withdrawChoices: Object.fromEntries(LOCATIONS.map(l => [l.id, {}])),
      locationAllies: Object.fromEntries(LOCATIONS.map(l => [l.id, null])),
      allyDeck: shuffle([...ALLY_POOL]),
      victimDeck: shuffle([...VICTIM_POOL]),
      lastConflictResults: [],
      winner: null,
      log: [],
    };
  }

  // ─── 玩家管理 ───────────────────────────────

  addPlayer(id: string, name: string): void {
    this.state.players[id] = {
      id, name, clan: null,
      blood: 6, influence: 3,
      handCount: 0, allianceCount: 1, diablerie: 0,
      deploymentsLeft: 0, isReady: false,
      hand: [], deck: [], handBuildDraft: [],
      alliance: [{ id: 'v_start', name: 'Kine', type: 'human', influence: 1, feedBlood: 1, drainBlood: 2, drainInfluence: 0 }],
    };
    this.log(`${name} 加入了房間`);
  }

  removePlayer(id: string): void {
    const p = this.state.players[id];
    if (p) { this.log(`${p.name} 離開了房間`); delete this.state.players[id]; }
  }

  selectClan(playerId: string, clan: ClanId): boolean {
    const p = this.state.players[playerId];
    if (!p || this.state.phase !== 'CLAN_SELECT') return false;
    const taken = Object.values(this.state.players).some(pl => pl.id !== playerId && pl.clan === clan);
    if (taken) return false;
    p.clan = clan;
    p.blood = CLAN_DEFS[clan].startBlood;
    p.influence = CLAN_DEFS[clan].startInfluence;
    this.log(`${p.name} 選擇了 ${CLAN_DEFS[clan].name_zh}`);
    return true;
  }

  setReady(playerId: string): void {
    const p = this.state.players[playerId];
    if (p) p.isReady = true;
  }

  allClansSelected(): boolean {
    const players = Object.values(this.state.players);
    return players.length >= 2 && players.every(p => p.clan !== null);
  }

  // ─── 遊戲流程 ───────────────────────────────

  startClanSelect(): void {
    this.state.phase = 'CLAN_SELECT';
    Object.values(this.state.players).forEach(p => (p.isReady = false));
    this.log('請各玩家選擇氏族');
  }

  // ─── 手牌建造 ────────────────────────────────

  startHandBuild(): void {
    const s = this.state;
    s.phase = 'HAND_BUILD';
    const is3p = Object.keys(s.players).length === 3;

    Object.values(s.players).forEach(p => {
      p.isReady = false;
      p.handBuildDraft = [];

      if (s.round === 0) {
        // 第一輪：初始化牌組，起始手牌固定（Hunt + Ready）
        p.deck = shuffle([...CLAN_DECKS[p.clan!]]);
        p.hand = [...CLAN_STARTERS[p.clan!]];
      }

      // 3 人第 1 輪：抽 3 選 2；其他：抽 2 選 1
      const drawCount = (is3p && s.round === 0) ? 3 : 2;
      const { drawn, rest } = drawCards(p.deck, drawCount);
      p.handBuildDraft = drawn;
      p.deck = rest;
    });

    this.log('手牌建造：請各玩家選擇要保留的牌');
  }

  allHandBuilt(): boolean {
    return Object.values(this.state.players).every(p => p.isReady);
  }

  selectHandCard(playerId: string, cardId: string): boolean {
    const s = this.state;
    if (s.phase !== 'HAND_BUILD') return false;
    const p = s.players[playerId];
    if (!p || p.isReady) return false;

    const is3p = Object.keys(s.players).length === 3;
    const keepCount = (is3p && s.round === 0) ? 2 : 1;

    const idx = p.handBuildDraft.findIndex(c => c.id === cardId);
    if (idx === -1) return false;

    const kept = p.handBuildDraft.splice(idx, 1)[0];
    p.hand.push(kept);

    // 剩餘的牌放回牌組底部
    if (p.hand.filter(c => !p.handBuildDraft.includes(c)).length >= keepCount + (s.round === 0 ? 2 : 0)) {
      // 已選夠：把 draft 剩餘放回底部
      p.deck = [...p.deck, ...p.handBuildDraft];
      p.handBuildDraft = [];
      p.isReady = true;
      p.handCount = p.hand.length;
      this.log(`${p.name} 完成手牌建造（${p.hand.length} 張）`);
    }

    return true;
  }

  // ─── 汲取同盟 ────────────────────────────────

  drainAlly(playerId: string, allyId: string): boolean {
    const s = this.state;
    if (!['PLANNING'].includes(s.phase)) return false;
    const p = s.players[playerId];
    if (!p) return false;

    const ally = p.alliance.find(a => a.id === allyId && !a.drained);
    if (!ally) return false;

    ally.drained = true;
    p.blood += ally.drainBlood;

    // 汲取吸血鬼盟友需承受弒親代幣
    if (ally.type === 'vampire') {
      p.diablerie += 1;
      this.log(`${p.name} 汲取 ${ally.name}（吸血鬼）→ +${ally.drainBlood}💧，承受 1 弒親代幣`);
      if (p.diablerie >= 3) {
        this.log(`⚠️ ${p.name} 弒親代幣達 3 個，被淘汰！`);
        // TODO: 淘汰邏輯
      }
    } else {
      this.log(`${p.name} 汲取 ${ally.name} → +${ally.drainBlood}💧`);
    }

    p.allianceCount = p.alliance.length;
    return true;
  }

  startRound(): void {
    const s = this.state;
    s.round += 1;
    s.phase = 'PLANNING';
    s.lastConflictResults = [];

    // Reset deployments & withdrawals
    s.deployments = Object.fromEntries(LOCATIONS.map(l => [l.id, []]));
    s.withdrawChoices = Object.fromEntries(LOCATIONS.map(l => [l.id, {}]));

    // Place ally cards at each location
    s.locationAllies = {};
    for (const loc of LOCATIONS) {
      if (s.allyDeck.length > 0) {
        s.locationAllies[loc.id] = s.allyDeck.shift()!;
      } else {
        s.locationAllies[loc.id] = null;
      }
    }

    const deployLimit = [0, 2, 3, 4][s.round] ?? 4;
    this.log(`── 第 ${s.round} / 3 回合開始 ──`);

    Object.values(s.players).forEach(p => {
      p.isReady = false;
      p.deploymentsLeft = deployLimit;

      // Feed phase: gain blood from alliance
      const feedGain = p.alliance.reduce((sum, a) => sum + a.feedBlood, 0);
      p.blood += feedGain;
      if (feedGain > 0) this.log(`${p.name} 從同盟獲得 +${feedGain} 血液`);

      // Feed phase: reset drained allies (回合結束後可再次使用)
      p.alliance.forEach(a => { a.drained = false; });
      p.handCount = p.hand.length;
      p.allianceCount = p.alliance.length;
    });

    this.log(`規劃階段：每位玩家可部署 ${deployLimit} 張牌`);
  }

  allDeployed(): boolean {
    return Object.values(this.state.players).every(p => p.isReady);
  }

  submitDeployment(playerId: string, deploy: Deployment | { skip: true }): boolean {
    const s = this.state;
    if (s.phase !== 'PLANNING') return false;
    const p = s.players[playerId];
    if (!p || p.isReady) return false;

    if ('skip' in deploy) {
      p.isReady = true;
      p.deploymentsLeft = 0;
      this.log(`${p.name} 結束本回合部署`);
      return true;
    }

    const { locationId, cardId, faceDown, bloodTokens } = deploy;
    const cardIdx = p.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return false;

    // Face-down costs 1 blood (Nosferatu免費)
    const faceDownCost = (p.clan === 'nosferatu') ? 0 : (faceDown ? 1 : 0);
    const totalBloodCost = faceDownCost + bloodTokens;
    if (bloodTokens > 3) return false; // max 3 blood per deployment
    if (p.blood < totalBloodCost) return false;

    p.blood -= totalBloodCost;
    const card = p.hand.splice(cardIdx, 1)[0];
    p.handCount = p.hand.length;

    s.deployments[locationId].push({
      playerId, cardId, faceDown, bloodTokens,
      withdrawn: false, effectivePower: 0,
    });

    p.deploymentsLeft -= 1;
    if (p.deploymentsLeft <= 0 || p.hand.length === 0) {
      p.isReady = true;
      p.deploymentsLeft = 0;
    }

    this.log(`${p.name} 在 ${this.locName(locationId)} ${faceDown ? '秘密' : ''}部署了一張牌${bloodTokens > 0 ? `（+${bloodTokens}💧）` : ''}`);
    return true;
  }

  // ─── Resolution ─────────────────────────────

  startWithdraw(): void {
    this.state.phase = 'WITHDRAW';
    Object.values(this.state.players).forEach(p => (p.isReady = false));
    // Players with no deployments anywhere are auto-ready
    Object.values(this.state.players).forEach(p => {
      const hasAny = LOCATIONS.some(loc =>
        this.state.deployments[loc.id].some(sl => sl.playerId === p.id)
      );
      if (!hasAny) p.isReady = true;
    });
  }

  submitWithdraw(playerId: string, locationId: string, withdraw: boolean): boolean {
    const s = this.state;
    if (s.phase !== 'WITHDRAW') return false;
    const p = s.players[playerId];
    if (!p) return false;

    const hasDeployment = s.deployments[locationId].some(sl => sl.playerId === playerId);
    if (!hasDeployment) return true;

    s.withdrawChoices[locationId][playerId] = withdraw;

    // Check if this player has responded for all their locations
    const allAnswered = LOCATIONS.every(loc => {
      const hasSlot = s.deployments[loc.id].some(sl => sl.playerId === playerId);
      return !hasSlot || loc.id in s.withdrawChoices[loc.id] || playerId in s.withdrawChoices[loc.id];
    });

    if (withdraw) this.log(`${p.name} 在 ${this.locName(locationId)} 選擇撤退`);
    else this.log(`${p.name} 在 ${this.locName(locationId)} 選擇留守`);

    // Mark player ready once they've answered for ALL their locations
    const pendingLocs = LOCATIONS.filter(loc =>
      s.deployments[loc.id].some(sl => sl.playerId === playerId) &&
      !(playerId in s.withdrawChoices[loc.id])
    );
    if (pendingLocs.length === 0) p.isReady = true;

    return true;
  }

  allWithdrawSubmitted(): boolean {
    return Object.values(this.state.players).every(p => p.isReady);
  }

  // ─── Full Resolution ─────────────────────────

  resolveAllLocations(): ConflictResult[] {
    const s = this.state;
    s.phase = 'CONFLICT';
    const results: ConflictResult[] = [];

    for (const loc of s.locations) {
      // Apply withdrawals
      const choices = s.withdrawChoices[loc.id];
      s.deployments[loc.id].forEach(slot => {
        if (choices[slot.playerId]) {
          slot.withdrawn = true;
          s.players[slot.playerId].blood += slot.bloodTokens;
        }
      });

      const result = this.resolveLocation(loc);
      results.push(result);
    }

    s.lastConflictResults = results;

    // Check frenzy for all players
    Object.values(s.players).forEach(p => this.checkFrenzy(p));

    return results;
  }

  private resolveLocation(loc: LocationDef): ConflictResult {
    const s = this.state;
    const active = s.deployments[loc.id].filter(sl => !sl.withdrawn);

    const result: ConflictResult = {
      locationId: loc.id,
      winner: null, second: null,
      scores: {}, influenceGained: {},
      bloodEvents: [], tie: false,
    };

    if (active.length === 0) return result;

    // ── Preparation effects ──────────────────────
    this.applyPreparation(loc.id, active, result);

    // ── Compute effective power ──────────────────
    active.forEach(slot => {
      const p = s.players[slot.playerId]!;
      slot.effectivePower = this.computePower(slot, active, p, loc.id);
      result.scores[slot.playerId] = (result.scores[slot.playerId] ?? 0) + slot.effectivePower;
    });

    // ── Conflict card effects ────────────────────
    this.applyConflict(loc.id, active, result);

    // ── Determine winner ─────────────────────────
    const playerIds = [...new Set(active.map(sl => sl.playerId))];
    const playerScores: Record<string, number> = {};
    playerIds.forEach(pid => {
      playerScores[pid] = active
        .filter(sl => sl.playerId === pid)
        .reduce((sum, sl) => sum + sl.effectivePower, 0);
    });

    const sorted = Object.entries(playerScores).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      // Tie: ambition holder LOSES (not first priority)
      const aIsAmbition = a[0] === s.ambitionHolder ? 1 : 0;
      const bIsAmbition = b[0] === s.ambitionHolder ? 1 : 0;
      return aIsAmbition - bIsAmbition;
    });

    result.scores = playerScores;

    if (sorted.length >= 1) {
      const [firstId, firstScore] = sorted[0];
      const [secondId, secondScore] = sorted[1] ?? [null, -1];

      if (sorted.length >= 2 && firstScore === sorted[1][1] && firstId !== s.ambitionHolder && sorted[1][0] !== s.ambitionHolder) {
        result.tie = true;
        this.log(`${this.locName(loc.id)} 完全平局，無人獲得影響力`);
      } else {
        result.winner = firstId;
        if (sorted.length >= 2) result.second = sorted[1][0];

        // Influence rewards
        const round = s.round;
        const infTable = loc.influence; // [round-1][rank-1]
        const firstInf = infTable[round - 1]?.[0] ?? 0;
        const secondInf = infTable[round - 1]?.[1] ?? 0;

        const wp = s.players[firstId];
        if (wp) {
          wp.influence += firstInf;
          result.influenceGained[firstId] = firstInf;
        }
        if (result.second) {
          const sp = s.players[result.second];
          if (sp && secondInf > 0) {
            sp.influence += secondInf;
            result.influenceGained[result.second] = secondInf;
          }
        }

        // Win ally/victim
        if (wp) this.awardPrize(loc.id, result.winner!, result.second);

        // If Prince's Haven: transfer ambition token
        if (loc.isPrinces && result.winner) {
          s.ambitionHolder = result.winner;
          this.log(`${wp?.name} 取得野心代幣，成為新的先手玩家`);
        }

        const scoreStr = Object.entries(playerScores)
          .sort((a,b) => b[1]-a[1])
          .map(([pid, sc]) => `${s.players[pid]?.name}:${sc}`)
          .join(' / ');
        this.log(`${this.locName(loc.id)} 勝者：${wp?.name}（${firstScore}点）+${firstInf}Inf ｜ ${scoreStr}`);
      }
    }

    // ── Aftermath effects ───────────────────────
    this.applyAftermath(loc.id, active, result);

    return result;
  }

  private computePower(slot: SlotFull, allActive: SlotFull[], player: PlayerPrivate, locationId: string): number {
    const card = getCardById(slot.cardId);
    if (!card) return slot.bloodTokens;

    let power = card.power;
    const mySlots = allActive.filter(sl => sl.playerId === slot.playerId);
    const allPlayers = Object.values(this.state.players);
    const rivals = allPlayers.filter(p => p.id !== slot.playerId);

    // Passive cards only work face-up
    if (card.type === 'passive' && slot.faceDown) return slot.bloodTokens;

    switch (card.id) {
      case 'BR01': // Bloody Fury: -2 if deployed blood > 0
        if (slot.bloodTokens > 0) power -= 2;
        break;
      case 'BR02': // Punk's Posse: +2 per own deployed card
        power += mySlots.length * 2;
        break;
      case 'GA03': // Feral Weapons: blood adds 2 each (handled below)
        break;
      case 'MA04': { // Shadow Strike: +2 if fewest face-up cards
        const faceUpMap: Record<string, number> = {};
        allActive.forEach(sl => {
          if (!sl.faceDown) faceUpMap[sl.playerId] = (faceUpMap[sl.playerId] ?? 0) + 1;
        });
        const myFaceUp = faceUpMap[slot.playerId] ?? 0;
        const minFaceUp = Math.min(...Object.values(faceUpMap), myFaceUp);
        if (myFaceUp <= minFaceUp) power += 2;
        break;
      }
      case 'MA07': // Mindless Assault: face-down cards have power 4
        if (slot.faceDown) power = 4;
        break;
      case 'MA08': // Ready: +1 per own deployed card
        power += mySlots.length;
        break;
      case 'NO08': // Ready: +2 at Prince's Haven
        if (locationId === 'haven') power += 2;
        break;
      case 'TO02': // Entourage: +1 per alliance card (max 7)
        power += Math.min(player.alliance.length, 7);
        break;
      case 'TO05': // Entrancement: +1 per all deployed cards
        power += allActive.length;
        break;
      case 'TR01': // Focus from Hunger: 9 - pool blood
        power = Math.max(0, 9 - player.blood);
        break;
      case 'VE04': { // Majesty: equal to highest printed power
        const maxPrinted = Math.max(...allActive.map(sl => getCardById(sl.cardId)?.power ?? 0));
        power = maxPrinted;
        break;
      }
      case 'VE08': // Ready: just 2 power
        break;
    }

    // Blood token contribution (Feral Weapons doubles it)
    const hasFeral = mySlots.some(sl => sl.cardId === 'GA03');
    const bloodPower = hasFeral ? slot.bloodTokens * 2 : slot.bloodTokens;

    return Math.max(0, power) + bloodPower;
  }

  private applyPreparation(locationId: string, active: SlotFull[], result: ConflictResult): void {
    const s = this.state;
    active.forEach(slot => {
      const card = getCardById(slot.cardId);
      if (!card || card.type !== 'preparation') return;
      const p = s.players[slot.playerId]!;
      const rivals = Object.values(s.players).filter(x => x.id !== slot.playerId);

      switch (card.id) {
        case 'BR07': { // Show of Force: steal 1 from each rival
          let stolen = 0;
          rivals.forEach(r => { if (r.blood > 0) { r.blood--; stolen++; } });
          p.blood += stolen;
          if (stolen > 0) { result.bloodEvents.push(`${p.name} 展示武力：+${stolen}💧`); this.log(`${p.name} 的展示武力偷取 ${stolen} 血`); }
          break;
        }
        case 'GA04': { // Power of the Pack: steal half rivals' deployed blood (rounded up)
          let stolen = 0;
          active.filter(sl => sl.playerId !== p.id).forEach(sl => {
            const take = Math.ceil(sl.bloodTokens / 2);
            sl.bloodTokens -= take; stolen += take;
          });
          p.blood += stolen;
          if (stolen > 0) { result.bloodEvents.push(`${p.name} 狼群之力：+${stolen}💧`); this.log(`${p.name} 的狼群之力奪取 ${stolen} 部署血液`); }
          break;
        }
        case 'GA05': { // Fearless: swap pool ↔ deployed blood, +2 from bank
          const old = slot.bloodTokens;
          slot.bloodTokens = p.blood;
          p.blood = old + 2;
          result.bloodEvents.push(`${p.name} 無懼：交換血液`);
          this.log(`${p.name} 的無懼：交換資源池(${p.blood-2})與部署血液，+2`);
          break;
        }
        case 'GA08': { // Gangrel Ready: take 2 blood from bank to location
          p.blood += 0; // bank is infinite
          slot.bloodTokens += 2;
          result.bloodEvents.push(`${p.name} 備戰：部署+2💧`);
          this.log(`${p.name} 的備戰從銀行取 2 血液至此地點`);
          break;
        }
        case 'TO03': { // Charisma: rivals discard deployed blood = alliance/2
          const discard = Math.floor(p.alliance.length / 2);
          if (discard > 0) {
            active.filter(sl => sl.playerId !== p.id).forEach(sl => {
              sl.bloodTokens = Math.max(0, sl.bloodTokens - discard);
            });
            result.bloodEvents.push(`${p.name} 魅力：對手棄置${discard}💧`);
            this.log(`${p.name} 的魅力：對手棄置 ${discard} 部署血液`);
          }
          break;
        }
        case 'TR02': { // Ancient Artifacts: spend half pool or flip face-down
          const cost = Math.floor(p.blood / 2);
          if (cost > 0 && p.blood >= cost) {
            p.blood -= cost;
            result.bloodEvents.push(`${p.name} 古老文物：消耗${cost}💧`);
            this.log(`${p.name} 的古老文物消耗 ${cost} 血液`);
          } else {
            slot.faceDown = true;
            this.log(`${p.name} 的古老文物因血液不足翻至面朝下`);
          }
          break;
        }
        case 'TR03': { // Theft of Vitae: gain blood to 7
          const gain = p.blood < 7 ? (7 - p.blood) : 1;
          p.blood += gain;
          result.bloodEvents.push(`${p.name} 竊取生命力：+${gain}💧`);
          this.log(`${p.name} 的竊取生命力：+${gain} 血液`);
          break;
        }
        case 'TR07': { // Arcane Drain: spend half, take half rivals' deployed
          const cost = Math.floor(p.blood / 2);
          if (cost > 0) {
            p.blood -= cost;
            let gained = 0;
            active.filter(sl => sl.playerId !== p.id).forEach(sl => {
              const take = Math.ceil(sl.bloodTokens / 2);
              sl.bloodTokens -= take; gained += take;
            });
            p.blood += gained;
            result.bloodEvents.push(`${p.name} 奧術汲取：-${cost}💧 +${gained}💧`);
            this.log(`${p.name} 的奧術汲取：消耗${cost}，奪取${gained}`);
          }
          break;
        }
        case 'NO07': { // Vanish: steal 1 from each rival
          let stolen = 0;
          rivals.forEach(r => { if (r.blood > 0) { r.blood--; stolen++; } });
          p.blood += stolen;
          if (stolen > 0) { result.bloodEvents.push(`${p.name} 消失於影：+${stolen}💧`); }
          break;
        }
        case 'VE06': { // Tyrant's Gaze: rivals lose 1 influence (simplified)
          rivals.forEach(r => { r.influence = Math.max(0, r.influence - 1); });
          result.bloodEvents.push(`${p.name} 暴君凝視：對手-1影響力`);
          this.log(`${p.name} 的暴君凝視使每個對手失去 1 影響力`);
          break;
        }
        case 'MA01': { // Mesmerize: plays opponent's remaining hand
          // complex — notify only
          result.bloodEvents.push(`${p.name} 催眠操控（需手動解算）`);
          break;
        }
        case 'MA03': { // Madness Network: play rest of hand here
          // auto-deploy remaining hand face-up (simplified: add as slots with 0 blood)
          [...p.hand].forEach(c => {
            this.state.deployments[locationId].push({
              playerId: p.id, cardId: c.id, faceDown: false,
              bloodTokens: 0, withdrawn: false, effectivePower: 0,
            });
            active.push(this.state.deployments[locationId][this.state.deployments[locationId].length-1]);
          });
          p.hand = [];
          p.handCount = 0;
          result.bloodEvents.push(`${p.name} 瘋狂網絡：手牌全入`);
          break;
        }
        case 'MA05': { // Chaos: take back cards, steal 1 per card
          // simplified: steal 1 per own deployed card
          const count = active.filter(sl => sl.playerId === p.id).length;
          let stolen = 0;
          rivals.forEach(r => {
            const take = Math.min(r.blood, count);
            r.blood -= take; stolen += take;
          });
          p.blood += stolen;
          if (stolen > 0) result.bloodEvents.push(`${p.name} 混沌：+${stolen}💧`);
          break;
        }
      }
    });
  }

  private applyConflict(locationId: string, active: SlotFull[], result: ConflictResult): void {
    const s = this.state;
    active.forEach(slot => {
      const card = getCardById(slot.cardId);
      if (!card || card.type !== 'conflict') return;
      const p = s.players[slot.playerId]!;
      const rivals = Object.values(s.players).filter(x => x.id !== slot.playerId);

      switch (card.id) {
        case 'VE02': { // Diplomacy: highest printed power (not mine) → 0
          const otherSlots = active.filter(sl => sl.playerId !== p.id);
          if (otherSlots.length === 0) break;
          const maxPow = Math.max(...otherSlots.map(sl => getCardById(sl.cardId)?.power ?? 0));
          otherSlots.forEach(sl => {
            if ((getCardById(sl.cardId)?.power ?? 0) === maxPow) {
              sl.effectivePower = Math.max(0, sl.effectivePower - maxPow);
            }
          });
          result.bloodEvents.push(`${p.name} 外交手腕：最強牌歸零`);
          this.log(`${p.name} 的外交手腕使最高權力牌歸零`);
          break;
        }
        case 'VE03': { // Curfew: rivals skip prep/aftermath OR lose 3 blood (simplified: steal 3)
          rivals.forEach(r => {
            const take = Math.min(r.blood, 3);
            r.blood -= take; p.blood += take;
          });
          result.bloodEvents.push(`${p.name} 宵禁令：偷取對手3💧`);
          this.log(`${p.name} 的宵禁令從每個對手偷取 3 血液`);
          break;
        }
        case 'VE05': { // Mass Manipulation: rivals must withdraw or give 2 blood (simplified: steal 2)
          rivals.forEach(r => {
            const take = Math.min(r.blood, 2);
            r.blood -= take; p.blood += take;
          });
          result.bloodEvents.push(`${p.name} 大規模操控：偷取對手2💧`);
          break;
        }
        case 'GA02': { // Wolf Companion: rivals' printed power halved
          active.filter(sl => sl.playerId !== p.id).forEach(sl => {
            const printed = getCardById(sl.cardId)?.power ?? 0;
            sl.effectivePower = Math.max(0, sl.effectivePower - Math.floor(printed / 2));
          });
          result.bloodEvents.push(`${p.name} 狼族夥伴：對手牌力減半`);
          this.log(`${p.name} 的狼族夥伴使對手部署牌印刷權力減半`);
          break;
        }
      }
    });
  }

  private applyAftermath(locationId: string, active: SlotFull[], result: ConflictResult): void {
    const s = this.state;
    active.forEach(slot => {
      const card = getCardById(slot.cardId);
      if (!card || card.type !== 'aftermath') return;
      const p = s.players[slot.playerId]!;
      const rivals = Object.values(s.players).filter(x => x.id !== slot.playerId);
      const isWinner = result.winner === slot.playerId;

      // ── Hunt-type cards (steal 1 from each rival) ──
      const huntIds = ['BR09','NO09','TO09','MA09','GA09'];
      if (huntIds.includes(card.id)) {
        let stolen = 0;
        rivals.forEach(r => { if (r.blood > 0) { r.blood--; stolen++; } });
        p.blood += stolen;
        if (stolen > 0) { result.bloodEvents.push(`${p.name} 狩獵：+${stolen}💧`); this.log(`${p.name} 狩獵偷取 ${stolen} 血液`); }
        return;
      }

      switch (card.id) {
        case 'TR09': { // Hunt: spend 1 to steal 1 from each rival
          if (p.blood >= 1) {
            p.blood--;
            let stolen = 0;
            rivals.forEach(r => { if (r.blood > 0) { r.blood--; stolen++; } });
            p.blood += stolen;
            if (stolen > 0) { result.bloodEvents.push(`${p.name} 狩獵(Tremere)：-1+${stolen}💧`); }
          }
          break;
        }
        case 'VE09': { // Hunt: winner must give 2 blood or 1 influence
          if (result.winner && result.winner !== p.id) {
            const wp = s.players[result.winner]!;
            if (wp.blood >= 2) { wp.blood -= 2; p.blood += 2; result.bloodEvents.push(`${p.name} 狩獵(Ventrue)：+2💧`); }
            else { wp.influence = Math.max(0, wp.influence - 1); p.influence += 1; result.bloodEvents.push(`${p.name} 狩獵(Ventrue)：+1⭐`); }
          }
          break;
        }
        case 'BR04': { // Fist of Caine: rivals lose blood by round
          const loss = s.round;
          rivals.forEach(r => { r.blood = Math.max(0, r.blood - loss); });
          result.bloodEvents.push(`${p.name} 該隱之拳：對手-${loss}💧`);
          this.log(`${p.name} 的該隱之拳使每個對手失去 ${loss} 血液`);
          break;
        }
        case 'BR05': { // F*ck the System: rivals lose 4 if win, 2 if not
          const loss = isWinner ? 4 : 2;
          rivals.forEach(r => { r.blood = Math.max(0, r.blood - loss); });
          result.bloodEvents.push(`${p.name} 打倒體制：對手-${loss}💧`);
          this.log(`${p.name} 的打倒體制使每個對手失去 ${loss} 血液`);
          break;
        }
        case 'BR06': { // Earthshock: rivals lose 1 per 2 total deployed blood
          const totalBlood = active.reduce((sum, sl) => sum + sl.bloodTokens, 0);
          const loss = Math.floor(totalBlood / 2);
          if (loss > 0) {
            rivals.forEach(r => { r.blood = Math.max(0, r.blood - loss); });
            result.bloodEvents.push(`${p.name} 地震衝擊：對手-${loss}💧`);
          }
          break;
        }
        case 'GA01': { // Earth Meld: reclaim own deployed blood
          p.blood += slot.bloodTokens;
          slot.bloodTokens = 0;
          result.bloodEvents.push(`${p.name} 融入大地：回收${slot.bloodTokens}💧`);
          this.log(`${p.name} 的融入大地回收部署血液`);
          break;
        }
        case 'GA07': { // Mist Form: move half deployed blood to another location
          const move = Math.ceil(slot.bloodTokens / 2);
          if (move > 0) {
            slot.bloodTokens -= move;
            // Move to Prince's Haven or first other location
            const otherLoc = LOCATIONS.find(l => l.id !== locationId);
            if (otherLoc) {
              const existingSlot = s.deployments[otherLoc.id].find(sl => sl.playerId === p.id);
              if (existingSlot) existingSlot.bloodTokens += move;
              else s.deployments[otherLoc.id].push({ playerId: p.id, cardId: '', faceDown: false, bloodTokens: move, withdrawn: false, effectivePower: 0 });
              result.bloodEvents.push(`${p.name} 迷霧型態：移${move}💧至${otherLoc.name}`);
            }
          }
          break;
        }
        case 'TO01': { // Awe: steal 1 per 2 alliance cards
          const steal = Math.floor(p.alliance.length / 2);
          if (steal > 0) {
            let stolen = 0;
            rivals.forEach(r => { const t = Math.min(r.blood, steal); r.blood -= t; stolen += t; });
            p.blood += stolen;
            result.bloodEvents.push(`${p.name} 敬畏：+${stolen}💧`);
          }
          break;
        }
        case 'TO04': { // Summon: if win ally/victim, draw extra victim
          if (isWinner && s.victimDeck.length > 0) {
            const v = s.victimDeck.shift()!;
            p.alliance.push(v);
            p.allianceCount++;
            result.bloodEvents.push(`${p.name} 召喚：獲得額外受害者牌`);
          }
          break;
        }
        case 'NO01': { // Unseen Passage: move card to Prince's Haven
          result.bloodEvents.push(`${p.name} 隱形通道（移至王子避難所，手動處理）`);
          break;
        }
        case 'TR05': { // Cauldron of Blood: spend half pool → rivals lose 4
          const cost = Math.floor(p.blood / 2);
          if (cost > 0) {
            p.blood -= cost;
            rivals.forEach(r => { r.blood = Math.max(0, r.blood - 4); });
            result.bloodEvents.push(`${p.name} 血液坩堝：-${cost}💧，對手-4💧`);
            this.log(`${p.name} 的血液坩堝消耗 ${cost}，使每個對手失去 4 血液`);
          }
          break;
        }
      }
    });
  }

  private awardPrize(locationId: string, winnerId: string, secondId: string | null): void {
    const s = this.state;
    const wp = s.players[winnerId];
    const ally = s.locationAllies[locationId];

    // 1st place: get the ally card at this location
    if (wp && ally) {
      wp.alliance.push(ally);
      wp.allianceCount++;
      s.locationAllies[locationId] = null;
      this.log(`${wp.name} 贏得盟友：${ally.name}`);
    }

    // 2nd place: get a victim card
    if (secondId && s.victimDeck.length > 0) {
      const sp = s.players[secondId];
      if (sp) {
        const v = s.victimDeck.shift()!;
        sp.alliance.push(v);
        sp.allianceCount++;
        this.log(`${sp.name} 獲得受害者牌`);
      }
    }
  }

  private checkFrenzy(player: PlayerPrivate): void {
    if (player.blood > 0) return;
    const causers = Object.values(this.state.players).filter(p => p.id !== player.id);
    if (causers.length > 0) {
      causers[0].influence += 1;
      this.log(`${player.name} 進入狂暴！${causers[0].name} 獲得 +1 影響力`);
    }
    // Drain random alliance card
    if (player.alliance.length > 0) {
      const shuffled = shuffle([...player.alliance]);
      const drained = shuffled[0];
      player.blood += drained.drainBlood;
      if (drained.type === 'vampire') {
        player.diablerie++;
        this.log(`${player.name} 強制汲取了 ${drained.name}（弒親！弒親代幣: ${player.diablerie}）`);
        if (player.diablerie >= 3) {
          this.log(`${player.name} 弒親代幣達 3！被淘汰出局！`);
          delete this.state.players[player.id];
          return;
        }
      } else {
        this.log(`${player.name} 強制汲取了 ${drained.name}`);
      }
    } else {
      player.blood = 1; // get 1 from bank if no alliance
    }
  }

  // ─── 回合結束 ────────────────────────────────

  endRound(): void {
    const s = this.state;
    s.phase = 'ROUND_END';

    Object.values(s.players).forEach(p => {
      // Return deployed cards to hand
      LOCATIONS.forEach(loc => {
        s.deployments[loc.id]
          .filter(sl => sl.playerId === p.id)
          .forEach(sl => {
            const card = getCardById(sl.cardId);
            if (card) p.hand.push(card);
          });
      });
      p.handCount = p.hand.length;
      p.isReady = false;
    });

    this.log(`第 ${s.round} 回合結束`);

    if (s.round >= 3) {
      this.endGame();
    }
  }

  endGame(): void {
    const s = this.state;
    s.phase = 'GAME_OVER';

    // Final score: influence tokens + alliance influence - diablerie
    Object.values(s.players).forEach(p => {
      const allianceInf = p.alliance.reduce((sum, a) => sum + a.influence, 0);
      p.influence += allianceInf - p.diablerie;
    });

    const sorted = Object.values(s.players).sort((a, b) => {
      if (b.influence !== a.influence) return b.influence - a.influence;
      return b.blood - a.blood;
    });

    s.winner = sorted[0]?.id ?? null;
    this.log(`── 遊戲結束 ──`);
    sorted.forEach((p, i) => {
      this.log(`#${i + 1} ${p.name}（${p.clan}）— ${p.influence} 影響力`);
    });
    if (s.winner) this.log(`🏆 ${s.players[s.winner]?.name} 成為芝加哥的新王子！`);
  }

  // ─── 狀態過濾 ────────────────────────────────

  getClientState(forPlayerId: string): GameStateClient {
    const s = this.state;
    const me = s.players[forPlayerId];

    const publicPlayers: Record<string, any> = {};
    Object.values(s.players).forEach(p => {
      publicPlayers[p.id] = {
        id: p.id, name: p.name, clan: p.clan,
        blood: p.blood, influence: p.influence,
        handCount: p.hand.length, allianceCount: p.alliance.length,
        diablerie: p.diablerie, deploymentsLeft: p.deploymentsLeft,
        isReady: p.isReady,
      };
    });

    const isRevealed = ['REVELATION', 'CONFLICT', 'ROUND_END', 'GAME_OVER'].includes(s.phase);
    const filteredDeploy: Record<string, SlotVisible[]> = {};
    for (const [locId, slots] of Object.entries(s.deployments)) {
      filteredDeploy[locId] = slots.map(slot => {
        const isMine = slot.playerId === forPlayerId;
        const revealed = !slot.faceDown || isRevealed;
        return {
          playerId: slot.playerId,
          cardId: (isMine || revealed) ? slot.cardId : null,
          faceDown: slot.faceDown,
          bloodTokensHidden: !isMine && !revealed,
          bloodTokens: (isMine || revealed) ? slot.bloodTokens : 0,
          withdrawn: slot.withdrawn,
          effectivePower: isRevealed ? slot.effectivePower : null,
        };
      });
    }

    return {
      roomCode: s.roomCode,
      phase: s.phase,
      round: s.round,
      ambitionHolder: s.ambitionHolder,
      locations: s.locations,
      players: publicPlayers,
      myHand: me?.hand ?? [],
      myHandBuildDraft: me?.handBuildDraft ?? [],
      myBlood: me?.blood ?? 0,
      myAlliance: me?.alliance ?? [],
      myDiablerieTokens: me?.diablerie ?? 0,
      deployments: filteredDeploy,
      locationAllies: s.locationAllies,
      waitingFor: Object.values(s.players).filter(p => !p.isReady).map(p => p.id),
      lastConflictResults: s.lastConflictResults,
      winner: s.winner,
      log: s.log.slice(-40),
    };
  }

  private locName(id: string): string {
    return LOCATIONS.find(l => l.id === id)?.name ?? id;
  }

  private log(msg: string): void {
    const ts = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.state.log.push(`[${ts}] ${msg}`);
  }
}
