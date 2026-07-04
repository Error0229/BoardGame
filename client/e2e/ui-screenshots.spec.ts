import { test } from '@playwright/test'
import { setup, pushState } from './helpers'
import {
  lobbyState, clanSelectState, planningState, revelationState, gameOverState,
} from './game-states'

// 視覺驗證用截圖:npx playwright test ui-screenshots --update-snapshots 不適用,
// 純粹輸出 png 供人工檢視(存到 test-results/ui-shots/)。
const SHOT = (name: string) => `test-results/ui-shots/${name}.png`

test('lobby entry', async ({ page }) => {
  await setup(page)
  await page.screenshot({ path: SHOT('01-lobby'), fullPage: true })
})

test('clan select + phase banner', async ({ page }) => {
  await setup(page)
  await pushState(page, lobbyState())
  await pushState(page, clanSelectState(null, [
    { id: 'p2', name: '艾莉', clan: 'toreador' },
  ]))
  // PhaseBanner 應在階段切換時出現;等淡入完成再截
  await page.waitForSelector('.phase-banner', { timeout: 2000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: SHOT('02-phase-banner'), fullPage: true })
  await page.waitForSelector('.phase-banner', { state: 'detached', timeout: 3000 })
  await page.screenshot({ path: SHOT('03-clan-select'), fullPage: true })
})

const SLOT = (playerId: string, cardId: string, extra: Record<string, unknown> = {}) => ({
  playerId, cardId, faceDown: false, bloodTokensHidden: false,
  bloodTokens: 0, withdrawn: false, effectivePower: null, ...extra,
})

test('planning table layout: seats + owner-attributed slots', async ({ page }) => {
  await setup(page)
  await pushState(page, {
    ...planningState({ isMyTurn: true }),
    deployments: {
      rack: [SLOT('test-p1', 'BR01', { bloodTokens: 2 }), SLOT('test-p2', 'VE01')],
      asylum: [SLOT('test-p2', 'VE02', { faceDown: true, cardId: null })],
      club_zombie: [],
      haven: [],
    },
  })
  await page.screenshot({ path: SHOT('04-planning-table'), fullPage: true })
})

test('revelation playback: strip + seats + skip + timeline', async ({ page }) => {
  await setup(page)
  const base = revelationState({}) as Record<string, any>
  await pushState(page, {
    ...base,
    deployments: {
      ...base.deployments,
      rack: [
        SLOT('test-p1', 'BR01', { effectivePower: 6 }),
        SLOT('test-p2', 'VE01', { effectivePower: 3 }),
      ],
    },
    lastConflictResults: [{
      ...base.lastConflictResults[0],
      stepEvents: {
        prepare: [{ text: 'Bob 的主謀計劃啟動', sourceCardId: 'VE01', sourcePlayerName: 'Bob' }],
        conflict: [{ text: 'Bob 奪取 Alice 1 點影響力', sourcePlayerName: 'Bob', targetPlayerName: 'Alice', delta: { influence: -1 } }],
        aftermath: [],
      },
    }],
    skipVotes: ['test-p2'],
    activeEffect: {
      locationId: 'rack', step: 'conflict', eventIndex: 1, eventCount: 3,
      sourceCardId: 'VE01', sourcePlayerName: 'Bob', targetPlayerName: 'Alice',
      text: 'Bob 奪取 Alice 1 點影響力', delta: { influence: -1 },
    },
  })
  await page.screenshot({ path: SHOT('05-revelation-playback'), fullPage: true })
})

test('revelation choosers panel', async ({ page }) => {
  await setup(page)
  const base = revelationState({}) as Record<string, any>
  await pushState(page, {
    ...base,
    hasPendingChoices: true,
    myPendingChoice: null,
    waitingFor: ['test-p2'],
    activeChoosers: [{ playerId: 'test-p2', cardId: 'VE01', locationId: 'rack' }],
    deployments: {
      ...base.deployments,
      rack: [SLOT('test-p1', 'BR01'), SLOT('test-p2', 'VE01')],
    },
  })
  await page.screenshot({ path: SHOT('07-revelation-choosers'), fullPage: true })
})

test('round end summary', async ({ page }) => {
  await setup(page)
  const base = revelationState({ round: 0 }) as Record<string, any>
  await pushState(page, {
    ...base,
    phase: 'ROUND_END',
    lastConflictResults: [
      { ...base.lastConflictResults[0] },
      { locationId: 'asylum', winner: 'test-p2', second: null, scores: { 'test-p2': 4 }, influenceGained: { 'test-p2': 1 }, bloodEvents: [], stepEvents: { prepare: [], conflict: [], aftermath: [] }, tie: false },
      { locationId: 'club_zombie', winner: null, second: null, scores: {}, influenceGained: {}, bloodEvents: [], stepEvents: { prepare: [], conflict: [], aftermath: [] }, tie: true },
    ],
  })
  await page.screenshot({ path: SHOT('08-round-end-summary'), fullPage: true })
})

test('game over ceremony', async ({ page }) => {
  await setup(page)
  await pushState(page, gameOverState())
  await page.waitForTimeout(1200) // 等 staggered 進場動畫跑完
  await page.screenshot({ path: SHOT('06-gameover'), fullPage: true })
})
