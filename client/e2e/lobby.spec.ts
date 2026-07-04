import { test, expect } from '@playwright/test'
import { setup, pushState, getEmitted, getLastEmit, MY_ID } from './helpers'
import { lobbyState } from './game-states'

test.describe('LobbyScreen — entry form', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('shows tagline, name input, and action buttons before joining a room', async ({ page }) => {
    await expect(page.locator('.lobby-entry__tagline-title')).toHaveText('血與背叛')
    await expect(page.getByPlaceholder('輸入你的名字')).toBeVisible()
    await expect(page.getByText('建立房間')).toBeVisible()
    await expect(page.getByText('加入房間')).toBeVisible()
  })

  test('emits createRoom with the typed name', async ({ page }) => {
    await page.getByPlaceholder('輸入你的名字').fill('Alice')
    await page.getByText('建立房間').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'createRoom', data: { name: 'Alice' } })
  })

  test('shows an error and does not emit when name is blank on create', async ({ page }) => {
    await page.getByText('建立房間').click()
    const emits = await getEmitted(page)
    expect(emits).toHaveLength(0)
    await expect(page.locator('.app-error')).toBeVisible()
    await expect(page.locator('.app-error')).toContainText('請輸入名字')
  })

  test('Enter key in name input triggers create', async ({ page }) => {
    await page.getByPlaceholder('輸入你的名字').fill('Dana')
    await page.getByPlaceholder('輸入你的名字').press('Enter')
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'createRoom', data: { name: 'Dana' } })
  })

  test('switches to join view with a code input', async ({ page }) => {
    await page.getByText('加入房間').click()
    await expect(page.getByPlaceholder('房間代碼（4碼）')).toBeVisible()
    await expect(page.getByText('加入')).toBeVisible()
    await expect(page.getByText('返回')).toBeVisible()
  })

  test('emits joinRoom with name and 4-char code', async ({ page }) => {
    await page.getByText('加入房間').click()
    await page.getByPlaceholder('輸入你的名字').fill('Casey')
    await page.getByPlaceholder('房間代碼（4碼）').fill('ABCD')
    await page.getByText('加入').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'joinRoom', data: { name: 'Casey', code: 'ABCD' } })
  })

  test('normalises the code to uppercase before emitting', async ({ page }) => {
    await page.getByText('加入房間').click()
    await page.getByPlaceholder('輸入你的名字').fill('Casey')
    await page.getByPlaceholder('房間代碼（4碼）').fill('abcd')
    await page.getByText('加入').click()
    const last = await getLastEmit(page)
    expect(last).toMatchObject({ event: 'joinRoom', data: { code: 'ABCD' } })
  })

  test('shows error when join code is wrong length', async ({ page }) => {
    await page.getByText('加入房間').click()
    await page.getByPlaceholder('輸入你的名字').fill('Casey')
    await page.getByPlaceholder('房間代碼（4碼）').fill('AB')
    await page.getByText('加入').click()
    await expect(page.locator('.app-error')).toBeVisible()
    const emits = await getEmitted(page)
    expect(emits).toHaveLength(0)
  })

  test('返回 restores the home view', async ({ page }) => {
    await page.getByText('加入房間').click()
    await page.getByText('返回').click()
    await expect(page.getByText('建立房間')).toBeVisible()
    await expect(page.getByPlaceholder('房間代碼（4碼）')).not.toBeVisible()
  })
})

test.describe('LobbyScreen — inside a room', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('shows the room code, player names, and host badge', async ({ page }) => {
    await pushState(page, lobbyState())
    await expect(page.locator('.lobby-room__code')).toHaveText('TEST')
    await expect(page.locator('.lobby-room__player-name').first()).toContainText('Alice')
    await expect(page.locator('.lobby-room__host-badge').first()).toBeVisible()
    await expect(page.locator('.lobby-room__player-name').first()).toContainText('(你)')
  })

  test('host sees 開始遊戲 disabled when fewer than 3 players', async ({ page }) => {
    await pushState(page, lobbyState())
    const startBtn = page.getByRole('button', { name: '開始遊戲' })
    await expect(startBtn).toBeVisible()
    await expect(startBtn).toBeDisabled()
    await expect(page.locator('.lobby-room__hint')).toContainText('至少需要 3 人')
  })

  test('host can start and emits readyStart with 3+ players', async ({ page }) => {
    await pushState(page, lobbyState({
      [MY_ID]:    { id: MY_ID,      name: 'Alice', clan: null, blood: 6, influence: 3, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 1, isReady: false },
      'test-p2':  { id: 'test-p2',  name: 'Bob',   clan: null, blood: 6, influence: 3, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 1, isReady: false },
      'test-p3':  { id: 'test-p3',  name: 'Casey', clan: null, blood: 6, influence: 3, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 1, isReady: false },
    }))
    const startBtn = page.getByRole('button', { name: '開始遊戲' })
    await expect(startBtn).not.toBeDisabled()
    await startBtn.click()
    const last = await getLastEmit(page)
    expect(last?.event).toBe('readyStart')
  })

  test('non-host sees "等待房主開始遊戲" when 3+ players are present', async ({ page }) => {
    // Push a state where the first player is NOT MY_ID, so we're not the host
    await pushState(page, lobbyState({
      'test-p2':  { id: 'test-p2',  name: 'Bob',   clan: null, blood: 6, influence: 3, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 1, isReady: false },
      [MY_ID]:    { id: MY_ID,      name: 'Alice', clan: null, blood: 6, influence: 3, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 1, isReady: false },
      'test-p3':  { id: 'test-p3',  name: 'Casey', clan: null, blood: 6, influence: 3, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 1, isReady: false },
    }))
    await expect(page.locator('.lobby-room__hint')).toContainText('等待房主開始遊戲')
    await expect(page.getByRole('button', { name: '開始遊戲' })).not.toBeVisible()
  })
})
